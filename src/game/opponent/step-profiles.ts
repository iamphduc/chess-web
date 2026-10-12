// Imports types only, so `liemTurn` can pull this table into the entry bundle
// without Stockfish.
import type { SearchLimits } from "./engine/lines";
import type { StrengthStep } from "./strength";

/** How one strength step searches and picks among Stockfish's lines. */
export interface StepProfile {
  /** Depth 1–20, multiPv 1–6, movetimeMs 100–1000 (the backstop). */
  search: SearchLimits;
  /** Normal loss limit, in win % points, ≥ 0. */
  maxLoss: number;
  /** Pick weight is `exp(-loss / temperature)`; 0 plays only loss-0 lines. */
  temperature: number;
  /** 0–1, the chance per move of a rare bigger slip. */
  slipChance: number;
  /** Slip loss limit, ≥ `maxLoss`. */
  slipMaxLoss: number;
  /** Loss limit while well ahead, ≤ `maxLoss`. */
  aheadMaxLoss: number;
  /** Always plays a seen mate in ≤ this many moves; Infinity = any; 0 = never forced. */
  forceMateIn: number;
}

/**
 * Starting guesses, to be replaced by the calibration run (sprint K1). Going
 * up the steps, depth never falls and the loss limits, slip chance, slip limit
 * and temperature never rise.
 */
export const STEP_PROFILES: Readonly<Record<StrengthStep, StepProfile>> = {
  1400: {
    search: { depth: 5, multiPv: 4, movetimeMs: 400 },
    maxLoss: 12,
    temperature: 6,
    slipChance: 0.08,
    slipMaxLoss: 25,
    aheadMaxLoss: 5,
    forceMateIn: 2,
  },
  1700: {
    search: { depth: 6, multiPv: 4, movetimeMs: 500 },
    maxLoss: 9,
    temperature: 4.5,
    slipChance: 0.06,
    slipMaxLoss: 20,
    aheadMaxLoss: 4,
    forceMateIn: 3,
  },
  1900: {
    search: { depth: 8, multiPv: 4, movetimeMs: 600 },
    maxLoss: 7,
    temperature: 3.5,
    slipChance: 0.04,
    slipMaxLoss: 15,
    aheadMaxLoss: 3,
    forceMateIn: 4,
  },
  2100: {
    search: { depth: 10, multiPv: 4, movetimeMs: 700 },
    maxLoss: 5,
    temperature: 2.5,
    slipChance: 0.03,
    slipMaxLoss: 12,
    aheadMaxLoss: 2,
    forceMateIn: 6,
  },
  2300: {
    search: { depth: 12, multiPv: 4, movetimeMs: 800 },
    maxLoss: 3,
    temperature: 1.5,
    slipChance: 0.02,
    slipMaxLoss: 8,
    aheadMaxLoss: 1,
    forceMateIn: 10,
  },
  2500: {
    search: { depth: 14, multiPv: 4, movetimeMs: 900 },
    maxLoss: 1.5,
    temperature: 0.75,
    slipChance: 0.01,
    slipMaxLoss: 4,
    aheadMaxLoss: 0.5,
    forceMateIn: Infinity,
  },
  full: {
    search: { depth: 18, multiPv: 4, movetimeMs: 1000 },
    maxLoss: 0,
    temperature: 0,
    slipChance: 0,
    slipMaxLoss: 0,
    aheadMaxLoss: 0,
    forceMateIn: Infinity,
  },
};
