import { describe, expect, it } from "vitest";
import { initialGameState } from "../../engine/game-state";
import { bookForClock, lookupBook, pickBookMove, THIN } from "../book";
import { positionKey } from "../position";
import type { Book, BookMove, BookName } from "../types";

/** A book move with all its games from one source (OTB) and all wins. */
function bm(uci: string, games: number): BookMove {
  return [uci, games, 0, 0, games, 0, 0];
}

function makeBook(name: BookName, positions: Record<string, BookMove[]>): Book {
  return {
    format: 1,
    player: "fixture",
    book: name,
    minGames: 1,
    games: 0,
    gamesBySource: { otb: 0, lichess: 0, chesscom: 0 },
    positions,
  };
}

function makeBooks(
  slow: Record<string, BookMove[]> = {},
  online: Record<string, BookMove[]> = {}
): Record<BookName, Book> {
  return { slow: makeBook("slow", slow), online: makeBook("online", online) };
}

const MIN = 60_000;
const SEC = 1000;

describe("bookForClock edges", () => {
  it("splits at an estimate of 900 000 ms (base + 40 x increment)", () => {
    expect(bookForClock({ baseMs: 15 * MIN, incrementMs: 0 })).toBe("slow");
    expect(bookForClock({ baseMs: 15 * MIN - 1, incrementMs: 0 })).toBe("online");
    expect(bookForClock({ baseMs: 10 * MIN, incrementMs: 8 * SEC })).toBe("slow");
    expect(bookForClock({ baseMs: 10 * MIN, incrementMs: 5 * SEC })).toBe("online");
    expect(bookForClock({ baseMs: 3 * MIN, incrementMs: 2 * SEC })).toBe("online");
  });

  it("treats an untimed game as slow", () => {
    expect(bookForClock(null)).toBe("slow");
  });

  it("counts the increment exactly 40 times at the boundary", () => {
    // 500 s + 40 x 10 s = 900 s exactly.
    expect(bookForClock({ baseMs: 500 * SEC, incrementMs: 10 * SEC })).toBe("slow");
    expect(bookForClock({ baseMs: 500 * SEC - 1, incrementMs: 10 * SEC })).toBe("online");
  });
});

describe("thin-line fallback", () => {
  const start = initialGameState();
  const key = positionKey(start);
  const slowClock = null;
  const onlineClock = { baseMs: 3 * MIN, incrementMs: 2 * SEC };

  it("THIN is 3", () => {
    expect(THIN).toBe(3);
  });

  it("uses the clock's book once it has 3 games", () => {
    const books = makeBooks(
      { [key]: [bm("e2e4", 2), bm("d2d4", 1)] },
      { [key]: [bm("c2c4", 50)] }
    );
    expect(lookupBook(books, start, slowClock)).toEqual({
      book: "slow",
      moves: [bm("e2e4", 2), bm("d2d4", 1)],
      games: 3,
    });
  });

  it("at 2 games falls back to the other book when it has 3", () => {
    const books = makeBooks(
      { [key]: [bm("e2e4", 3)] },
      { [key]: [bm("c2c4", 2)] }
    );
    expect(lookupBook(books, start, onlineClock)).toEqual({
      book: "slow",
      moves: [bm("e2e4", 3)],
      games: 3,
    });
  });

  it("when both are thin, picks the larger", () => {
    const books = makeBooks(
      { [key]: [bm("e2e4", 1)] },
      { [key]: [bm("c2c4", 2)] }
    );
    expect(lookupBook(books, start, slowClock)?.book).toBe("online");
    expect(lookupBook(books, start, slowClock)?.games).toBe(2);
  });

  it("when both are thin and tied, keeps the clock's book", () => {
    const books = makeBooks(
      { [key]: [bm("e2e4", 2)] },
      { [key]: [bm("c2c4", 2)] }
    );
    expect(lookupBook(books, start, slowClock)?.book).toBe("slow");
    expect(lookupBook(books, start, onlineClock)?.book).toBe("online");
  });

  it("keeps a single game in the only book that has one", () => {
    const books = makeBooks({}, { [key]: [bm("c2c4", 1)] });
    expect(lookupBook(books, start, slowClock)).toEqual({
      book: "online",
      moves: [bm("c2c4", 1)],
      games: 1,
    });
  });

  it("is null when neither book has the position", () => {
    const books = makeBooks({ other: [bm("e2e4", 9)] }, {});
    expect(lookupBook(books, start, slowClock)).toBeNull();
    expect(lookupBook(makeBooks(), start, onlineClock)).toBeNull();
  });

  it("is null when the stored moves sum to 0 games", () => {
    const books = makeBooks({ [key]: [bm("e2e4", 0)] }, { [key]: [] });
    expect(lookupBook(books, start, slowClock)).toBeNull();
  });
});

describe("weighted pick boundaries", () => {
  const moves = [bm("a", 3), bm("b", 1)];

  it("takes the first move whose running share passes r", () => {
    expect(pickBookMove(moves, () => 0)?.[0]).toBe("a");
    expect(pickBookMove(moves, () => 0.7499)?.[0]).toBe("a");
    expect(pickBookMove(moves, () => 0.75)?.[0]).toBe("b");
    expect(pickBookMove(moves, () => 0.9999)?.[0]).toBe("b");
  });

  it("falls to the last move when random misbehaves (1 or more, NaN)", () => {
    expect(pickBookMove(moves, () => 1)?.[0]).toBe("b");
    expect(pickBookMove(moves, () => NaN)?.[0]).toBe("b");
  });

  it("never picks a 0-game move", () => {
    const withZero = [bm("a", 2), bm("z", 0)];
    expect(pickBookMove(withZero, () => 0.9999)?.[0]).toBe("a");
    expect(pickBookMove(withZero, () => 1)?.[0]).toBe("a");
  });

  it("is null for no moves or no games", () => {
    expect(pickBookMove([], () => 0)).toBeNull();
    expect(pickBookMove([bm("a", 0)], () => 0)).toBeNull();
  });

  it("defaults to Math.random", () => {
    const pick = pickBookMove([bm("only", 1)]);
    expect(pick?.[0]).toBe("only");
  });
});
