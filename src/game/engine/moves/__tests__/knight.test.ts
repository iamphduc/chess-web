import { describe, it, expect } from "vitest";
import { PieceType } from "../../../piece-type";
import { GameState } from "../../game-state";
import { knightMoves } from "../knight";

/** Build a minimal GameState with only the specified squares occupied. */
function makeState(
  occupied: { y: number; x: number; piece: PieceType }[],
  turn: "white" | "black" = "white"
): GameState {
  const squares: (PieceType | null)[][] = Array.from({ length: 8 }, () =>
    Array(8).fill(null)
  );
  for (const { y, x, piece } of occupied) {
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

describe("knightMoves", () => {
  it("centre knight yields all eight targets", () => {
    // Place a white knight at [3,3] (centre-ish), all other squares empty.
    const state = makeState([
      { y: 3, x: 3, piece: PieceType.WhiteKingKnight },
    ]);
    const moves = knightMoves(state, [3, 3]);
    expect(moves).toHaveLength(8);
    // Every move must originate from [3,3].
    for (const m of moves) {
      expect(m.from).toEqual([3, 3]);
    }
    // Check the eight expected destinations.
    const destinations = moves.map((m) => m.to);
    expect(destinations).toContainEqual([1, 2]);
    expect(destinations).toContainEqual([1, 4]);
    expect(destinations).toContainEqual([2, 1]);
    expect(destinations).toContainEqual([2, 5]);
    expect(destinations).toContainEqual([4, 1]);
    expect(destinations).toContainEqual([4, 5]);
    expect(destinations).toContainEqual([5, 2]);
    expect(destinations).toContainEqual([5, 4]);
  });

  it("corner knight at [0,0] yields exactly two moves and no off-board square", () => {
    const state = makeState([
      { y: 0, x: 0, piece: PieceType.WhiteKingKnight },
    ]);
    const moves = knightMoves(state, [0, 0]);
    expect(moves).toHaveLength(2);
    // Every destination must be in-bounds.
    for (const m of moves) {
      const [y, x] = m.to;
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(8);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(8);
    }
    // The only reachable squares from [0,0] are [1,2] and [2,1].
    const destinations = moves.map((m) => m.to);
    expect(destinations).toContainEqual([1, 2]);
    expect(destinations).toContainEqual([2, 1]);
  });

  it("friendly-occupied targets are excluded", () => {
    // White knight at [3,3]; white pieces blocking two L-targets.
    const state = makeState([
      { y: 3, x: 3, piece: PieceType.WhiteKingKnight },
      { y: 1, x: 2, piece: PieceType.WhitePawnA }, // friendly blocker
      { y: 2, x: 5, piece: PieceType.WhitePawnB }, // friendly blocker
    ]);
    const moves = knightMoves(state, [3, 3]);
    // Two of the eight targets are friendly → 6 moves remain.
    expect(moves).toHaveLength(6);
    const destinations = moves.map((m) => m.to);
    expect(destinations).not.toContainEqual([1, 2]);
    expect(destinations).not.toContainEqual([2, 5]);
  });

  it("enemy-occupied target is included as a capture", () => {
    // White knight at [3,3]; black piece on one L-target.
    const state = makeState([
      { y: 3, x: 3, piece: PieceType.WhiteKingKnight },
      { y: 1, x: 2, piece: PieceType.BlackPawnA }, // enemy
    ]);
    const moves = knightMoves(state, [3, 3]);
    // All eight targets reachable — enemy square is a capture.
    expect(moves).toHaveLength(8);
    const destinations = moves.map((m) => m.to);
    expect(destinations).toContainEqual([1, 2]);
  });

  it("handles a promoted knight id via pieceKind (smoke)", () => {
    // Promoted white knight at [3,3] — should behave identically.
    const state = makeState([
      { y: 3, x: 3, piece: PieceType.WhiteKnightPromoted1 },
    ]);
    const moves = knightMoves(state, [3, 3]);
    expect(moves).toHaveLength(8);
  });
});
