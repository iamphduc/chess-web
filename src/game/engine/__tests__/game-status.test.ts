import { describe, it, expect } from "vitest";
import { GameState, EngineSquare, PieceColor } from "../game-state";
import { initialGameState } from "../game-state";
import { hasAnyLegalMove, gameStatus } from "../game-status";
import { PieceType } from "../../piece-type";

/**
 * Game-end detection tests for the `game-status` slice.
 *
 * `gameStatus` collapses the now-legal move set into a terminal verdict:
 * - any legal move for the side to move        -> "ongoing"
 * - no legal move, side to move IS in check     -> "checkmate"
 * - no legal move, side to move is NOT in check -> "stalemate"
 *
 * `hasAnyLegalMove` is the underlying predicate. Boards are built directly as
 * sparse 8x8 grids (row 0 = Black back rank, row 7 = White) so each position
 * isolates exactly one verdict; `turn` is always set explicitly.
 */

/** An empty 8x8 grid. */
function emptyBoard(): EngineSquare[][] {
  return Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => null as EngineSquare)
  );
}

/** Assemble a `GameState` from a sparse `[y, x, piece]` placement list. */
function makeState(
  turn: PieceColor,
  placements: ReadonlyArray<readonly [number, number, PieceType]>
): GameState {
  const squares = emptyBoard();
  for (const [y, x, piece] of placements) {
    squares[y][x] = piece;
  }
  return {
    squares,
    turn,
    castling: {
      white: { kingSide: false, queenSide: false },
      black: { kingSide: false, queenSide: false },
    },
    enPassant: null,
    promotionCount: [0, 0, 0, 0, 0, 0, 0, 0],
  };
}

describe("hasAnyLegalMove", () => {
  it("is true for the start position (White to move)", () => {
    expect(hasAnyLegalMove(initialGameState())).toBe(true);
  });

  it("is false in a mated position (no legal move for the side to move)", () => {
    // Back-rank mate: White king h1 [7,7] blocked in by its own pawns g2 [6,6]
    // and h2 [6,7]; Black rook on a1 [7,0] checks along rank 7. The king is
    // stuck, the pawns cannot push to block, nothing captures the rook.
    const mated = makeState("white", [
      [7, 7, PieceType.WhiteKing],
      [6, 6, PieceType.WhitePawnG],
      [6, 7, PieceType.WhitePawnH],
      [7, 0, PieceType.BlackQueenRook],
    ]);
    expect(hasAnyLegalMove(mated)).toBe(false);
  });
});

describe("gameStatus: checkmate", () => {
  it("reports a back-rank mate as checkmate", () => {
    // Same back-rank mate shape: White in check on h1 with no legal move.
    const mated = makeState("white", [
      [7, 7, PieceType.WhiteKing],
      [6, 6, PieceType.WhitePawnG],
      [6, 7, PieceType.WhitePawnH],
      [7, 0, PieceType.BlackQueenRook],
    ]);
    expect(gameStatus(mated)).toBe("checkmate");
  });

  it("reports a Fool's-mate-style queen mate as checkmate", () => {
    // White king cornered on h1 [7,7]; Black queen delivers mate from g2 [6,6],
    // defended by a Black bishop on a8 [0,0] (a8->g2 diagonal). The king cannot
    // capture the queen (defended) nor flee — g1 [7,6] is covered by the queen,
    // and h2 [6,7] is covered by the queen too.
    const fools = makeState("white", [
      [7, 7, PieceType.WhiteKing],
      [6, 6, PieceType.BlackQueen],
      [0, 0, PieceType.BlackQueenBishop],
    ]);
    expect(gameStatus(fools)).toBe("checkmate");
  });
});

describe("gameStatus: stalemate", () => {
  it("reports the classic K+Q-vs-lone-king-in-corner stalemate", () => {
    // Black king cornered on a8 [0,0], Black to move, NOT in check. White queen
    // on c7 [1,2] covers b8 [0,1], a7 [1,0] and b7 [1,1] (the king's only
    // neighbours) without attacking a8 itself; White king on b6 [2,1] guards c7.
    // Black has no piece but the king and no legal king move -> stalemate.
    const stalemate = makeState("black", [
      [0, 0, PieceType.BlackKing],
      [1, 2, PieceType.WhiteQueen],
      [2, 1, PieceType.WhiteKing],
    ]);
    expect(gameStatus(stalemate)).toBe("stalemate");
  });
});

describe("gameStatus: ongoing", () => {
  it("reports the start position as ongoing", () => {
    expect(gameStatus(initialGameState())).toBe("ongoing");
  });

  it("reports a position with a legal move as ongoing", () => {
    // Lone White king on e4 [4,4] with the whole board to roam.
    const open = makeState("white", [[4, 4, PieceType.WhiteKing]]);
    expect(gameStatus(open)).toBe("ongoing");
  });

  it("reports in-check-with-an-escape as ongoing (NOT checkmate)", () => {
    // White king e1 [7,4] checked by a Black rook on e8 [0,4] down the e-file.
    // The king can step aside to d1 [7,3] or f1 [7,5], so the check is escapable.
    const checkEscape = makeState("white", [
      [7, 4, PieceType.WhiteKing],
      [0, 4, PieceType.BlackQueenRook],
    ]);
    expect(gameStatus(checkEscape)).toBe("ongoing");
  });
});
