import { describe, expect, it } from "vitest";
import { STEP_PROFILES, StepProfile } from "../step-profiles";
import { STRENGTH_STEPS } from "../strength";

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
    }
  });

  it("mate and slip rules per step", () => {
    expect(STEP_PROFILES.full?.slipChance).toBe(0);
    expect(STEP_PROFILES.full?.forceMateIn).toBe(Infinity);
    for (const step of STRENGTH_STEPS) {
      expect(STEP_PROFILES[step]?.forceMateIn, String(step)).toBeGreaterThanOrEqual(1);
    }
  });
});
