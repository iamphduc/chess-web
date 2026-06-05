import { PieceType } from "../../piece-type";
import { PieceColor, PromotionCount } from "../game-state";
import { PieceKind } from "./classify";

/**
 * The four kinds a pawn may promote to — the promotable subset of the
 * {@link PieceKind} union (excludes `"pawn"` and `"king"`). A {@link Move} whose
 * `promotion` field is set carries one of these.
 */
export type PromotionKind = Extract<
  PieceKind,
  "queen" | "rook" | "bishop" | "knight"
>;

/**
 * Within-side slot order of `promotionCount` / `PromotionBoard`: queen, rook,
 * bishop, knight. White occupies offset 0 (slots 0–3), Black offset 4 (slots
 * 4–7).
 */
const KIND_ORDER: readonly PromotionKind[] = [
  "queen",
  "rook",
  "bishop",
  "knight",
];

/**
 * The four pre-allocated promoted `PieceType` ids per slot, ordered to match the
 * 8-slot `promotionCount` tuple `[WQ, WR, WB, WN, BQ, BR, BB, BN]`. This mirrors
 * `src/constants.ts`'s `PromotionBoard` row-for-row, rebuilt here directly from
 * the {@link PieceType} enum ids so the pure engine stays free of the legacy
 * `constants.ts` module (which pulls in baseUrl-aliased UI imports the engine
 * test/build graph must not depend on).
 */
export const PROMOTED_IDS: readonly (readonly PieceType[])[] = [
  // White
  [
    PieceType.WhiteQueenPromoted1,
    PieceType.WhiteQueenPromoted2,
    PieceType.WhiteQueenPromoted3,
    PieceType.WhiteQueenPromoted4,
  ],
  [
    PieceType.WhiteRookPromoted1,
    PieceType.WhiteRookPromoted2,
    PieceType.WhiteRookPromoted3,
    PieceType.WhiteRookPromoted4,
  ],
  [
    PieceType.WhiteBishopPromoted1,
    PieceType.WhiteBishopPromoted2,
    PieceType.WhiteBishopPromoted3,
    PieceType.WhiteBishopPromoted4,
  ],
  [
    PieceType.WhiteKnightPromoted1,
    PieceType.WhiteKnightPromoted2,
    PieceType.WhiteKnightPromoted3,
    PieceType.WhiteKnightPromoted4,
  ],
  // Black
  [
    PieceType.BlackQueenPromoted1,
    PieceType.BlackQueenPromoted2,
    PieceType.BlackQueenPromoted3,
    PieceType.BlackQueenPromoted4,
  ],
  [
    PieceType.BlackRookPromoted1,
    PieceType.BlackRookPromoted2,
    PieceType.BlackRookPromoted3,
    PieceType.BlackRookPromoted4,
  ],
  [
    PieceType.BlackBishopPromoted1,
    PieceType.BlackBishopPromoted2,
    PieceType.BlackBishopPromoted3,
    PieceType.BlackBishopPromoted4,
  ],
  [
    PieceType.BlackKnightPromoted1,
    PieceType.BlackKnightPromoted2,
    PieceType.BlackKnightPromoted3,
    PieceType.BlackKnightPromoted4,
  ],
];

/**
 * Map `(color, kind)` to its index in the 8-slot `promotionCount` tuple
 * `[WQ, WR, WB, WN, BQ, BR, BB, BN]`: white offset 0, black offset 4, plus the
 * within-side `KIND_ORDER` position.
 */
function slotIndex(color: PieceColor, kind: PromotionKind): number {
  const sideOffset = color === "white" ? 0 : 4;
  return sideOffset + KIND_ORDER.indexOf(kind);
}

/**
 * Allocate the next unique promoted `PieceType` id for `(color, kind)` and the
 * incremented counter tuple.
 *
 * `counts` is read at the `(color, kind)` slot to get how many of that promoted
 * type were already handed out (`n`); the `n`-th pre-allocated id from
 * {@link PromotionBoard} (read-only) is returned, alongside a FRESH `nextCounts`
 * tuple with that one slot bumped by 1. The input `counts` is never mutated.
 *
 * There are only four pre-allocated ids per `(color, kind)`. A 5th promotion of
 * the same type exceeds the pool: this CLAMPS to the 4th id (index 3) — the last
 * available id is reused rather than throwing, keeping `applyMove` total — while
 * still incrementing the counter so the overflow is observable. This honours the
 * `{ kind, color }` quarantine: we only ever hand out a pre-allocated id.
 */
export function allocatePromotedId(
  color: PieceColor,
  kind: PromotionKind,
  counts: PromotionCount
): { id: PieceType; nextCounts: PromotionCount } {
  const slot = slotIndex(color, kind);
  const n = counts[slot];

  const pool = PROMOTED_IDS[slot];
  const id = pool[Math.min(n, pool.length - 1)];

  const nextCounts = counts.map((c, i) => (i === slot ? c + 1 : c)) as unknown as
    PromotionCount;

  return { id, nextCounts };
}
