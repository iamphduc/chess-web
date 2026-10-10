// Relative imports only: the Node import script (run with tsx) may load this file.

/** The strength steps the player can pick, weakest first. */
export const STRENGTH_STEPS = [1400, 1700, 1900, 2100, 2300, 2500, "full"] as const;

export type StrengthStep = (typeof STRENGTH_STEPS)[number];

/** The Elo for a step; `"full"` is the player's own `rating`. */
export function strengthElo(step: StrengthStep, rating: number): number {
  return step === "full" ? rating : step;
}
