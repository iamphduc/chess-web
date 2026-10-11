import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { buildBook, buildBooks, MAX_BOOK_BYTES, serializeBook } from "../build-book";
import { ImportedGame, selectGames, splitPgn } from "../games";
import type { Book } from "../../../src/game/opponent/types";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -";
const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -";

const g = (
  color: ImportedGame["color"],
  result: ImportedGame["result"],
  source: ImportedGame["source"],
  moves: string[],
  book: ImportedGame["book"] = "slow"
): ImportedGame => ({ color, result, source, moves, book });

const GAMES: ImportedGame[] = [
  g("white", "win", "otb", ["e2e4", "e7e5", "g1f3"]),
  g("white", "draw", "lichess", ["e2e4", "c7c5", "g1f3"]),
  g("white", "loss", "chesscom", ["d2d4", "d7d5"]),
  g("black", "win", "otb", ["e2e4", "e7e5"]),
  g("black", "loss", "chesscom", ["d2d4", "g8f6"]),
  g("black", "draw", "lichess", ["e2e4", "c7c5"]),
  g("white", "win", "otb", ["c2c4"], "online"),
  g("white", "win", "otb", [], "slow"),
];

const slow = (games = GAMES, minGames?: number, maxBytes?: number) =>
  buildBook(games, { player: "le-quang-liem", book: "slow", minGames, maxBytes });

describe("builds counts from fixture games", () => {
  it("stores his moves at positions he is to move, with results and sources", () => {
    const book = slow();
    expect(book.format).toBe(1);
    expect(book.player).toBe("le-quang-liem");
    expect(book.book).toBe("slow");
    expect(book.minGames).toBe(2);
    expect(book.positions[START]).toEqual([
      ["e2e4", 1, 1, 0, 1, 1, 0],
      ["d2d4", 0, 0, 1, 0, 0, 1],
    ]);
    // Ties sort by UCI: c7c5 before e7e5.
    expect(book.positions[AFTER_E4]).toEqual([
      ["c7c5", 0, 1, 0, 0, 1, 0],
      ["e7e5", 1, 0, 0, 1, 0, 0],
    ]);
  });

  it("counts every game in the book, including one with no moves, and nothing from the other book", () => {
    const book = slow();
    expect(book.games).toBe(7);
    expect(book.gamesBySource).toEqual({ otb: 3, lichess: 2, chesscom: 2 });
    expect(JSON.stringify(book.positions)).not.toContain("c2c4");
  });

  it("drops positions below minGames: a 1-game position is absent at 2 and present at 1", () => {
    expect(Object.keys(slow().positions).sort()).toEqual([AFTER_E4, START].sort());
    const loose = slow(GAMES, 1);
    expect(loose.minGames).toBe(1);
    // After 1.d4 (him Black, 1 game) and after 1.e4 e5 / 1.e4 c5 (him White, 1 game each).
    expect(Object.keys(loose.positions)).toHaveLength(5);
  });

  it("counts a position once per game when it repeats", () => {
    const shuffle = g("white", "win", "otb", ["g1f3", "g8f6", "f3g1", "f6g8", "e2e4"]);
    const book = slow([shuffle], 1);
    expect(book.positions[START]).toEqual([["g1f3", 1, 0, 0, 1, 0, 0]]);
  });

  it("keeps the move invariant: win + draw + loss = otb + lichess + chesscom", () => {
    const positions = Object.values(slow(GAMES, 1).positions);
    expect(positions.flat()).toHaveLength(7);
    for (const moves of positions) {
      for (const [, w, d, l, o, li, c] of moves) expect(w + d + l).toBe(o + li + c);
    }
  });

  it("an empty input gives a valid empty book", () => {
    expect(slow([])).toEqual({
      format: 1,
      player: "le-quang-liem",
      book: "slow",
      minGames: 2,
      games: 0,
      gamesBySource: { otb: 0, lichess: 0, chesscom: 0 },
      positions: {},
    });
  });

  it("buildBooks splits games by their book", () => {
    const books = buildBooks(GAMES, { player: "le-quang-liem" });
    expect(books.slow.games).toBe(7);
    expect(books.online.games).toBe(1);
    expect(books.online.book).toBe("online");
  });
});

describe("deterministic and free of raw game data", () => {
  it("the same games in any order give byte-identical JSON with sorted keys", () => {
    const a = serializeBook(slow(GAMES, 1));
    const b = serializeBook(slow([...GAMES].reverse(), 1));
    expect(a).toBe(b);
    expect(a.endsWith("\n")).toBe(true);
    const parsed = JSON.parse(a) as Book;
    expect(Object.keys(parsed)).toEqual([...Object.keys(parsed)].sort());
    expect(Object.keys(parsed.positions)).toEqual([...Object.keys(parsed.positions)].sort());
    expect(Object.keys(parsed.gamesBySource)).toEqual(["chesscom", "lichess", "otb"]);
    expect(parsed).toEqual(slow(GAMES, 1));
  });

  it("holds no names, dates, events or sites from the fixture games", () => {
    const files = ["otb.pgn", "lichess.pgn", "chesscom.pgn"].map((name, i) => ({
      source: (["otb", "lichess", "chesscom"] as const)[i],
      text: readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"),
    }));
    const { games } = selectGames(files, {
      fideId: 12401137,
      aliases: ["Le Quang Liem", "Le, Quang Liem"],
      accounts: { lichess: "fixtureuser", chesscom: "liemle" },
    });
    const books = buildBooks(games, { player: "le-quang-liem", minGames: 1 });
    const out = serializeBook(books.slow) + serializeBook(books.online);
    expect(Object.keys(JSON.parse(serializeBook(books.slow)).positions).length).toBeGreaterThan(0);
    const tagValues = files
      .flatMap((f) => splitPgn(f.text))
      .flatMap((pgn) => [...pgn.matchAll(/^\[(\w+) "([^"]*)"\]/gm)])
      .filter(([, tag]) => !["Result", "TimeControl", "Variant", "SetUp", "FEN"].includes(tag))
      .map(([, , value]) => value)
      .filter((v) => v.length > 2);
    expect(tagValues.length).toBeGreaterThan(20);
    for (const value of tagValues) expect(out).not.toContain(value);
    expect(out).not.toMatch(/\d{4}\.\d{2}\.\d{2}/);
  });
});

describe("size budget raises minGames", () => {
  it("defaults to 3 MB", () => {
    expect(MAX_BOOK_BYTES).toBe(3 * 1024 * 1024);
  });

  it("raises minGames until the book fits and records the value used", () => {
    const many = [...GAMES, ...GAMES.slice(0, 2)]; // start position now has 4 games
    const at3 = Buffer.byteLength(serializeBook(slow(many, 3)));
    const at2 = Buffer.byteLength(serializeBook(slow(many, 2)));
    expect(at2).toBeGreaterThan(at3);
    const fitted = slow(many, 2, at3);
    expect(fitted.minGames).toBe(3);
    expect(Buffer.byteLength(serializeBook(fitted))).toBeLessThanOrEqual(at3);
    expect(slow(many, 2, at2).minGames).toBe(2);
  });

  it("fails when even an empty book is over the budget", () => {
    expect(() => slow(GAMES, 2, 10)).toThrow(/budget/);
  });
});
