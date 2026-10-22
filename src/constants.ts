import { PROMOTED_IDS } from "game/engine/moves/promotion";

/**
 * Single-sourced from the engine's `PROMOTED_IDS` (the live promotion-id table
 * after the legacy `piece-moves.ts` table was deleted). Re-exported here under
 * the historical `PromotionBoard` name so the public `constants` surface is
 * preserved. The 8-slot order is `[WQ, WR, WB, WN, BQ, BR, BB, BN]`.
 */
export const PromotionBoard = PROMOTED_IDS;

export const SQUARE_SIZE_XS = 39;
export const SQUARE_SIZE_MD = 52;
export const SQUARE_SIZE_XL = 78;
export const DEFAULT_TIME = 600;
