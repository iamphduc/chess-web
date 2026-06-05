import { Move, Position } from "../engine";
import { GameState } from "../game-state";
import {
  colorOf,
  inBounds,
  occupant,
  relationTo,
  KNIGHT_OFFSETS,
} from "./classify";

/**
 * Pseudo-legal move generator for a knight on `from`.
 *
 * Implements the pinned generator signature:
 *   `(state: GameState, from: Position) => Move[]`
 *
 * For each of the eight `KNIGHT_OFFSETS`, the target is legal iff:
 * - `inBounds(toY, toX)` — no off-board squares
 * - `relationTo(moverColor, target) !== "friendly"` — friendly pieces block
 *
 * No check/king-safety filtering is performed (pseudo-legal only).
 * Promoted knight ids (e.g. `WHITE_KNIGHT_PROMOTED_1`) are handled
 * transparently via `colorOf`, which reads the `WHITE_`/`BLACK_` prefix.
 */
export function knightMoves(state: GameState, from: Position): Move[] {
  const [y, x] = from;
  const piece = occupant(state, y, x);
  if (piece === null) return [];

  const moverColor = colorOf(piece);
  const moves: Move[] = [];

  for (const [dy, dx] of KNIGHT_OFFSETS) {
    const toY = y + dy;
    const toX = x + dx;
    if (!inBounds(toY, toX)) continue;
    const target = occupant(state, toY, toX);
    if (relationTo(moverColor, target) === "friendly") continue;
    moves.push({ from, to: [toY, toX] });
  }

  return moves;
}
