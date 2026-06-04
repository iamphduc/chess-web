import { GameState, EngineSquare, PieceColor } from "./game-state";
import { PieceType } from "../piece-type";

/**
 * A board position as `[y, x]` (0-indexed), matching the `GameState` grid:
 * `squares[y][x]`, row 0 is Black's back rank, row 7 White's.
 */
export type Position = readonly [number, number];

/**
 * A move from one square to another. The tracer slice models only quiet,
 * non-special moves, so a move is fully described by its endpoints; captures,
 * castling, en passant and promotion carry no extra data here.
 */
export interface Move {
  readonly from: Position;
  readonly to: Position;
}

/**
 * Tracer-bullet move set. This deliberately handles ONLY the quiet white-pawn
 * push the tracer exercises (single step, plus the double step from the start
 * rank). It proves the engine seam — `initialGameState` → `legalMoves` →
 * `applyMove` — end to end.
 *
 * Full move generation for every piece (and captures, king safety, special
 * moves) is the next sprint's work and is intentionally NOT attempted here.
 */
const WHITE_PAWNS: ReadonlySet<EngineSquare> = new Set([
  PieceType.WhitePawnA,
  PieceType.WhitePawnB,
  PieceType.WhitePawnC,
  PieceType.WhitePawnD,
  PieceType.WhitePawnE,
  PieceType.WhitePawnF,
  PieceType.WhitePawnG,
  PieceType.WhitePawnH,
]);

/** White's pawn start rank in `[y, x]` terms (row 6). */
const WHITE_PAWN_START_ROW = 6;

function inBounds(y: number, x: number): boolean {
  return y >= 0 && y < 8 && x >= 0 && x < 8;
}

function colorOf(piece: EngineSquare): PieceColor | null {
  if (piece === null) return null;
  return piece.startsWith("WHITE_") ? "white" : "black";
}

/**
 * Legal destinations for the piece on `from`, given whose turn it is.
 *
 * Tracer scope: only quiet white-pawn pushes are generated. Any other piece,
 * any non-empty target square, or moving out of turn yields no moves. This is
 * enough to drive one quiet move through the seam; do not read it as a complete
 * move generator.
 */
export function legalMoves(state: GameState, from: Position): Move[] {
  const [y, x] = from;
  if (!inBounds(y, x)) return [];

  const piece = state.squares[y][x];
  if (piece === null) return [];
  if (colorOf(piece) !== state.turn) return [];

  // Tracer: only white pawns, pushing forward (toward row 0).
  if (!WHITE_PAWNS.has(piece)) return [];

  const moves: Move[] = [];

  const oneY = y - 1;
  if (inBounds(oneY, x) && state.squares[oneY][x] === null) {
    moves.push({ from, to: [oneY, x] });

    const twoY = y - 2;
    if (
      y === WHITE_PAWN_START_ROW &&
      inBounds(twoY, x) &&
      state.squares[twoY][x] === null
    ) {
      moves.push({ from, to: [twoY, x] });
    }
  }

  return moves;
}

/**
 * Apply a quiet move, returning a NEW `GameState` with the piece relocated and
 * the turn flipped. The input `state` is never mutated — a fresh grid is built.
 *
 * Tracer scope: assumes `move` is a quiet, non-special move (no capture handling,
 * no castling/en-passant/promotion bookkeeping). Castling rights, en-passant
 * target and promotion counts are carried through unchanged.
 */
export function applyMove(state: GameState, move: Move): GameState {
  const [fromY, fromX] = move.from;
  const [toY, toX] = move.to;

  const piece = state.squares[fromY][fromX];

  const squares = state.squares.map((row, y) =>
    row.map((square, x) => {
      if (y === fromY && x === fromX) return null;
      if (y === toY && x === toX) return piece;
      return square;
    })
  );

  return {
    ...state,
    squares,
    turn: state.turn === "white" ? "black" : "white",
  };
}
