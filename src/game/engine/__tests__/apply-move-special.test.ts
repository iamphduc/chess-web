import { describe, it, expect } from "vitest";
import { applyMove, Move } from "../engine";
import { GameState, EngineSquare, PromotionCount } from "../game-state";
import { PieceType } from "../../piece-type";

/** An empty 8x8 grid we can spot-place pieces onto for focused scenarios. */
function emptyGrid(): EngineSquare[][] {
  return Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => null as EngineSquare)
  );
}

const FULL_RIGHTS = {
  white: { kingSide: true, queenSide: true },
  black: { kingSide: true, queenSide: true },
};

const ZERO_COUNTS: PromotionCount = [0, 0, 0, 0, 0, 0, 0, 0];

/** Build a GameState from a grid with sensible defaults. */
function stateWith(
  squares: EngineSquare[][],
  overrides: Partial<GameState> = {}
): GameState {
  return {
    squares,
    turn: "white",
    castling: structuredClone(FULL_RIGHTS),
    enPassant: null,
    promotionCount: ZERO_COUNTS,
    ...overrides,
  };
}

describe("applyMove: castling", () => {
  it("king-side castle relocates king + rook and clears both white rights", () => {
    const grid = emptyGrid();
    grid[7][4] = PieceType.WhiteKing;
    grid[7][7] = PieceType.WhiteKingRook;
    const move: Move = { from: [7, 4], to: [7, 6] };

    const after = applyMove(stateWith(grid), move);

    expect(after.squares[7][6]).toBe(PieceType.WhiteKing);
    expect(after.squares[7][5]).toBe(PieceType.WhiteKingRook);
    expect(after.squares[7][4]).toBeNull();
    expect(after.squares[7][7]).toBeNull();
    expect(after.castling.white).toEqual({ kingSide: false, queenSide: false });
    expect(after.castling.black).toEqual({ kingSide: true, queenSide: true });
  });

  it("queen-side castle relocates king + rook and clears both black rights", () => {
    const grid = emptyGrid();
    grid[0][4] = PieceType.BlackKing;
    grid[0][0] = PieceType.BlackQueenRook;
    const move: Move = { from: [0, 4], to: [0, 2] };

    const after = applyMove(stateWith(grid, { turn: "black" }), move);

    expect(after.squares[0][2]).toBe(PieceType.BlackKing);
    expect(after.squares[0][3]).toBe(PieceType.BlackQueenRook);
    expect(after.squares[0][4]).toBeNull();
    expect(after.squares[0][0]).toBeNull();
    expect(after.castling.black).toEqual({ kingSide: false, queenSide: false });
    expect(after.castling.white).toEqual({ kingSide: true, queenSide: true });
  });
});

describe("applyMove: castling-rights maintenance", () => {
  it("a non-castle king move clears both the mover's rights", () => {
    const grid = emptyGrid();
    grid[7][4] = PieceType.WhiteKing;
    const after = applyMove(stateWith(grid), { from: [7, 4], to: [7, 5] });
    expect(after.castling.white).toEqual({ kingSide: false, queenSide: false });
  });

  it("a starting-corner rook move clears exactly its one right", () => {
    const grid = emptyGrid();
    grid[7][0] = PieceType.WhiteQueenRook;
    const after = applyMove(stateWith(grid), { from: [7, 0], to: [5, 0] });
    expect(after.castling.white).toEqual({ kingSide: true, queenSide: false });
    expect(after.castling.black).toEqual({ kingSide: true, queenSide: true });
  });

  it("capturing a rook on its starting corner clears the captured side's right", () => {
    const grid = emptyGrid();
    // White rook captures the black rook sitting on its king-side corner [0,7].
    grid[5][7] = PieceType.WhiteQueenRook;
    grid[0][7] = PieceType.BlackKingRook;
    const after = applyMove(stateWith(grid), { from: [5, 7], to: [0, 7] });
    expect(after.castling.black).toEqual({ kingSide: false, queenSide: true });
    // The white rook left a non-corner, so white rights are untouched.
    expect(after.castling.white).toEqual({ kingSide: true, queenSide: true });
  });
});

describe("applyMove: en-passant target maintenance", () => {
  it("a pawn double-push sets enPassant to the skipped square", () => {
    const grid = emptyGrid();
    grid[6][4] = PieceType.WhitePawnE;
    const after = applyMove(stateWith(grid), { from: [6, 4], to: [4, 4] });
    expect(after.enPassant).toEqual([5, 4]);
  });

  it("a non-double-push clears enPassant to null", () => {
    const grid = emptyGrid();
    grid[6][4] = PieceType.WhitePawnE;
    const after = applyMove(
      stateWith(grid, { enPassant: [2, 0] }),
      { from: [6, 4], to: [5, 4] }
    );
    expect(after.enPassant).toBeNull();
  });
});

describe("applyMove: en-passant capture", () => {
  it("removes the pawn at [fromY, toX] and vacates origin + captured squares", () => {
    const grid = emptyGrid();
    // White pawn on [3,4] captures en passant onto empty [2,3]; the black pawn
    // it captures sits beside it on [3,3].
    grid[3][4] = PieceType.WhitePawnE;
    grid[3][3] = PieceType.BlackPawnD;
    const after = applyMove(
      stateWith(grid, { enPassant: [2, 3] }),
      { from: [3, 4], to: [2, 3] }
    );

    expect(after.squares[2][3]).toBe(PieceType.WhitePawnE);
    expect(after.squares[3][4]).toBeNull(); // diagonal origin vacated
    expect(after.squares[3][3]).toBeNull(); // captured pawn removed
  });
});

describe("applyMove: promotion", () => {
  it("replaces the pawn with the allocated id and increments the right slot", () => {
    const grid = emptyGrid();
    grid[1][4] = PieceType.WhitePawnE;
    const after = applyMove(stateWith(grid), {
      from: [1, 4],
      to: [0, 4],
      promotion: "queen",
    });

    expect(after.squares[0][4]).toBe(PieceType.WhiteQueenPromoted1);
    expect(after.squares[1][4]).toBeNull();
    // Slot 0 (white queen) incremented, others unchanged.
    expect(after.promotionCount).toEqual([1, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("two successive same-(color,kind) promotions hand out DISTINCT ids", () => {
    const grid1 = emptyGrid();
    grid1[1][0] = PieceType.WhitePawnA;
    const after1 = applyMove(stateWith(grid1), {
      from: [1, 0],
      to: [0, 0],
      promotion: "knight",
    });
    expect(after1.squares[0][0]).toBe(PieceType.WhiteKnightPromoted1);

    const grid2 = emptyGrid();
    grid2[1][1] = PieceType.WhitePawnB;
    const after2 = applyMove(
      stateWith(grid2, { promotionCount: after1.promotionCount }),
      { from: [1, 1], to: [0, 1], promotion: "knight" }
    );
    expect(after2.squares[0][1]).toBe(PieceType.WhiteKnightPromoted2);
  });
});

describe("applyMove: purity of special-move bookkeeping", () => {
  it("does not alias the input castling sub-objects", () => {
    const grid = emptyGrid();
    grid[7][4] = PieceType.WhiteKing;
    const state = stateWith(grid);
    const after = applyMove(state, { from: [7, 4], to: [7, 5] });
    expect(after.castling).not.toBe(state.castling);
    expect(after.castling.white).not.toBe(state.castling.white);
    // Input untouched.
    expect(state.castling.white).toEqual({ kingSide: true, queenSide: true });
  });

  it("does not mutate the input promotionCount on a promotion", () => {
    const grid = emptyGrid();
    grid[1][4] = PieceType.WhitePawnE;
    const state = stateWith(grid);
    applyMove(state, { from: [1, 4], to: [0, 4], promotion: "queen" });
    expect(state.promotionCount).toEqual(ZERO_COUNTS);
  });
});
