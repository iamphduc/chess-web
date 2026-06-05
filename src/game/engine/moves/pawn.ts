import { GameState } from "../game-state";
import { Move, Position } from "../engine";
import { PromotionKind } from "./promotion";
import {
  pieceKind,
  colorOf,
  inBounds,
  occupant,
  relationTo,
} from "./classify";

/** The four kinds a pawn may promote to, in `promotionCount` slot order. */
const PROMOTION_KINDS: readonly PromotionKind[] = [
  "queen",
  "rook",
  "bishop",
  "knight",
];

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
 * - **En passant:** a forward diagonal onto an `inBounds` EMPTY square is emitted
 *   IFF `state.enPassant` is non-null and equals that square. This is the ONLY
 *   case a pawn moves diagonally onto an empty square. The captured pawn removal
 *   and the `enPassant` bookkeeping are {@link applyMove}'s job, not ours.
 * - **Promotion:** any generated move (push or capture, incl. the hypothetical
 *   en-passant — which can never reach the last rank) that lands on the mover's
 *   LAST RANK (White row 0, Black row 7) is expanded into FOUR moves, one per
 *   {@link PromotionKind} (`queen`/`rook`/`bishop`/`knight`), sharing `from`/`to`.
 *   A move short of the last rank carries no `promotion` field. The promoted-id
 *   allocation is {@link applyMove}'s job; we only set `move.promotion`.
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
  const lastRow = color === "white" ? 0 : 7;

  // Collect plain `to` destinations first, then expand last-rank landings into
  // the four promotion variants in one pass.
  const targets: Position[] = [];

  // Single push (and, gated on it, the double push). A double push can never
  // reach the last rank, so it never needs promotion expansion.
  const oneY = y + forward;
  if (inBounds(oneY, x) && occupant(state, oneY, x) === null) {
    targets.push([oneY, x]);

    const twoY = y + forward * 2;
    if (
      y === startRow &&
      inBounds(twoY, x) &&
      occupant(state, twoY, x) === null
    ) {
      targets.push([twoY, x]);
    }
  }

  // Forward diagonals: an enemy is an ordinary capture; an EMPTY square is a
  // capture only when it is the en-passant target. `inBounds` first so a
  // file-edge pawn drops its off-board diagonal instead of wrapping.
  for (const dx of [-1, 1]) {
    const capY = y + forward;
    const capX = x + dx;
    if (!inBounds(capY, capX)) continue;

    const target = occupant(state, capY, capX);
    if (relationTo(color, target) === "enemy") {
      targets.push([capY, capX]);
    } else if (
      target === null &&
      state.enPassant !== null &&
      state.enPassant[0] === capY &&
      state.enPassant[1] === capX
    ) {
      targets.push([capY, capX]);
    }
  }

  // Expand: a last-rank landing becomes four promotion moves; everything else
  // stays a single plain move.
  const moves: Move[] = [];
  for (const to of targets) {
    if (to[0] === lastRow) {
      for (const kind of PROMOTION_KINDS) {
        moves.push({ from, to, promotion: kind });
      }
    } else {
      moves.push({ from, to });
    }
  }

  return moves;
}
