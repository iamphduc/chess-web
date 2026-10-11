import { describe, expect, it } from "vitest";
import { bookUrl } from "../players/book-urls";
import playerJson from "../players/le-quang-liem/player.json";
import { LIEM } from "../players/index";
import { BookLoadError, createBookLoader, type FetchBook } from "../players/load-books";
import type { Book, BookName, PlayerEntry } from "../types";

const ENTRY = LIEM.entry;
const URLS: Record<BookName, string> = { slow: "/x/slow.json", online: "/x/online.json" };
const url = (entry: PlayerEntry, name: BookName) => `${entry.id}:${URLS[name]}`;

function book(name: BookName, player = ENTRY.id): Book {
  return {
    format: 1,
    player,
    book: name,
    minGames: 2,
    games: 1,
    gamesBySource: { otb: 1, lichess: 0, chesscom: 0 },
    positions: { k: [["e2e4", 1, 0, 0, 1, 0, 0]] },
  };
}

type Reply =
  | { ok: true; body: unknown }
  | { ok: false; status: number }
  | { throws: Error }
  | { badJson: true };

/** A fetch that answers each URL by hand: `answer(url, reply)`. */
function fakeFetch() {
  const calls: string[] = [];
  const waiting = new Map<string, (r: Reply) => void>();
  const fetch: FetchBook = (u) => {
    calls.push(u);
    return new Promise((resolve, reject) => {
      waiting.set(u, (r) => {
        if ("throws" in r) reject(r.throws);
        else if ("badJson" in r)
          resolve({ ok: true, status: 200, json: () => Promise.reject(new SyntaxError("Unexpected token <")) });
        else if (r.ok) resolve({ ok: true, status: 200, json: () => Promise.resolve(structuredClone(r.body)) });
        else resolve({ ok: false, status: r.status, json: () => Promise.reject(new Error("no body")) });
      });
    });
  };
  function answer(name: BookName, reply: Reply) {
    const key = url(ENTRY, name);
    const respond = waiting.get(key);
    if (!respond) throw new Error(`no fetch waiting for ${key}`);
    waiting.delete(key);
    respond(reply);
  }
  const good = (name: BookName): Reply => ({ ok: true, body: book(name) });
  return { fetch, calls, answer, good };
}

async function failure(p: Promise<unknown>): Promise<BookLoadError> {
  try {
    await p;
  } catch (error) {
    expect(error).toBeInstanceOf(BookLoadError);
    return error as BookLoadError;
  }
  throw new Error("expected a rejection");
}

describe("createBookLoader", () => {
  it("loads both books or fails", async () => {
    // Both fetches start before either answers, and the books come back parsed.
    const f = fakeFetch();
    const loader = createBookLoader({ fetch: f.fetch, url });
    const loading = loader.load(ENTRY);
    expect([...f.calls].sort()).toEqual([url(ENTRY, "online"), url(ENTRY, "slow")]);
    f.answer("online", f.good("online"));
    f.answer("slow", f.good("slow"));
    expect(await loading).toEqual({ slow: book("slow"), online: book("online") });

    const cases: [BookName, Reply, RegExp][] = [
      ["slow", { ok: false, status: 404 }, /404/],
      ["online", { throws: new TypeError("Failed to fetch") }, /Failed to fetch/],
      ["slow", { badJson: true }, /Unexpected token/],
      ["online", { ok: true, body: { format: 2 } }, /format/],
      ["online", { ok: true, body: book("slow") }, /slow/],
      ["slow", { ok: true, body: book("slow", "someone-else") }, /someone-else/],
    ];
    for (const [bad, reply, why] of cases) {
      const g = fakeFetch();
      const pending = failure(createBookLoader({ fetch: g.fetch, url }).load(ENTRY));
      const other: BookName = bad === "slow" ? "online" : "slow";
      g.answer(other, g.good(other));
      g.answer(bad, reply);
      const error = await pending;
      expect(error.book, JSON.stringify(reply)).toBe(bad);
      expect(error.message).toContain(bad);
      expect(error.message).toMatch(why);
    }
  });

  it("caches success and retries after failure", async () => {
    const f = fakeFetch();
    const loader = createBookLoader({ fetch: f.fetch, url });

    // A failure is not cached: the next load fetches both books again.
    const first = failure(loader.load(ENTRY));
    f.answer("slow", { ok: false, status: 500 });
    f.answer("online", f.good("online"));
    await first;
    expect(f.calls).toHaveLength(2);

    const second = loader.load(ENTRY);
    expect(f.calls).toHaveLength(4);
    f.answer("slow", f.good("slow"));
    f.answer("online", f.good("online"));
    const books = await second;

    // A success is cached: no more fetches, the same books.
    expect(await loader.load(ENTRY)).toBe(books);
    expect(f.calls).toHaveLength(4);
  });

  it("shares one fetch between loads that overlap", async () => {
    const f = fakeFetch();
    const loader = createBookLoader({ fetch: f.fetch, url });
    const a = loader.load(ENTRY);
    const b = loader.load(ENTRY);
    expect(f.calls).toHaveLength(2);
    f.answer("slow", f.good("slow"));
    f.answer("online", f.good("online"));
    expect(await b).toBe(await a);
  });
});

describe("bookUrl", () => {
  it("book URLs for each book", () => {
    const entry: PlayerEntry = playerJson;
    for (const name of ["slow", "online"] as const) {
      const u = bookUrl(entry, name);
      expect(typeof u).toBe("string");
      expect(u.endsWith(`/${entry.books[name]}`), u).toBe(true);
      expect(u).toContain(entry.id);
    }
    expect(bookUrl(entry, "slow")).not.toBe(bookUrl(entry, "online"));
  });

  it("throws for a player with no committed book", () => {
    const ghost = { ...LIEM.entry, id: "nobody" };
    expect(() => bookUrl(ghost, "slow")).toThrow(/nobody/);
  });

  it("a load for such a player rejects BookLoadError, not a thrown error", async () => {
    const ghost = { ...LIEM.entry, id: "nobody" };
    const f = fakeFetch();
    const loader = createBookLoader({ fetch: f.fetch, url: bookUrl });
    let load!: Promise<unknown>;
    expect(() => (load = loader.load(ghost))).not.toThrow();
    const error = await failure(load);
    expect(error.message).toMatch(/nobody/);
    expect(f.calls).toEqual([]);
  });
});
