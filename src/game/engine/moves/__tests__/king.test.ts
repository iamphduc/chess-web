import { describe, it, expect } from "vitest";
import { PieceType } from "../../../piece-type";
import { CastlingRights, GameState } from "../../game-state";
import { Position, legalMoves, applyMove } from "../../engine";
import { kingMoves } from "../king";

const FULL_RIGHTS: CastlingRights = {
  white: { kingSide: true, queenSide: true },
  black: { kingSide: true, queenSide: true },
};

/** Build a minimal GameState with only the squares provided. */
function makeState(
  placements: Array<{ y: number; x: number; piece: PieceType }>,
  turn: "white" | "black" = "white",
  castling: CastlingRights = FULL_RIGHTS
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
    castling,
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

describe("kingMoves — castling", () => {
  // White home rank is 7 (king [7,4], rooks [7,0]/[7,7]); Black is 0.

  it("white: full rights + clear path → both castles generated", () => {
    const state = makeState([
      { y: 7, x: 4, piece: PieceType.WhiteKing },
      { y: 7, x: 0, piece: PieceType.WhiteQueenRook },
      { y: 7, x: 7, piece: PieceType.WhiteKingRook },
    ]);
    const tos = kingMoves(state, [7, 4]).map((m) => m.to);
    expect(tos).toContainEqual([7, 6]); // king-side
    expect(tos).toContainEqual([7, 2]); // queen-side
  });

  it("black: full rights + clear path → both castles generated", () => {
    const state = makeState(
      [
        { y: 0, x: 4, piece: PieceType.BlackKing },
        { y: 0, x: 0, piece: PieceType.BlackQueenRook },
        { y: 0, x: 7, piece: PieceType.BlackKingRook },
      ],
      "black"
    );
    const tos = kingMoves(state, [0, 4]).map((m) => m.to);
    expect(tos).toContainEqual([0, 6]);
    expect(tos).toContainEqual([0, 2]);
  });

  it("right is false → that castle dropped", () => {
    const state = makeState(
      [
        { y: 7, x: 4, piece: PieceType.WhiteKing },
        { y: 7, x: 0, piece: PieceType.WhiteQueenRook },
        { y: 7, x: 7, piece: PieceType.WhiteKingRook },
      ],
      "white",
      {
        white: { kingSide: false, queenSide: true },
        black: { kingSide: true, queenSide: true },
      }
    );
    const tos = kingMoves(state, [7, 4]).map((m) => m.to);
    expect(tos).not.toContainEqual([7, 6]); // king-side dropped
    expect(tos).toContainEqual([7, 2]); // queen-side still there
  });

  it("king-side path square occupied → king-side dropped", () => {
    const state = makeState([
      { y: 7, x: 4, piece: PieceType.WhiteKing },
      { y: 7, x: 0, piece: PieceType.WhiteQueenRook },
      { y: 7, x: 7, piece: PieceType.WhiteKingRook },
      { y: 7, x: 5, piece: PieceType.WhiteKingBishop }, // f1 blocked
    ]);
    const tos = kingMoves(state, [7, 4]).map((m) => m.to);
    expect(tos).not.toContainEqual([7, 6]);
    expect(tos).toContainEqual([7, 2]);
  });

  it("queen-side b-file [r,1] occupied → queen-side dropped (b-file must be empty)", () => {
    const state = makeState([
      { y: 7, x: 4, piece: PieceType.WhiteKing },
      { y: 7, x: 0, piece: PieceType.WhiteQueenRook },
      { y: 7, x: 7, piece: PieceType.WhiteKingRook },
      { y: 7, x: 1, piece: PieceType.WhiteQueenKnight }, // b1 blocked
    ]);
    const tos = kingMoves(state, [7, 4]).map((m) => m.to);
    expect(tos).not.toContainEqual([7, 2]);
    expect(tos).toContainEqual([7, 6]);
  });

  it("king currently in check → both castles dropped", () => {
    const state = makeState([
      { y: 7, x: 4, piece: PieceType.WhiteKing },
      { y: 7, x: 0, piece: PieceType.WhiteQueenRook },
      { y: 7, x: 7, piece: PieceType.WhiteKingRook },
      { y: 0, x: 4, piece: PieceType.BlackQueenRook }, // rook checks e1 down the e-file
    ]);
    const tos = kingMoves(state, [7, 4]).map((m) => m.to);
    expect(tos).not.toContainEqual([7, 6]);
    expect(tos).not.toContainEqual([7, 2]);
  });

  it("king-side transit square [r,5] attacked → king-side dropped", () => {
    const state = makeState([
      { y: 7, x: 4, piece: PieceType.WhiteKing },
      { y: 7, x: 7, piece: PieceType.WhiteKingRook },
      { y: 0, x: 5, piece: PieceType.BlackQueenRook }, // attacks f-file → f1 [7,5]
    ]);
    const tos = kingMoves(state, [7, 4]).map((m) => m.to);
    expect(tos).not.toContainEqual([7, 6]);
  });

  it("king-side destination square [r,6] attacked → king-side dropped", () => {
    const state = makeState([
      { y: 7, x: 4, piece: PieceType.WhiteKing },
      { y: 7, x: 7, piece: PieceType.WhiteKingRook },
      { y: 0, x: 6, piece: PieceType.BlackQueenRook }, // attacks g-file → g1 [7,6]
    ]);
    const tos = kingMoves(state, [7, 4]).map((m) => m.to);
    expect(tos).not.toContainEqual([7, 6]);
  });

  it("queen-side transit square [r,3] attacked → queen-side dropped", () => {
    const state = makeState([
      { y: 7, x: 4, piece: PieceType.WhiteKing },
      { y: 7, x: 0, piece: PieceType.WhiteQueenRook },
      { y: 0, x: 3, piece: PieceType.BlackQueenRook }, // attacks d-file → d1 [7,3]
    ]);
    const tos = kingMoves(state, [7, 4]).map((m) => m.to);
    expect(tos).not.toContainEqual([7, 2]);
  });

  it("queen-side destination square [r,2] attacked → queen-side dropped", () => {
    const state = makeState([
      { y: 7, x: 4, piece: PieceType.WhiteKing },
      { y: 7, x: 0, piece: PieceType.WhiteQueenRook },
      { y: 0, x: 2, piece: PieceType.BlackQueenRook }, // attacks c-file → c1 [7,2]
    ]);
    const tos = kingMoves(state, [7, 4]).map((m) => m.to);
    expect(tos).not.toContainEqual([7, 2]);
  });

  it("queen-side allowed when ONLY the b-file [r,1] is attacked (not a king square)", () => {
    // An enemy rook covering the b-file ([7,1]) but nothing on c/d/e files.
    // The b-file is a path square (must be empty) but NOT a check-gated square.
    const state = makeState([
      { y: 7, x: 4, piece: PieceType.WhiteKing },
      { y: 7, x: 0, piece: PieceType.WhiteQueenRook },
      { y: 5, x: 1, piece: PieceType.BlackQueenRook }, // attacks b-file (incl b1 [7,1])
    ]);
    const tos = kingMoves(state, [7, 4]).map((m) => m.to);
    expect(tos).toContainEqual([7, 2]); // queen-side still generated
  });

  it("unrelated enemy piece not covering the king's squares → castle still generated", () => {
    const state = makeState([
      { y: 7, x: 4, piece: PieceType.WhiteKing },
      { y: 7, x: 7, piece: PieceType.WhiteKingRook },
      { y: 0, x: 0, piece: PieceType.BlackQueenRook }, // a8 rook, covers a-file only
    ]);
    const tos = kingMoves(state, [7, 4]).map((m) => m.to);
    expect(tos).toContainEqual([7, 6]);
  });

  it("no rook in the corner → no castle even with the right set", () => {
    // Pins the existing single-step suite's assumption: rights without a rook
    // must not synthesise a castle.
    const state = makeState([{ y: 7, x: 4, piece: PieceType.WhiteKing }]);
    const tos = kingMoves(state, [7, 4]).map((m) => m.to);
    expect(tos).not.toContainEqual([7, 6]);
    expect(tos).not.toContainEqual([7, 2]);
  });

  it("end-to-end: a generated king-side castle survives legalMoves and applyMove relocates king + rook", () => {
    const state = makeState([
      { y: 7, x: 4, piece: PieceType.WhiteKing },
      { y: 7, x: 7, piece: PieceType.WhiteKingRook },
    ]);
    const legal = legalMoves(state, [7, 4]);
    const castle = legal.find((m) => m.to[0] === 7 && m.to[1] === 6);
    expect(castle).toBeDefined();

    const next = applyMove(state, castle!);
    expect(next.squares[7][6]).toBe(PieceType.WhiteKing); // king on g1
    expect(next.squares[7][5]).toBe(PieceType.WhiteKingRook); // rook on f1
    expect(next.squares[7][4]).toBeNull(); // e1 vacated
    expect(next.squares[7][7]).toBeNull(); // h1 vacated
    expect(next.castling.white.kingSide).toBe(false);
    expect(next.castling.white.queenSide).toBe(false);
  });

  it("end-to-end: a generated queen-side castle relocates king + rook correctly", () => {
    const state = makeState([
      { y: 7, x: 4, piece: PieceType.WhiteKing },
      { y: 7, x: 0, piece: PieceType.WhiteQueenRook },
    ]);
    const legal = legalMoves(state, [7, 4]);
    const castle = legal.find((m) => m.to[0] === 7 && m.to[1] === 2);
    expect(castle).toBeDefined();

    const next = applyMove(state, castle!);
    expect(next.squares[7][2]).toBe(PieceType.WhiteKing); // king on c1
    expect(next.squares[7][3]).toBe(PieceType.WhiteQueenRook); // rook on d1
    expect(next.squares[7][4]).toBeNull(); // e1 vacated
    expect(next.squares[7][0]).toBeNull(); // a1 vacated
  });
});
