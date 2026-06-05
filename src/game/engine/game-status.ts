import { GameState } from "./game-state";
import { legalMoves, Move, Position } from "./engine";
import { colorOf } from "./moves/classify";
import { isInCheck } from "./moves/attack";

/**
 * Game-end detection layered on top of the king-safety-filtered `legalMoves`.
 *
 * This slice does NOT re-derive move legality: it iterates the board, asks
 * {@link legalMoves} for every piece of the side to move, and collapses the
 * result into a terminal verdict. The `classify` helpers are used ONLY to pick
 * out the side-to-move's pieces — every legality decision comes from `engine.ts`.
 *
 * Out of scope (deferred): draw by repetition, the fifty-move rule and
 * insufficient material. Only checkmate / stalemate / ongoing are decided here.
 */

/**
 * Every legal move available to the side to move, gathered across all 64
 * squares. For each square holding a piece whose colour matches `state.turn`,
 * its {@link legalMoves} are concatenated; squares that are empty, off-turn, or
 * yield no legal move contribute nothing.
 */
export function allLegalMoves(state: GameState): Move[] {
  const moves: Move[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const piece = state.squares[y][x];
      if (piece === null) continue;
      if (colorOf(piece) !== state.turn) continue;
      const from: Position = [y, x];
      for (const move of legalMoves(state, from)) {
        moves.push(move);
      }
    }
  }
  return moves;
}

/**
 * True iff the side to move has at least one legal move. Short-circuits on the
 * first legal move found rather than materialising the whole list.
 */
export function hasAnyLegalMove(state: GameState): boolean {
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const piece = state.squares[y][x];
      if (piece === null) continue;
      if (colorOf(piece) !== state.turn) continue;
      if (legalMoves(state, [y, x]).length > 0) return true;
    }
  }
  return false;
}

/** The terminal verdict for a position from the side-to-move's perspective. */
export type GameStatus = "checkmate" | "stalemate" | "ongoing";

/**
 * Classify a position:
 * - the side to move has a legal move          -> `"ongoing"`
 * - no legal move AND the side to move is in check -> `"checkmate"`
 * - no legal move and NOT in check             -> `"stalemate"`
 */
export function gameStatus(state: GameState): GameStatus {
  if (hasAnyLegalMove(state)) return "ongoing";
  return isInCheck(state, state.turn) ? "checkmate" : "stalemate";
}
