import { describe, it, expect } from "vitest";

import { PieceType } from "../../piece-type";
import { GameState, initialGameState } from "../game-state";

describe("initialGameState", () => {
  it("places the standard starting position", () => {
    const { squares } = initialGameState();

    // Black back rank (row 0)
    expect(squares[0]).toEqual([
      PieceType.BlackQueenRook,
      PieceType.BlackQueenKnight,
      PieceType.BlackQueenBishop,
      PieceType.BlackQueen,
      PieceType.BlackKing,
      PieceType.BlackKingBishop,
      PieceType.BlackKingKnight,
      PieceType.BlackKingRook,
    ]);

    // Black pawns (row 1)
    expect(squares[1]).toEqual([
      PieceType.BlackPawnA,
      PieceType.BlackPawnB,
      PieceType.BlackPawnC,
      PieceType.BlackPawnD,
      PieceType.BlackPawnE,
      PieceType.BlackPawnF,
      PieceType.BlackPawnG,
      PieceType.BlackPawnH,
    ]);

    // Empty middle (rows 2-5)
    for (let y = 2; y <= 5; y++) {
      expect(squares[y]).toEqual([null, null, null, null, null, null, null, null]);
    }

    // White pawns (row 6)
    expect(squares[6]).toEqual([
      PieceType.WhitePawnA,
      PieceType.WhitePawnB,
      PieceType.WhitePawnC,
      PieceType.WhitePawnD,
      PieceType.WhitePawnE,
      PieceType.WhitePawnF,
      PieceType.WhitePawnG,
      PieceType.WhitePawnH,
    ]);

    // White back rank (row 7)
    expect(squares[7]).toEqual([
      PieceType.WhiteQueenRook,
      PieceType.WhiteQueenKnight,
      PieceType.WhiteQueenBishop,
      PieceType.WhiteQueen,
      PieceType.WhiteKing,
      PieceType.WhiteKingBishop,
      PieceType.WhiteKingKnight,
      PieceType.WhiteKingRook,
    ]);
  });

  it("is an 8x8 grid", () => {
    const { squares } = initialGameState();
    expect(squares).toHaveLength(8);
    for (const row of squares) {
      expect(row).toHaveLength(8);
    }
  });

  it("carries no presentation flags on the grid (presentation-free)", () => {
    const { squares } = initialGameState();
    // Every cell is a bare PieceType or null, never a { pieceType, isEnemyAttacked } object.
    for (const row of squares) {
      for (const cell of row) {
        expect(typeof cell === "string" || cell === null).toBe(true);
      }
    }
  });

  it("starts with white to move", () => {
    expect(initialGameState().turn).toBe("white");
  });

  it("grants full castling rights to both sides", () => {
    expect(initialGameState().castling).toEqual({
      white: { kingSide: true, queenSide: true },
      black: { kingSide: true, queenSide: true },
    });
  });

  it("has no en-passant target", () => {
    expect(initialGameState().enPassant).toBeNull();
  });

  it("zeroes every promotion counter (8 entries)", () => {
    expect(initialGameState().promotionCount).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });
});

describe("initialGameState fresh-value guarantee", () => {
  it("returns a non-aliased top-level object each call", () => {
    expect(initialGameState()).not.toBe(initialGameState());
  });

  it("does not share the squares grid between calls", () => {
    const a = initialGameState();
    const b = initialGameState();
    expect(a.squares).not.toBe(b.squares);
    // Nested rows are independent too.
    expect(a.squares[0]).not.toBe(b.squares[0]);
  });

  it("does not share castling / promotionCount references between calls", () => {
    const a = initialGameState();
    const b = initialGameState();
    expect(a.castling).not.toBe(b.castling);
    expect(a.castling.white).not.toBe(b.castling.white);
    expect(a.promotionCount).not.toBe(b.promotionCount);
  });

  it("mutating one result leaves a fresh result untouched", () => {
    const a = initialGameState();
    // @ts-expect-error -- deliberately bypass readonly to prove no shared aliasing.
    a.squares[6][4] = null;
    // @ts-expect-error -- same.
    a.promotionCount[0] = 99;

    const fresh = initialGameState();
    expect(fresh.squares[6][4]).toBe(PieceType.WhitePawnE);
    expect(fresh.promotionCount[0]).toBe(0);
  });

  it("exposes the GameState type with the documented fields", () => {
    const state: GameState = initialGameState();
    const keys = Object.keys(state).sort();
    expect(keys).toEqual(
      ["castling", "enPassant", "promotionCount", "squares", "turn"].sort()
    );
  });
});
