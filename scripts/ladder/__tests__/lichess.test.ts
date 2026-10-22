import { describe, expect, it } from "vitest";
import {
  BaselineGame,
  createClient,
  LichessGame,
  MIN_GAP_MS,
  parseNdjson,
  PoolGame,
  selectGames,
  START_EVAL,
  toBaselineGame,
  userGamesUrl,
} from "../lichess";

/** A Lichess export row: `moves` is SAN, `analysis[i]` the eval after ply i, White's view. */
function lichessGame(over: Partial<LichessGame> = {}): LichessGame {
  return {
    id: "abcd1234",
    rated: true,
    variant: "standard",
    speed: "blitz",
    status: "resign",
    players: {
      white: { user: { name: "Alice", id: "alice" }, rating: 1400, analysis: { accuracy: 81 } },
      black: { user: { name: "Bob", id: "bob" }, rating: 1410, analysis: { accuracy: 74 } },
    },
    moves: "e4 e5 Nf3 Nc6",
    analysis: [{ eval: 20 }, { eval: 30 }, { eval: -40 }, { mate: 3 }],
    ...over,
  };
}

describe("eval conversion", () => {
  it("White-view evals after each ply become side-to-move evals before each ply", () => {
    const r = toBaselineGame(lichessGame(), 0);
    expect(r.kind).toBe("ok");
    const g = (r as { game: BaselineGame }).game;
    expect(g.uci).toEqual(["e2e4", "e7e5", "g1f3", "b8c6"]);
    // Before ply 0 Lichess gives nothing; the start is a fixed small plus.
    expect(g.evals).toEqual([START_EVAL, { cp: -20 }, { cp: 30 }, { cp: 40 }, { mate: 3 }]);
    expect(g.sides).toEqual(["white", "black"]);
    expect(g.speed).toBe("blitz");
    expect(g.ratings).toEqual({ white: 1400, black: 1410 });
    expect(g.accuracy).toEqual({ white: 81, black: 74 });
  });

  it("a mate for Black turns sign when Black is to move", () => {
    const r = toBaselineGame(
      lichessGame({ moves: "e4 e5 Nf3", analysis: [{ eval: 20 }, { eval: 30 }, { mate: -2 }] }),
      0
    );
    expect((r as { game: BaselineGame }).game.evals[3]).toEqual({ mate: 2 });
  });

  it("grades plies from skipPlies on", () => {
    const g = (toBaselineGame(lichessGame(), 2) as { game: BaselineGame }).game;
    expect(g.graded).toEqual([false, false, true, true]);
    const none = (toBaselineGame(lichessGame(), 10) as { game: BaselineGame }).game;
    expect(none.graded).toEqual([false, false, false, false]);
  });

  it("a missing eval before the last ply drops the game", () => {
    const r = toBaselineGame(
      lichessGame({ analysis: [{ eval: 20 }, {}, { eval: -40 }, { mate: 3 }] }),
      0
    );
    expect(r).toEqual({ kind: "dropped" });
    expect(toBaselineGame(lichessGame({ analysis: undefined }), 0)).toEqual({ kind: "dropped" });
  });

  it("a game that ends in mate without a last eval gets the mated eval", () => {
    const r = toBaselineGame(
      lichessGame({ moves: "f3 e5 g4 Qh4#", status: "mate", analysis: [{ eval: -50 }, { eval: -60 }, { mate: -1 }] }),
      0
    );
    const g = (r as { game: BaselineGame }).game;
    expect(g.uci).toHaveLength(4);
    expect(g.evals[4]).toEqual({ mate: 0 });
  });

  it("a missing last eval in a live position leaves that ply out", () => {
    const r = toBaselineGame(
      lichessGame({ analysis: [{ eval: 20 }, { eval: 30 }, { eval: -40 }] }),
      0
    );
    const g = (r as { game: BaselineGame }).game;
    expect(g.uci).toEqual(["e2e4", "e7e5", "g1f3"]);
    expect(g.evals).toHaveLength(4);
    expect(g.graded).toHaveLength(3);
  });

  it("drops a game whose moves don't replay", () => {
    expect(toBaselineGame(lichessGame({ moves: "e4 e4 Nf3 Nc6" }), 0)).toEqual({ kind: "dropped" });
  });

  it("skips games that are not rated standard blitz or rapid with both ratings", () => {
    expect(toBaselineGame(lichessGame({ variant: "chess960" }), 0)).toEqual({ kind: "skipped" });
    expect(toBaselineGame(lichessGame({ speed: "bullet" }), 0)).toEqual({ kind: "skipped" });
    expect(toBaselineGame(lichessGame({ rated: false }), 0)).toEqual({ kind: "skipped" });
    const noRating = lichessGame();
    delete noRating.players.black.rating;
    expect(toBaselineGame(noRating, 0)).toEqual({ kind: "skipped" });
  });

  it("missing accuracy is null", () => {
    const raw = lichessGame();
    delete raw.players.white.analysis;
    const g = (toBaselineGame(raw, 0) as { game: BaselineGame }).game;
    expect(g.accuracy).toEqual({ white: null, black: 74 });
  });

  it("reads NDJSON, skipping blank lines", () => {
    expect(parseNdjson('{"a":1}\n\n{"a":2}\n')).toEqual([{ a: 1 }, { a: 2 }]);
  });
});

/** A pool row: ratings and speed, and a game unless its evals were missing. */
function pooled(white: number, black: number, speed: "blitz" | "rapid" = "blitz", ok = true): PoolGame {
  const game = ok
    ? ({ ...(toBaselineGame(lichessGame({ speed }), 0) as { game: BaselineGame }).game, ratings: { white, black } })
    : null;
  return { ratings: { white, black }, speed, game };
}
const many = (n: number, white: number, black: number, speed: "blitz" | "rapid" = "blitz") =>
  Array.from({ length: n }, () => pooled(white, black, speed));

describe("rating band", () => {
  it("keeps a game only when both ratings are inside ±100, edges included", () => {
    const pool = [
      ...many(30, 1400, 1400),
      pooled(1300, 1500),
      pooled(1500, 1300),
      pooled(1299, 1400),
      pooled(1400, 1501),
    ];
    const s = selectGames(pool, 1400, 150);
    expect(s.ratingMin).toBe(1300);
    expect(s.ratingMax).toBe(1500);
    expect(s.games).toHaveLength(32);
    expect(s.lowSample).toBe(false);
  });

  it("30 kept at ±100 does not widen", () => {
    const s = selectGames([...many(30, 1400, 1400), pooled(1260, 1400)], 1400, 150);
    expect([s.ratingMin, s.ratingMax]).toEqual([1300, 1500]);
    expect(s.games).toHaveLength(30);
  });

  it("29 kept widens to ±150, edges included", () => {
    const pool = [...many(29, 1400, 1400), pooled(1250, 1550), pooled(1249, 1400), pooled(1400, 1551)];
    const s = selectGames(pool, 1400, 150);
    expect([s.ratingMin, s.ratingMax]).toEqual([1250, 1550]);
    expect(s.games).toHaveLength(30);
    expect(s.lowSample).toBe(false);
  });

  it("under 30 even at ±150 sets lowSample", () => {
    const s = selectGames([...many(20, 1400, 1400), ...many(9, 1260, 1540)], 1400, 150);
    expect([s.ratingMin, s.ratingMax]).toEqual([1250, 1550]);
    expect(s.games).toHaveLength(29);
    expect(s.lowSample).toBe(true);
  });

  it("games with missing evals don't count as kept, and are counted as dropped in the band", () => {
    const pool = [...many(29, 1400, 1400), pooled(1400, 1400, "blitz", false), pooled(1600, 1600, "blitz", false)];
    const s = selectGames(pool, 1400, 150);
    expect(s.games).toHaveLength(29);
    expect(s.droppedGames).toBe(1);
    expect(s.lowSample).toBe(true);
  });

  it("takes rapid games first, then blitz up to the limit", () => {
    const pool = [...many(40, 1400, 1400, "blitz"), ...many(10, 1400, 1400, "rapid")];
    const s = selectGames(pool, 1400, 35);
    expect(s.games).toHaveLength(35);
    expect(s.speeds).toEqual({ rapid: 10, blitz: 25 });
    expect(s.games.slice(0, 10).every((g) => g.speed === "rapid")).toBe(true);
  });

  it("an empty pool keeps nothing", () => {
    const s = selectGames([], 2500, 150);
    expect(s.games).toEqual([]);
    expect(s.lowSample).toBe(true);
  });
});

describe("polite fetching", () => {
  type Call = { url: string; at: number; init: RequestInit | undefined };

  /** A fake clock: sleep moves it on; each request takes 300 ms. */
  function harness(
    replies: Record<string, (Response | (() => Response))[]>,
    cache?: { read(k: string): Promise<string | null>; write(k: string, v: string): Promise<void> }
  ) {
    let t = 0;
    let inFlight = 0;
    let maxInFlight = 0;
    const calls: Call[] = [];
    const ends: number[] = [];
    const used: Record<string, number> = {};
    const fetch = (async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, at: t, init });
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      t += 300;
      inFlight--;
      ends.push(t);
      const list = replies[url] ?? [new Response("", { status: 404 })];
      const n = Math.min(used[url] ?? 0, list.length - 1);
      used[url] = (used[url] ?? 0) + 1;
      const r = list[n];
      return typeof r === "function" ? r() : r.clone();
    }) as typeof globalThis.fetch;
    const sleeps: number[] = [];
    const client = createClient({
      fetch,
      sleep: async (ms) => {
        sleeps.push(ms);
        t += ms;
      },
      now: () => t,
      cache,
    });
    return { client, calls, ends, sleeps, stats: () => ({ maxInFlight }) };
  }

  it("sends one request at a time, at least 1.5 s after the last one ended", async () => {
    const h = harness({
      "https://lichess.org/a": [new Response("A")],
      "https://lichess.org/b": [new Response("B")],
      "https://lichess.org/c": [new Response("C")],
    });
    const out = await Promise.all(
      ["a", "b", "c"].map((p) => h.client.get(`https://lichess.org/${p}`, "text/plain"))
    );
    expect(out).toEqual(["A", "B", "C"]);
    expect(h.stats().maxInFlight).toBe(1);
    expect(MIN_GAP_MS).toBeGreaterThanOrEqual(1500);
    for (let i = 1; i < h.calls.length; i++) {
      expect(h.calls[i].at - h.ends[i - 1]).toBeGreaterThanOrEqual(1500);
    }
  });

  it("a 429 waits and retries", async () => {
    const h = harness({
      "https://lichess.org/x": [
        () => new Response("slow down", { status: 429 }),
        () => new Response("ok"),
      ],
    });
    await expect(h.client.get("https://lichess.org/x", "text/plain")).resolves.toBe("ok");
    expect(h.calls).toHaveLength(2);
    expect(h.calls[1].at - h.calls[0].at).toBeGreaterThanOrEqual(60_000);
  });

  it("sends no auth header, no cookie and no personal identifier", async () => {
    const h = harness({ "https://lichess.org/a": [new Response("A")] });
    await h.client.get("https://lichess.org/a", "application/x-ndjson");
    const init = h.calls[0].init ?? {};
    const headers = new Headers(init.headers);
    expect(headers.has("authorization")).toBe(false);
    expect(headers.has("cookie")).toBe(false);
    expect(init.credentials).not.toBe("include");
    expect(headers.get("accept")).toBe("application/x-ndjson");
    const ua = headers.get("user-agent") ?? "";
    expect(ua).toMatch(/^liem-sparring-baseline\//);
    expect(ua).not.toMatch(/@|github|iamphduc/i);
  });

  it("a cached download is read back without a request", async () => {
    const store = new Map<string, string>();
    const cache = {
      read: async (k: string) => store.get(k) ?? null,
      write: async (k: string, v: string) => void store.set(k, v),
    };
    const h = harness({ "https://lichess.org/a": [new Response("A")] }, cache);
    expect(await h.client.get("https://lichess.org/a", "text/plain")).toBe("A");
    expect(await h.client.get("https://lichess.org/a", "text/plain")).toBe("A");
    expect(h.calls).toHaveLength(1);
    expect([...store.keys()].every((k) => /^[A-Za-z0-9._-]+$/.test(k))).toBe(true);
  });

  it("the user games URL asks for rated, analysed blitz and rapid with evals and accuracy", () => {
    const url = new URL(userGamesUrl("Some_User", 30));
    expect(url.origin + url.pathname).toBe("https://lichess.org/api/games/user/Some_User");
    const q = url.searchParams;
    expect(q.get("rated")).toBe("true");
    expect(q.get("analysed")).toBe("true");
    expect(q.get("evals")).toBe("true");
    expect(q.get("accuracy")).toBe("true");
    expect(q.get("perfType")).toBe("blitz,rapid");
    expect(q.get("max")).toBe("30");
  });
});
