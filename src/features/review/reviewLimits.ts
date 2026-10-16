import type { SearchLimits } from "game/opponent/engine/lines";

/**
 * Each review search: full strength, one line, stopped at depth 18 or after
 * `movetimeMs`, whichever comes first. The time comes from the speed check in
 * docs/decisions.md.
 */
export const REVIEW_LIMITS: SearchLimits = { depth: 18, multiPv: 1, movetimeMs: 500 };
