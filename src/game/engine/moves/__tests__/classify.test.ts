import { describe, it, expect } from "vitest";
import { initialGameState } from "../../game-state";
import { PieceType } from "../../../piece-type";
import {
  pieceKind,
  colorOf,
  inBounds,
  occupant,
  relationTo,
  BISHOP_DIRS,
  ROOK_DIRS,
  QUEEN_DIRS,
  KNIGHT_OFFSETS,
  KING_OFFSETS,
} from "../classify";

describe("pieceKind", () => {
  it("classifies base pieces", () => {
    expect(pieceKind(PieceType.WhitePawnA)).toBe("pawn");
    expect(pieceKind(PieceType.BlackPawnH)).toBe("pawn");
    expect(pieceKind(PieceType.WhiteKingKnight)).toBe("knight");
    expect(pieceKind(PieceType.BlackQueenKnight)).toBe("knight");
    expect(pieceKind(PieceType.WhiteKingBishop)).toBe("bishop");
    expect(pieceKind(PieceType.BlackQueenBishop)).toBe("bishop");
    expect(pieceKind(PieceType.WhiteQueenRook)).toBe("rook");
    expect(pieceKind(PieceType.BlackKingRook)).toBe("rook");
    expect(pieceKind(PieceType.WhiteQueen)).toBe("queen");
    expect(pieceKind(PieceType.BlackQueen)).toBe("queen");
    expect(pieceKind(PieceType.WhiteKing)).toBe("king");
    expect(pieceKind(PieceType.BlackKing)).toBe("king");
  });

  it("classifies promoted pieces to their base kind", () => {
    expect(pieceKind(PieceType.WhiteKnightPromoted1)).toBe("knight");
    expect(pieceKind(PieceType.BlackKnightPromoted4)).toBe("knight");
    expect(pieceKind(PieceType.WhiteBishopPromoted2)).toBe("bishop");
    expect(pieceKind(PieceType.BlackBishopPromoted3)).toBe("bishop");
    expect(pieceKind(PieceType.WhiteRookPromoted3)).toBe("rook");
    expect(pieceKind(PieceType.BlackRookPromoted1)).toBe("rook");
    expect(pieceKind(PieceType.WhiteQueenPromoted4)).toBe("queen");
    expect(pieceKind(PieceType.BlackQueenPromoted2)).toBe("queen");
  });
});

describe("colorOf", () => {
  it("reads the WHITE_/BLACK_ prefix", () => {
    expect(colorOf(PieceType.WhiteKing)).toBe("white");
    expect(colorOf(PieceType.WhitePawnA)).toBe("white");
    expect(colorOf(PieceType.WhiteQueenPromoted1)).toBe("white");
    expect(colorOf(PieceType.BlackKing)).toBe("black");
    expect(colorOf(PieceType.BlackPawnH)).toBe("black");
    expect(colorOf(PieceType.BlackRookPromoted2)).toBe("black");
  });
});

describe("inBounds", () => {
  it("accepts every on-board square including all four edges", () => {
    expect(inBounds(0, 0)).toBe(true);
    expect(inBounds(0, 7)).toBe(true);
    expect(inBounds(7, 0)).toBe(true);
    expect(inBounds(7, 7)).toBe(true);
    expect(inBounds(4, 3)).toBe(true);
  });

  it("rejects off-board coordinates on BOTH axes (off-by-axis regression seed)", () => {
    // The old engine had a bug where the x-axis check read `toY < 8` instead
    // of `toX < 8`. These two assertions make that class of bug impossible to
    // reproduce: both axes must be independently bounded.
    expect(inBounds(0, 8)).toBe(false);
    expect(inBounds(8, 0)).toBe(false);
    expect(inBounds(-1, 0)).toBe(false);
    expect(inBounds(0, -1)).toBe(false);
    expect(inBounds(-1, -1)).toBe(false);
    expect(inBounds(8, 8)).toBe(false);
  });
});

describe("occupant", () => {
  it("returns the piece on an occupied square and null on empty", () => {
    const state = initialGameState();
    // Row 0 is Black's back rank; [0,4] is the Black king.
    expect(occupant(state, 0, 4)).toBe(PieceType.BlackKing);
    // Row 6 is White's pawns.
    expect(occupant(state, 6, 0)).toBe(PieceType.WhitePawnA);
    // Rows 2-5 are empty.
    expect(occupant(state, 4, 4)).toBeNull();
  });

  it("returns null for off-board coordinates", () => {
    const state = initialGameState();
    expect(occupant(state, -1, 0)).toBeNull();
    expect(occupant(state, 0, 8)).toBeNull();
    expect(occupant(state, 8, 0)).toBeNull();
  });
});

describe("relationTo", () => {
  it("classifies empty, friendly and enemy targets from the mover's view", () => {
    expect(relationTo("white", null)).toBe("empty");
    expect(relationTo("white", PieceType.WhitePawnA)).toBe("friendly");
    expect(relationTo("white", PieceType.BlackPawnA)).toBe("enemy");
    expect(relationTo("black", null)).toBe("empty");
    expect(relationTo("black", PieceType.BlackQueen)).toBe("friendly");
    expect(relationTo("black", PieceType.WhiteQueen)).toBe("enemy");
  });
});

describe("direction constants", () => {
  it("BISHOP_DIRS are the four diagonals", () => {
    expect([...BISHOP_DIRS].sort()).toEqual(
      [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ].sort()
    );
  });

  it("ROOK_DIRS are the four orthogonals", () => {
    expect([...ROOK_DIRS].sort()).toEqual(
      [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ].sort()
    );
  });

  it("QUEEN_DIRS is bishop union rook (eight rays, no duplicates)", () => {
    expect(QUEEN_DIRS).toHaveLength(8);
    for (const d of BISHOP_DIRS) {
      expect(QUEEN_DIRS).toContainEqual(d);
    }
    for (const d of ROOK_DIRS) {
      expect(QUEEN_DIRS).toContainEqual(d);
    }
  });

  it("KNIGHT_OFFSETS are the eight L-shapes", () => {
    expect(KNIGHT_OFFSETS).toHaveLength(8);
    for (const [dy, dx] of KNIGHT_OFFSETS) {
      expect(Math.abs(dy) + Math.abs(dx)).toBe(3);
      expect(Math.abs(dy)).toBeGreaterThanOrEqual(1);
      expect(Math.abs(dx)).toBeGreaterThanOrEqual(1);
    }
  });

  it("KING_OFFSETS are the eight neighbours (no zero vector)", () => {
    expect(KING_OFFSETS).toHaveLength(8);
    for (const [dy, dx] of KING_OFFSETS) {
      expect(dy === 0 && dx === 0).toBe(false);
      expect(Math.abs(dy)).toBeLessThanOrEqual(1);
      expect(Math.abs(dx)).toBeLessThanOrEqual(1);
    }
  });
});
