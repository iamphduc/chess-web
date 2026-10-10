import { describe, expect, it } from "vitest";
import { BookError, parseBook } from "../parse-book";
import online from "../players/le-quang-liem/book-online.json";
import slow from "../players/le-quang-liem/book-slow.json";
import type { BookName } from "../types";

// Test-only JSON imports: the app never imports a book (players/load-books.ts fetches them).
const COMMITTED: Record<BookName, unknown> = { slow, online };
const committed = (name: BookName): unknown => structuredClone(COMMITTED[name]);

/** A small valid book; each case below breaks one thing in a fresh copy. */
function valid(): Record<string, unknown> {
  return {
    format: 1,
    player: "le-quang-liem",
    book: "online",
    minGames: 2,
    games: 5,
    gamesBySource: { otb: 1, lichess: 0, chesscom: 4 },
    positions: {
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -": [
        ["e2e4", 2, 1, 0, 1, 0, 2],
        ["d2d4", 1, 0, 1, 0, 0, 2],
      ],
    },
  };
}

type Edit = (b: Record<string, unknown>) => void;
const firstMove = (b: Record<string, unknown>) =>
  Object.values(b.positions as Record<string, unknown[][]>)[0][0];

const BROKEN: [string, Edit][] = [
  ["format 2", (b) => (b.format = 2)],
  ["format missing", (b) => delete b.format],
  ["format as text", (b) => (b.format = "1")],
  ["unknown book name", (b) => (b.book = "blitz")],
  ["player not text", (b) => (b.player = 7)],
  ["minGames 0", (b) => (b.minGames = 0)],
  ["games not an integer", (b) => (b.games = 4.5)],
  ["gamesBySource missing a source", (b) => (b.gamesBySource = { otb: 1, lichess: 4 })],
  ["games not the sum of gamesBySource", (b) => (b.games = 6)],
  ["positions not an object", (b) => (b.positions = [])],
  ["moves not a list", (b) => (b.positions = { k: "e2e4" })],
  ["a position with no moves", (b) => (b.positions = { k: [] })],
  ["a tuple of length 6", (b) => firstMove(b).pop()],
  ["a tuple of length 8", (b) => firstMove(b).push(0)],
  ["a tuple that isn't a list", (b) => (b.positions = { k: [{ uci: "e2e4" }] })],
  ["a uci that isn't text", (b) => (firstMove(b)[0] = 52)],
  ["a negative count", (b) => ((firstMove(b)[1] = -1), (firstMove(b)[4] = -1))],
  ["a non-integer count", (b) => ((firstMove(b)[2] = 1.5), (firstMove(b)[5] = 0.5))],
  ["a count as text", (b) => (firstMove(b)[6] = "2")],
  ["win+draw+loss above the source sum", (b) => (firstMove(b)[1] = 3)],
  ["win+draw+loss below the source sum", (b) => (firstMove(b)[4] = 2)],
];

describe("parseBook", () => {
  it("validates the book shape", () => {
    for (const name of ["slow", "online"] as const) {
      const json = committed(name);
      const copy = structuredClone(json);
      const book = parseBook(json);
      expect(book).toEqual(copy);
      expect(book.book).toBe(name);
    }

    expect(parseBook(valid())).toEqual(valid());

    for (const [label, edit] of BROKEN) {
      const b = valid();
      edit(b);
      expect(() => parseBook(b), label).toThrow(BookError);
    }

    for (const notABook of [null, undefined, 1, "book", [], true]) {
      expect(() => parseBook(notABook), String(notABook)).toThrow(BookError);
    }
  });

  it("names what is wrong in the error message", () => {
    const b = valid();
    firstMove(b).pop();
    expect(() => parseBook(b)).toThrow(/e2e4|length/);
  });

  it("accepts an empty book", () => {
    const b = { ...valid(), games: 0, gamesBySource: { otb: 0, lichess: 0, chesscom: 0 }, positions: {} };
    expect(parseBook(b)).toEqual(b);
  });
});
