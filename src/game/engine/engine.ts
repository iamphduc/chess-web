import { GameState } from "./game-state";
import { colorOf, inBounds, pieceKind } from "./moves/classify";
import { slidingMoves } from "./moves/sliding";
import { knightMoves } from "./moves/knight";
import { kingMoves } from "./moves/king";
import { pawnMoves } from "./moves/pawn";
import { isInCheck } from "./moves/attack";

/**
 * A board position as `[y, x]` (0-indexed), matching the `GameState` grid:
 * `squares[y][x]`, row 0 is Black's back rank, row 7 White's.
 */
export type Position = readonly [number, number];

/**
 * A move from one square to another. This slice models only quiet,
 * non-special moves, so a move is fully described by its endpoints; captures,
 * castling, en passant and promotion carry no extra data here.
 */
export interface Move {
  readonly from: Position;
  readonly to: Position;
}

/**
 * Pseudo-legal destinations for the piece on `from`, given whose turn it is.
 *
 * Validates the `from` square, then classifies the piece with {@link pieceKind}
 * and delegates to the matching pseudo-legal generator:
 * - bishop / rook / queen → {@link slidingMoves}
 * - knight → {@link knightMoves}
 * - king → {@link kingMoves} (single-step only; castling is `special-moves`)
 * - pawn → {@link pawnMoves} (no en-passant/promotion; those are `special-moves`)
 *
 * Returns `[]` when `from` is off the board, empty, or holds a piece whose
 * colour does not match `state.turn` (moving out of turn).
 *
 * The output is PSEUDO-LEGAL: it does NOT filter moves that would leave (or
 * expose) the mover's own king in check — {@link legalMoves} layers that
 * king-safety filter on top. Private to this module so the filter can never be
 * re-entrant.
 */
function pseudoLegalMoves(state: GameState, from: Position): Move[] {
  const [y, x] = from;
  if (!inBounds(y, x)) return [];

  const piece = state.squares[y][x];
  if (piece === null) return [];
  if (colorOf(piece) !== state.turn) return [];

  switch (pieceKind(piece)) {
    case "bishop":
    case "rook":
    case "queen":
      return slidingMoves(state, from);
    case "knight":
      return knightMoves(state, from);
    case "king":
      return kingMoves(state, from);
    case "pawn":
      return pawnMoves(state, from);
  }
}

/**
 * LEGAL destinations for the piece on `from`: the pseudo-legal moves of
 * {@link pseudoLegalMoves} minus any that would leave the MOVER's own king in
 * check.
 *
 * For each pseudo-legal `Move m`, we capture the mover's colour, apply `m` with
 * {@link applyMove}, and keep `m` iff the mover's king is NOT in check in the
 * resulting position. Note the subtlety: we test the mover's king, not
 * `applied.turn` — `applyMove` has already flipped the turn to the opponent.
 *
 * This single rule subsumes all three king-safety cases: a pinned piece may not
 * leave its pin line, a side in check must resolve it (capture the checker,
 * block the ray, or move the king), and the king may not step into an attacked
 * square (including capturing a defended piece).
 *
 * Still out of scope for this sprint (deferred to `special-moves`): castling
 * through / into / out of check, and en-passant legality. `applyMove` handles
 * captures by overwriting the destination, so capture-resolves-check works here.
 */
export function legalMoves(state: GameState, from: Position): Move[] {
  const [y, x] = from;
  const piece = inBounds(y, x) ? state.squares[y][x] : null;
  // `pseudoLegalMoves` already guards off-board / empty / out-of-turn, but we
  // need the mover's colour for the filter; an empty/off-board `from` yields no
  // pseudo-legal moves, so the loop below is a no-op and `[]` filters to `[]`.
  const mover = piece === null ? state.turn : colorOf(piece);

  return pseudoLegalMoves(state, from).filter((move) => {
    const applied = applyMove(state, move);
    return !isInCheck(applied, mover);
  });
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
