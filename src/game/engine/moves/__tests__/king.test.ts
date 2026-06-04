import { describe, it, expect } from "vitest";
import { PieceType } from "../../../piece-type";
import { GameState } from "../../game-state";
import { Position } from "../../engine";
import { kingMoves } from "../king";

/** Build a minimal GameState with only the squares provided. */
function makeState(
  placements: Array<{ y: number; x: number; piece: PieceType }>,
  turn: "white" | "black" = "white"
): GameState {
  const squares: Array<Array<PieceType | null>> = Array.from({ length: 8 }, () =>
    Array(8).fill(null)
  );
  for (const { y, x, piece } of placements) {
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

describe("kingMoves", () => {
  it("centre king yields all eight neighbours", () => {
    // Place white king at [4,4] (centre of board), no other pieces.
    const from: Position = [4, 4];
    const state = makeState([{ y: 4, x: 4, piece: PieceType.WhiteKing }]);
    const moves = kingMoves(state, from);

    expect(moves).toHaveLength(8);
    const tos = moves.map((m) => m.to);
    // All eight neighbours
    expect(tos).toContainEqual([3, 3]);
    expect(tos).toContainEqual([3, 4]);
    expect(tos).toContainEqual([3, 5]);
    expect(tos).toContainEqual([4, 3]);
    expect(tos).toContainEqual([4, 5]);
    expect(tos).toContainEqual([5, 3]);
    expect(tos).toContainEqual([5, 4]);
    expect(tos).toContainEqual([5, 5]);
  });

  it("corner king (0,0) yields exactly three moves with no off-board square", () => {
    const from: Position = [0, 0];
    const state = makeState([{ y: 0, x: 0, piece: PieceType.WhiteKing }]);
    const moves = kingMoves(state, from);

    expect(moves).toHaveLength(3);
    // Every target must be on the board
    for (const { to: [ty, tx] } of moves) {
      expect(ty).toBeGreaterThanOrEqual(0);
      expect(ty).toBeLessThan(8);
      expect(tx).toBeGreaterThanOrEqual(0);
      expect(tx).toBeLessThan(8);
    }
    const tos = moves.map((m) => m.to);
    expect(tos).toContainEqual([0, 1]);
    expect(tos).toContainEqual([1, 0]);
    expect(tos).toContainEqual([1, 1]);
  });

  it("corner king (7,7) yields exactly three moves with no off-board square", () => {
    const from: Position = [7, 7];
    const state = makeState([{ y: 7, x: 7, piece: PieceType.WhiteKing }]);
    const moves = kingMoves(state, from);

    expect(moves).toHaveLength(3);
    for (const { to: [ty, tx] } of moves) {
      expect(ty).toBeGreaterThanOrEqual(0);
      expect(ty).toBeLessThan(8);
      expect(tx).toBeGreaterThanOrEqual(0);
      expect(tx).toBeLessThan(8);
    }
  });

  it("friendly-occupied neighbours are excluded", () => {
    // White king at [4,4]; friendly pawn blocks [3,3] and [3,4].
    const from: Position = [4, 4];
    const state = makeState([
      { y: 4, x: 4, piece: PieceType.WhiteKing },
      { y: 3, x: 3, piece: PieceType.WhitePawnA },
      { y: 3, x: 4, piece: PieceType.WhitePawnB },
    ]);
    const moves = kingMoves(state, from);

    // 8 neighbours - 2 friendly = 6
    expect(moves).toHaveLength(6);
    const tos = moves.map((m) => m.to);
    expect(tos).not.toContainEqual([3, 3]);
    expect(tos).not.toContainEqual([3, 4]);
  });

  it("enemy-occupied neighbour is included as a capture", () => {
    // White king at [4,4]; black pawn at [3,3].
    const from: Position = [4, 4];
    const state = makeState([
      { y: 4, x: 4, piece: PieceType.WhiteKing },
      { y: 3, x: 3, piece: PieceType.BlackPawnA },
    ]);
    const moves = kingMoves(state, from);

    // Still 8 moves — enemy square is captured, not blocked
    expect(moves).toHaveLength(8);
    const tos = moves.map((m) => m.to);
    expect(tos).toContainEqual([3, 3]);
  });

  it("produces no two-square (castling) move", () => {
    // White king at [7,4] (start position), all neighbouring squares clear.
    const from: Position = [7, 4];
    const state = makeState([{ y: 7, x: 4, piece: PieceType.WhiteKing }]);
    const moves = kingMoves(state, from);

    // Castling would land on [7,2] or [7,6] (two squares away)
    for (const { from: [fy, fx], to: [ty, tx] } of moves) {
      const dy = Math.abs(ty - fy);
      const dx = Math.abs(tx - fx);
      expect(dy).toBeLessThanOrEqual(1);
      expect(dx).toBeLessThanOrEqual(1);
    }
    const tos = moves.map((m) => m.to);
    expect(tos).not.toContainEqual([7, 2]);
    expect(tos).not.toContainEqual([7, 6]);
  });

  it("from square is always preserved in every returned move", () => {
    const from: Position = [4, 4];
    const state = makeState([{ y: 4, x: 4, piece: PieceType.WhiteKing }]);
    const moves = kingMoves(state, from);
    for (const move of moves) {
      expect(move.from).toEqual(from);
    }
  });
});
