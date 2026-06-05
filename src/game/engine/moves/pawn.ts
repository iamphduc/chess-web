import { GameState } from "../game-state";
import { Move, Position } from "../engine";
import {
  pieceKind,
  colorOf,
  inBounds,
  occupant,
  relationTo,
} from "./classify";

/**
 * Pseudo-legal pawn moves for the pawn standing on `from`, for either colour.
 *
 * Implements the {@link MoveGenerator} signature pinned in `classify.ts`:
 *
 *     (state: GameState, from: Position) => Move[]
 *
 * This generalizes the tracer's white-pawn-push logic (`engine.ts#legalMoves`)
 * to both colours, and adds diagonal captures:
 *
 * - **Direction:** White advances toward row 0 (`y - 1`), Black toward row 7
 *   (`y + 1`). Encoded as `forward = color === "white" ? -1 : +1`.
 * - **Single push:** the square directly ahead, iff empty.
 * - **Double push:** from the start rank (White row 6, Black row 1), iff BOTH
 *   the intervening and landing squares are empty.
 * - **Diagonal captures:** the two forward diagonals, included only when the
 *   target is `inBounds` AND holds an enemy piece. A file-edge pawn (a-/h-file)
 *   has only one in-board diagonal; the off-board one is dropped via `inBounds`
 *   rather than allowed to wrap.
 *
 * Deliberately OUT OF SCOPE (owned by the `special-moves` slice):
 * - **En passant:** `state.enPassant` is never read; a diagonal onto an empty
 *   square is never emitted.
 * - **Promotion:** a push or capture onto the last rank emits an ordinary
 *   {@link Move} (just `from`/`to`) — no promotion-typed field, no
 *   `promotionCount` bookkeeping.
 *
 * Like every Wave-2 generator, this does NOT verify the piece kind/colour
 * matches the side to move and does NOT do check filtering — the dispatcher and
 * a later king-safety slice own those.
 */
export function pawnMoves(state: GameState, from: Position): Move[] {
  const [y, x] = from;

  const piece = occupant(state, y, x);
  // Defensive only: this generator is dispatched for pawns. Promoted ids are
  // never pawns, so they never reach here; bail on anything non-pawn.
  if (piece === null || pieceKind(piece) !== "pawn") return [];

  const color = colorOf(piece);
  const forward = color === "white" ? -1 : 1;
  const startRow = color === "white" ? 6 : 1;

  const moves: Move[] = [];

  // Single push (and, gated on it, the double push).
  const oneY = y + forward;
  if (inBounds(oneY, x) && occupant(state, oneY, x) === null) {
    moves.push({ from, to: [oneY, x] });

    const twoY = y + forward * 2;
    if (
      y === startRow &&
      inBounds(twoY, x) &&
      occupant(state, twoY, x) === null
    ) {
      moves.push({ from, to: [twoY, x] });
    }
  }

  // Diagonal captures: only onto an in-bounds enemy. `inBounds` first so a
  // file-edge pawn drops its off-board diagonal instead of wrapping.
  for (const dx of [-1, 1]) {
    const capY = y + forward;
    const capX = x + dx;
    if (!inBounds(capY, capX)) continue;
    if (relationTo(color, occupant(state, capY, capX)) === "enemy") {
      moves.push({ from, to: [capY, capX] });
    }
  }

  return moves;
}
