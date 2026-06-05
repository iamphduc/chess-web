import { describe, it, expect } from "vitest";
import { GameState, EngineSquare, PieceColor } from "../../game-state";
import { Position } from "../../engine";
import { PieceType } from "../../../piece-type";
import { slidingMoves } from "../sliding";

/** Build a GameState with a custom 8x8 grid, defaulting every square to empty. */
function makeState(
  placements: { square: Position; piece: EngineSquare }[],
  turn: PieceColor = "white"
): GameState {
  const squares: EngineSquare[][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => null as EngineSquare)
  );
  for (const { square, piece } of placements) {
    const [y, x] = square;
    squares[y][x] = piece;
  }
  return {
    squares,
    turn,
    castling: {
      white: { kingSide: true, queenSide: true },
      black: { kingSide: true, queenSide: true },
    },
    enPassant: null,
    promotionCount: [0, 0, 0, 0, 0, 0, 0, 0],
  };
}

/** Sorted, stringified set of destination squares for stable comparison. */
function destinations(state: GameState, from: Position): string[] {
  return slidingMoves(state, from)
    .map((m) => `${m.to[0]},${m.to[1]}`)
    .sort();
}

describe("slidingMoves — bishop", () => {
  it("reaches all four diagonals to the edge from the centre of an open board", () => {
    // Bishop on [3,3] (a promoted bishop to also prove pieceKind handling).
    const state = makeState([
      { square: [3, 3], piece: PieceType.WhiteBishopPromoted1 },
    ]);
    const dests = destinations(state, [3, 3]);

    const expected = [
      // up-left
      [2, 2],
      [1, 1],
      [0, 0],
      // up-right
      [2, 4],
      [1, 5],
      [0, 6],
      // down-left
      [4, 2],
      [5, 1],
      [6, 0],
      // down-right
      [4, 4],
      [5, 5],
      [6, 6],
      [7, 7],
    ]
      .map(([y, x]) => `${y},${x}`)
      .sort();

    expect(dests).toEqual(expected);
  });

  it("emits every move from the bishop's own square", () => {
    const state = makeState([
      { square: [3, 3], piece: PieceType.WhiteKingBishop },
    ]);
    for (const m of slidingMoves(state, [3, 3])) {
      expect(m.from).toEqual([3, 3]);
    }
  });
});

describe("slidingMoves — rook", () => {
  it("stops before a friendly piece and captures an enemy but not beyond it", () => {
    // Rook on [4,4].
    // Friendly pawn at [4,6] blocks the +x ray: [4,5] is reachable, [4,6]+ not.
    // Enemy pawn at [1,4] is a capture on the -y ray: [3,4],[2,4],[1,4] reachable,
    //   [0,4] (beyond the enemy) is NOT.
    const state = makeState([
      { square: [4, 4], piece: PieceType.WhiteQueenRook },
      { square: [4, 6], piece: PieceType.WhitePawnA },
      { square: [1, 4], piece: PieceType.BlackPawnA },
    ]);
    const dests = destinations(state, [4, 4]);

    // +x ray stops before the friendly piece at [4,6].
    expect(dests).toContain("4,5");
    expect(dests).not.toContain("4,6");
    expect(dests).not.toContain("4,7");

    // -y ray captures the enemy at [1,4] but not beyond.
    expect(dests).toContain("3,4");
    expect(dests).toContain("2,4");
    expect(dests).toContain("1,4");
    expect(dests).not.toContain("0,4");
  });
});

describe("slidingMoves — queen", () => {
  it("equals bishop union rook from the same square", () => {
    const placeQueen: { square: Position; piece: EngineSquare }[] = [
      { square: [3, 3], piece: PieceType.WhiteQueen },
    ];
    const placeBishop: { square: Position; piece: EngineSquare }[] = [
      { square: [3, 3], piece: PieceType.WhiteKingBishop },
    ];
    const placeRook: { square: Position; piece: EngineSquare }[] = [
      { square: [3, 3], piece: PieceType.WhiteQueenRook },
    ];

    const queenDests = destinations(makeState(placeQueen), [3, 3]);
    const bishopDests = destinations(makeState(placeBishop), [3, 3]);
    const rookDests = destinations(makeState(placeRook), [3, 3]);

    const union = Array.from(new Set([...bishopDests, ...rookDests])).sort();
    expect(queenDests).toEqual(union);
  });
});

describe("slidingMoves — board edges", () => {
  it("emits no off-board square on rays heading toward the x===8 and y===8 edges", () => {
    // Rook at [7,7]: the +y ray (toward y===8) and +x ray (toward x===8) must
    // not emit any off-board square. An axis-confused bound would surface here.
    const state = makeState([
      { square: [7, 7], piece: PieceType.WhiteQueenRook },
    ]);
    const dests = destinations(state, [7, 7]);

    // Every destination must be strictly on-board.
    for (const d of dests) {
      const [y, x] = d.split(",").map(Number);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(8);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(8);
    }

    // From [7,7] a rook reaches only the 7th rank and 7th file (7 + 7 squares).
    expect(dests).toHaveLength(14);
    expect(dests).toContain("7,0");
    expect(dests).toContain("0,7");
  });

  it("bishop at the corner toward both far edges emits no off-board square", () => {
    // Bishop at [7,7]: its only ray runs up-left; the down/right directions are
    // immediately off-board and must contribute nothing.
    const state = makeState([
      { square: [7, 7], piece: PieceType.WhiteKingBishop },
    ]);
    const dests = destinations(state, [7, 7]);

    expect(dests).toEqual(
      [
        [6, 6],
        [5, 5],
        [4, 4],
        [3, 3],
        [2, 2],
        [1, 1],
        [0, 0],
      ]
        .map(([y, x]) => `${y},${x}`)
        .sort()
    );
  });
});
