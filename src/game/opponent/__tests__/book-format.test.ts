import { describe, it, expect } from "vitest";
import { Book, BookMove, moveGames, positionGames } from "../types";

describe("game counts from tuples", () => {
  it("moveGames sums the otb, lichess and chesscom counts", () => {
    const m: BookMove = ["e2e4", 5, 3, 2, 4, 4, 2];
    expect(moveGames(m)).toBe(10);
    expect(moveGames(["d2d4", 0, 0, 1, 0, 0, 1])).toBe(1);
    expect(moveGames(["c2c4", 0, 0, 0, 0, 0, 0])).toBe(0);
  });

  it("reads the source columns, not the result columns", () => {
    // Deliberately breaks the invariant to show which columns are summed.
    expect(moveGames(["e2e4", 9, 9, 9, 1, 2, 3])).toBe(6);
  });

  it("positionGames sums every move at a position", () => {
    const moves: BookMove[] = [
      ["e2e4", 5, 3, 2, 4, 4, 2],
      ["d2d4", 1, 1, 0, 2, 0, 0],
      ["g1f3", 0, 0, 1, 0, 0, 1],
    ];
    expect(positionGames(moves)).toBe(13);
    expect(positionGames([])).toBe(0);
  });

  it("an empty book is a valid Book", () => {
    const empty: Book = {
      format: 1,
      player: "le-quang-liem",
      book: "online",
      minGames: 2,
      games: 0,
      gamesBySource: { otb: 0, lichess: 0, chesscom: 0 },
      positions: {},
    };
    expect(Object.values(empty.positions).map(positionGames)).toEqual([]);
  });
});
