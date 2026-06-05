import { Move, Position } from "../engine";
import { GameState } from "../game-state";
import {
  colorOf,
  inBounds,
  occupant,
  relationTo,
  KING_OFFSETS,
} from "./classify";

/**
 * Pseudo-legal single-step king moves from `from`.
 *
 * For each of the eight `KING_OFFSETS`, the target square is included when:
 *   - it lies on the board (`inBounds`), AND
 *   - it is not occupied by a friendly piece (`relationTo` !== "friendly").
 *
 * An enemy-occupied square is included as a capture.
 * Castling (two-square moves) is **out of scope** — use the `special-moves` sprint.
 * Check / king-safety filtering is **out of scope** — use the `king-safety-endgame` sprint.
 *
 * Implements the pinned generator signature from `classify.ts`:
 *   `(state: GameState, from: Position) => Move[]`
 */
export function kingMoves(state: GameState, from: Position): Move[] {
  const [y, x] = from;
  const piece = state.squares[y][x];
  if (piece === null) return [];

  const moverColor = colorOf(piece);
  const moves: Move[] = [];

  for (const [dy, dx] of KING_OFFSETS) {
    const ty = y + dy;
    const tx = x + dx;

    if (!inBounds(ty, tx)) continue;

    const target = occupant(state, ty, tx);
    if (relationTo(moverColor, target) === "friendly") continue;

    moves.push({ from, to: [ty, tx] });
  }

  return moves;
}
