import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, it, expect, vi } from "vitest";
import {
  chesscomGames,
  fetchText,
  HttpDeps,
  lichessGames,
  parseFideLinkedUser,
  resolveLichessUser,
  RETRY_MS,
  SourceError,
  TextCache,
  USER_AGENT,
} from "../sources";
import { ImportDeps, runImport } from "../import-book";
import type { Book, PlayerEntry } from "../../../src/game/opponent/types";

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

const ENTRY: PlayerEntry = JSON.parse(
  readFileSync(
    new URL("../../../src/game/opponent/players/le-quang-liem/player.json", import.meta.url),
    "utf8"
  )
);

type Reply = { status: number; body?: string; headers?: Record<string, string> } | Error;

/** A fake fetch: each URL answers its replies in order, repeating the last one. */
function fakeFetch(routes: Record<string, Reply | Reply[] | string>) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const used: Record<string, number> = {};
  const fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, headers: { ...(init?.headers as Record<string, string>) } });
    const route = routes[url];
    if (route === undefined) return new Response("not found", { status: 404 });
    const list = typeof route === "string" ? [{ status: 200, body: route }] : [route].flat();
    const n = used[url] ?? 0;
    used[url] = n + 1;
    const reply = list[Math.min(n, list.length - 1)];
    if (reply instanceof Error) throw reply;
    return new Response(reply.body ?? "", { status: reply.status, headers: reply.headers });
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

function memoryCache(initial: Record<string, string> = {}) {
  const store = { ...initial };
  const cache: TextCache = {
    read: async (key) => store[key] ?? null,
    write: async (key, text) => {
      store[key] = text;
    },
  };
  return { cache, store };
}

function deps(fetch: typeof globalThis.fetch, extra: Partial<HttpDeps> = {}) {
  const sleep = vi.fn(async (_ms: number) => {});
  return { fetch, sleep, ...extra } as HttpDeps & { sleep: typeof sleep };
}

const FIDE_URL = ENTRY.sources.lichessFideUrl;
const lichessExport = (user: string) =>
  `https://lichess.org/api/games/user/${user}?clocks=false&evals=false&opening=false&literate=false`;
const CC = "https://api.chess.com/pub/player/liemle/games";

// The importer must never reach the real network: any global fetch call fails the suite.
const realNetwork = vi.fn(() => {
  throw new Error("real network used");
});
beforeAll(() => {
  vi.stubGlobal("fetch", realNetwork);
});
afterAll(() => {
  expect(realNetwork).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

describe("resolves the Lichess account", () => {
  it("uses the flag first, without fetching", async () => {
    const { fetch, calls } = fakeFetch({});
    const entry = { ...ENTRY, sources: { ...ENTRY.sources, lichessUser: "EntryUser" } };
    expect(await resolveLichessUser({ flag: "FlagUser", entry }, deps(fetch))).toEqual({
      user: "FlagUser",
      via: "flag",
    });
    expect(calls).toEqual([]);
  });

  it("then player.json, without fetching", async () => {
    const { fetch, calls } = fakeFetch({});
    const entry = { ...ENTRY, sources: { ...ENTRY.sources, lichessUser: "EntryUser" } };
    expect(await resolveLichessUser({ entry }, deps(fetch))).toEqual({
      user: "EntryUser",
      via: "player",
    });
    expect(calls).toEqual([]);
  });

  it("then the account linked in the saved FIDE page", async () => {
    const { fetch, calls } = fakeFetch({ [FIDE_URL]: fixture("fide-linked.html") });
    expect(await resolveLichessUser({ entry: ENTRY }, deps(fetch))).toEqual({
      user: "FixtureGM",
      via: "fide-page",
    });
    expect(calls.map((c) => c.url)).toEqual([FIDE_URL]);
  });

  it("null when the page links no account; links outside the player header don't count", async () => {
    expect(parseFideLinkedUser(fixture("fide-none.html"))).toBeNull();
    expect(parseFideLinkedUser("<a href=\"/@/Someone\">x</a>")).toBeNull();
    expect(parseFideLinkedUser(fixture("fide-linked.html"))).toBe("FixtureGM");
    const { fetch } = fakeFetch({ [FIDE_URL]: fixture("fide-none.html") });
    expect(await resolveLichessUser({ entry: ENTRY }, deps(fetch))).toEqual({
      user: null,
      via: "none",
    });
  });

  it("a FIDE page that fails to load is a source failure, not 'no account'", async () => {
    const { fetch } = fakeFetch({ [FIDE_URL]: { status: 500 } });
    await expect(resolveLichessUser({ entry: ENTRY }, deps(fetch))).rejects.toBeInstanceOf(
      SourceError
    );
  });

  it("rejects a flag that is not a Lichess username", async () => {
    const { fetch } = fakeFetch({});
    await expect(
      resolveLichessUser({ flag: "bad name/../x", entry: ENTRY }, deps(fetch))
    ).rejects.toThrow(/username/);
  });
});

describe("fetch retries and failures", () => {
  it("a 429 is retried after a sleep and then succeeds", async () => {
    const url = "https://example.test/a";
    const { fetch, calls } = fakeFetch({ [url]: [{ status: 429 }, { status: 200, body: "ok" }] });
    const d = deps(fetch);
    expect(await fetchText(url, d)).toBe("ok");
    expect(calls).toHaveLength(2);
    expect(d.sleep.mock.calls).toEqual([[RETRY_MS]]);
    expect(RETRY_MS).toBe(60_000);
  });

  it("waits for Retry-After when the server sends it", async () => {
    const url = "https://example.test/b";
    const { fetch } = fakeFetch({
      [url]: [{ status: 429, headers: { "Retry-After": "5" } }, { status: 200, body: "ok" }],
    });
    const d = deps(fetch);
    await fetchText(url, d);
    expect(d.sleep.mock.calls).toEqual([[5000]]);
  });

  it("4 times 429 fails the source after 3 retries", async () => {
    const url = "https://example.test/c";
    const { fetch, calls } = fakeFetch({ [url]: { status: 429 } });
    const d = deps(fetch);
    await expect(fetchText(url, d)).rejects.toThrow(/429/);
    expect(calls).toHaveLength(4);
    expect(d.sleep).toHaveBeenCalledTimes(3);
  });

  it("a 404 or a network error fails at once", async () => {
    const { fetch, calls } = fakeFetch({ "https://example.test/down": new Error("ECONNRESET") });
    const d = deps(fetch);
    await expect(fetchText("https://example.test/missing", d)).rejects.toThrow(/404/);
    await expect(fetchText("https://example.test/down", d)).rejects.toBeInstanceOf(SourceError);
    expect(calls).toHaveLength(2);
    expect(d.sleep).not.toHaveBeenCalled();
  });

  it("sends a User-Agent with a contact on every request", async () => {
    const { fetch, calls } = fakeFetch({ "https://example.test/ua": "ok" });
    await fetchText("https://example.test/ua", deps(fetch));
    expect(calls[0].headers["User-Agent"]).toBe(USER_AGENT);
    expect(USER_AGENT).toMatch(/https:\/\/github\.com\/iamphduc\/chess-web/);
  });

  it("Lichess games come from the documented export endpoint as PGN", async () => {
    const { fetch, calls } = fakeFetch({ [lichessExport("FixtureGM")]: fixture("lichess.pgn") });
    expect(await lichessGames("FixtureGM", deps(fetch))).toBe(fixture("lichess.pgn"));
    expect(calls[0].headers.Accept).toBe("application/x-chess-pgn");
  });

  it("Chess.com reads every monthly archive", async () => {
    const months = ["2023/11", "2023/12", "2024/01"];
    const routes: Record<string, string> = {
      [`${CC}/archives`]: JSON.stringify({ archives: months.map((m) => `${CC}/${m}`) }),
    };
    for (const m of months) routes[`${CC}/${m}/pgn`] = `pgn ${m}`;
    const { fetch, calls } = fakeFetch(routes);
    const { cache, store } = memoryCache();
    const now = () => new Date(Date.UTC(2024, 0, 15));
    const d = deps(fetch, { cache, now });
    expect(await chesscomGames("liemle", d)).toEqual(months.map((m) => `pgn ${m}`));
    expect(calls.map((c) => c.url)).toEqual([`${CC}/archives`, ...months.map((m) => `${CC}/${m}/pgn`)]);

    // A second run reads finished months from the cache, but refetches the list and this month.
    calls.length = 0;
    expect(Object.keys(store).sort()).toEqual([
      "chesscom-liemle-2023-11.pgn",
      "chesscom-liemle-2023-12.pgn",
      "chesscom-liemle-2024-01.pgn",
    ]);
    expect(await chesscomGames("liemle", d)).toEqual(months.map((m) => `pgn ${m}`));
    expect(calls.map((c) => c.url)).toEqual([`${CC}/archives`, `${CC}/2024/01/pgn`]);
  });

  it("an unknown Chess.com user fails the source", async () => {
    const { fetch } = fakeFetch({});
    await expect(chesscomGames("liemle", deps(fetch))).rejects.toBeInstanceOf(SourceError);
  });
});

describe("never calls the real network", () => {
  function importDeps(routes: Record<string, Reply | Reply[] | string>, otb: string[] = []) {
    const { fetch, calls } = fakeFetch(routes);
    const written: Record<string, string> = {};
    const lines: string[] = [];
    const warnings: string[] = [];
    const d: ImportDeps = {
      fetch,
      sleep: async () => {},
      now: () => new Date(Date.UTC(2024, 0, 15)),
      cache: memoryCache().cache,
      entry: ENTRY,
      readOtbFiles: async () => otb,
      writeBook: async (name, json) => {
        written[name] = json;
      },
      log: (line) => lines.push(line),
      warn: (line) => warnings.push(line),
    };
    return { d, calls, written, lines, warnings };
  }

  const chesscomRoutes = {
    [`${CC}/archives`]: JSON.stringify({ archives: [`${CC}/2024/01`] }),
    [`${CC}/2024/01/pgn`]: fixture("chesscom.pgn"),
  };

  it("with the global fetch replaced by a throwing stub, a full import runs on fixtures", async () => {
    const { d, written, lines } = importDeps(
      {
        ...chesscomRoutes,
        [FIDE_URL]: fixture("fide-linked.html"),
        [lichessExport("FixtureGM")]: fixture("lichess.pgn").replace(/fixtureuser/gi, "FixtureGM"),
      },
      [fixture("otb.pgn")]
    );
    expect(await runImport([], d)).toBe(0);
    expect(Object.keys(written).sort()).toEqual(["book-online.json", "book-slow.json"]);
    const online = JSON.parse(written["book-online.json"]) as Book;
    const slow = JSON.parse(written["book-slow.json"]) as Book;
    expect(online.gamesBySource).toEqual({ otb: 1, lichess: 1, chesscom: 2 });
    expect(slow.gamesBySource).toEqual({ otb: 4, lichess: 1, chesscom: 0 });
    const out = lines.join("\n");
    expect(out).toMatch(/lichess.*FixtureGM.*fide-page/i);
    expect(out).toMatch(/skipped/i);
    expect(out).toMatch(/dropped/i);
    expect(realNetwork).not.toHaveBeenCalled();
  });

  it("the --lichess-user flag picks the account", async () => {
    const { d, calls } = importDeps({
      ...chesscomRoutes,
      [lichessExport("FlagUser")]: fixture("lichess.pgn").replace(/fixtureuser/gi, "FlagUser"),
    });
    expect(await runImport(["--lichess-user", "FlagUser"], d)).toBe(0);
    expect(calls.map((c) => c.url)).not.toContain(FIDE_URL);
    expect(calls.map((c) => c.url)).toContain(lichessExport("FlagUser"));
  });

  it("with no Lichess account it warns and builds without Lichess", async () => {
    const { d, written, warnings, calls } = importDeps({
      ...chesscomRoutes,
      [FIDE_URL]: fixture("fide-none.html"),
    });
    expect(await runImport([], d)).toBe(0);
    expect(warnings.join("\n")).toMatch(/lichess/i);
    expect(calls.some((c) => c.url.startsWith("https://lichess.org/api/"))).toBe(false);
    expect((JSON.parse(written["book-online.json"]) as Book).gamesBySource.lichess).toBe(0);
  });

  it("a failed source exits non-zero and writes no book", async () => {
    const { d, written } = importDeps({
      [`${CC}/archives`]: JSON.stringify({ archives: [`${CC}/2024/01`] }),
      [`${CC}/2024/01/pgn`]: { status: 429 },
      [FIDE_URL]: fixture("fide-none.html"),
    });
    expect(await runImport([], d)).not.toBe(0);
    expect(written).toEqual({});
  });

  it("an unknown flag exits non-zero and fetches nothing", async () => {
    const { d, calls, written } = importDeps({});
    expect(await runImport(["--nope"], d)).not.toBe(0);
    expect(calls).toEqual([]);
    expect(written).toEqual({});
  });
});
