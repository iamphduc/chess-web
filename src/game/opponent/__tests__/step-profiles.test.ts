import { describe, expect, it } from "vitest";
import { BLUNDER_LOSS, winPercent } from "../human-move";
import { STEP_PROFILES, StepProfile } from "../step-profiles";
import { STRENGTH_STEPS } from "../strength";

const SPARRING = STRENGTH_STEPS.filter((s) => s !== "full");

/** The cp score whose win % is `win` (the inverse of the Lichess formula). */
const cpFor = (win: number) => {
  const p = (win - 50) / 50;
  return -Math.log((1 - p) / (1 + p)) / 0.00368208;
};

/**
 * The fewest centipawns a cp-scored blunder can fall below the top line: a
 * BLUNDER_LOSS drop centred on 50 % (the steepest part of the curve).
 */
const SMALLEST_BLUNDER_CP = cpFor(50 + BLUNDER_LOSS / 2) - cpFor(50 - BLUNDER_LOSS / 2);

const isWhole = (n: number) => Number.isInteger(n);

describe("STEP_PROFILES", () => {
  it("every step has a profile within the bounds", () => {
    expect(Object.keys(STEP_PROFILES).sort()).toEqual(STRENGTH_STEPS.map(String).sort());
    for (const step of STRENGTH_STEPS) {
      const p: StepProfile = STEP_PROFILES[step];
      const { depth, multiPv, movetimeMs } = p.search;
      expect(isWhole(depth) && depth >= 1 && depth <= 20, `${step} depth`).toBe(true);
      expect(isWhole(multiPv) && multiPv >= 1 && multiPv <= 10, `${step} multiPv`).toBe(true);
      const { mistakeChance, blunderChance, blunderMaxCp, hangWeight } = p;
      const isChance = (n: unknown) => typeof n === "number" && n >= 0 && n <= 1;
      expect(isChance(mistakeChance), `${step} mistakeChance`).toBe(true);
      expect(isChance(blunderChance), `${step} blunderChance`).toBe(true);
      expect((mistakeChance ?? NaN) + (blunderChance ?? NaN), `${step} chances sum`).toBeLessThanOrEqual(1);
      expect(typeof blunderMaxCp === "number" && blunderMaxCp >= 0, `${step} blunderMaxCp`).toBe(
        true
      );
      expect(isChance(hangWeight), `${step} hangWeight`).toBe(true);
      expect(movetimeMs >= 100 && movetimeMs <= 1000, `${step} movetimeMs`).toBe(true);
      expect(p.maxLoss, `${step} maxLoss`).toBeGreaterThanOrEqual(0);
      expect(p.temperature, `${step} temperature`).toBeGreaterThanOrEqual(0);
      expect(p.slipChance >= 0 && p.slipChance <= 1, `${step} slipChance`).toBe(true);
      expect(p.slipMaxLoss, `${step} slipMaxLoss`).toBeGreaterThanOrEqual(p.maxLoss);
      expect(p.aheadMaxLoss, `${step} aheadMaxLoss`).toBeGreaterThanOrEqual(0);
      expect(p.aheadMaxLoss, `${step} aheadMaxLoss`).toBeLessThanOrEqual(p.maxLoss);
      const mate = p.forceMateIn;
      expect(mate === Infinity || (isWhole(mate) && mate >= 0), `${step} forceMateIn`).toBe(
        true
      );
    }
  });

  it("stronger steps never search shallower or allow bigger losses", () => {
    expect(Object.keys(STEP_PROFILES)).toHaveLength(STRENGTH_STEPS.length);
    for (let i = 1; i < STRENGTH_STEPS.length; i++) {
      const lower = STEP_PROFILES[STRENGTH_STEPS[i - 1]];
      const upper = STEP_PROFILES[STRENGTH_STEPS[i]];
      const name = `${STRENGTH_STEPS[i - 1]} to ${STRENGTH_STEPS[i]}`;
      expect(upper.search.depth, name).toBeGreaterThanOrEqual(lower.search.depth);
      expect(upper.maxLoss, name).toBeLessThanOrEqual(lower.maxLoss);
      expect(upper.slipChance, name).toBeLessThanOrEqual(lower.slipChance);
      expect(upper.slipMaxLoss, name).toBeLessThanOrEqual(lower.slipMaxLoss);
      expect(upper.temperature, name).toBeLessThanOrEqual(lower.temperature);
      expect(upper.mistakeChance ?? 0, `${name} mistakeChance`).toBeLessThanOrEqual(
        lower.mistakeChance ?? 0
      );
      expect(upper.blunderChance ?? 0, `${name} blunderChance`).toBeLessThanOrEqual(
        lower.blunderChance ?? 0
      );
      expect(upper.blunderMaxCp ?? 0, `${name} blunderMaxCp`).toBeLessThanOrEqual(
        lower.blunderMaxCp ?? 0
      );
      expect(upper.hangWeight ?? 0, `${name} hangWeight`).toBeLessThanOrEqual(
        lower.hangWeight ?? 0
      );
    }
  });

  it("mate and slip rules per step", () => {
    expect(STEP_PROFILES.full?.slipChance).toBe(0);
    expect(STEP_PROFILES.full?.forceMateIn).toBe(Infinity);
    for (const step of STRENGTH_STEPS) {
      const least = step === "full" || step >= 1900 ? 2 : 1;
      expect(STEP_PROFILES[step]?.forceMateIn, String(step)).toBeGreaterThanOrEqual(least);
    }
  });

  it("sparring levels make mistakes, Liem doesn't", () => {
    expect(SMALLEST_BLUNDER_CP).toBeGreaterThan(330);
    for (const step of SPARRING) {
      const p = STEP_PROFILES[step];
      expect(p.mistakeChance ?? 0, `${step} mistakeChance`).toBeGreaterThan(0);
      expect(p.blunderChance ?? 0, `${step} blunderChance`).toBeGreaterThan(0);
      // Under this cap no cp-scored blunder could ever be picked.
      expect(p.blunderMaxCp ?? 0, `${step} blunderMaxCp`).toBeGreaterThan(SMALLEST_BLUNDER_CP);
    }
    // Liem is exactly as before the ladder: full Stockfish, no bands.
    expect(STEP_PROFILES.full).toEqual({
      search: { depth: 18, multiPv: 4, movetimeMs: 1000 },
      maxLoss: 0,
      temperature: 0,
      slipChance: 0,
      slipMaxLoss: 0,
      aheadMaxLoss: 0,
      forceMateIn: Infinity,
      mistakeChance: 0,
      blunderChance: 0,
      blunderMaxCp: 0,
      hangWeight: 0,
    });
  });
});
