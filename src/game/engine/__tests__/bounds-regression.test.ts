import { describe, it, expect } from "vitest";
import { legalMoves, Position } from "../engine";
import { GameState, EngineSquare, PieceColor } from "../game-state";
import { PieceType } from "../../piece-type";

/**
 * Bounds-bug regression.
 *
 * The OLD move generator wrote the x-axis bound as `toY < 8` instead of
 * `toX < 8` (old `piece-moves.ts:69` / `:98`, and `BoardSlice.ts:92`), so a
 * piece on the board's right edge could emit a destination with `to[1] === 8`
 * — one file off the board. The new engine routes every bounds check through
 * the shared `inBounds` in `moves/classify.ts`, which gates BOTH axes, making
 * this class of bug impossible to reproduce.
 *
 * This test drives `legalMoves` for pieces parked at the board's edges and
 * corners and asserts every returned `Move.to` lies on the board on BOTH axes.
 * It would fail against the old `toY < 8`-for-`toX` logic (off-board `to`s
 * leaking through) and passes against the shared `inBounds`.
 */

const EMPTY_ROW: ReadonlyArray<EngineSquare> = [
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
];

/** An otherwise-empty board with `piece` placed at `[y, x]`, `turn` to move. */
function boardWith(
  piece: PieceType,
  y: number,
  x: number,
  turn: PieceColor
): GameState {
  const squares: EngineSquare[][] = Array.from({ length: 8 }, () => [
    ...EMPTY_ROW,
  ]);
  squares[y][x] = piece;
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

function onBoard(p: Position): boolean {
  return p[0] >= 0 && p[0] < 8 && p[1] >= 0 && p[1] < 8;
}

describe("bounds regression: edge/corner pieces stay on the board", () => {
  it("bounds bug regression: never generates a move with an off-board destination", () => {
    const cases: ReadonlyArray<{
      label: string;
      state: GameState;
      from: Position;
    }> = [
      // Knight in the a8 corner [0, 0]: its eight offsets mostly leave the
      // board; only the two on-board L-moves may be emitted.
      {
        label: "corner knight (a8)",
        state: boardWith(PieceType.WhiteKingKnight, 0, 0, "white"),
        from: [0, 0],
      },
      // Knight in the h1 corner [7, 7].
      {
        label: "corner knight (h1)",
        state: boardWith(PieceType.WhiteKingKnight, 7, 7, "white"),
        from: [7, 7],
      },
      // White h-file pawn [6, 7]: the right-diagonal capture target is x = 8,
      // exactly the off-board file the old `toY < 8` bound let slip through.
      {
        label: "h-file white pawn",
        state: boardWith(PieceType.WhitePawnH, 6, 7, "white"),
        from: [6, 7],
      },
      // Black a-file pawn [1, 0]: the left-diagonal capture target is x = -1.
      {
        label: "a-file black pawn",
        state: boardWith(PieceType.BlackPawnA, 1, 0, "black"),
        from: [1, 0],
      },
      // Rook on the right edge [3, 7]: its eastward ray steps straight off the
      // right edge to x = 8 — the precise direction the old bug mis-bounded.
      {
        label: "right-edge rook",
        state: boardWith(PieceType.WhiteQueenRook, 3, 7, "white"),
        from: [3, 7],
      },
      // Bishop in the h8 corner [0, 7]: three of its four diagonals head off
      // the board immediately, the fourth runs toward a1.
      {
        label: "corner bishop (h8)",
        state: boardWith(PieceType.WhiteKingBishop, 0, 7, "white"),
        from: [0, 7],
      },
      // Queen on the bottom edge [7, 4]: rays fan out toward every edge.
      {
        label: "bottom-edge queen",
        state: boardWith(PieceType.WhiteQueen, 7, 4, "white"),
        from: [7, 4],
      },
      // King in the h1 corner [7, 7]: five of eight king offsets leave the
      // board; only three neighbours are on-board.
      {
        label: "corner king (h1)",
        state: boardWith(PieceType.WhiteKing, 7, 7, "white"),
        from: [7, 7],
      },
    ];

    for (const { label, state, from } of cases) {
      const moves = legalMoves(state, from);
      // Every edge/corner piece has at least one on-board move, so an empty
      // result would mean the piece was silently dropped, not that bounds held.
      expect(moves.length, `${label} produced no moves`).toBeGreaterThan(0);
      for (const move of moves) {
        expect(
          onBoard(move.to),
          `${label}: off-board destination ${JSON.stringify(move.to)}`
        ).toBe(true);
      }
    }
  });
});
