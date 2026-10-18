// Imports types only, so `liemTurn` can pull this table into the entry bundle
// without Stockfish.
import type { SearchLimits } from "./engine/lines";
import type { StrengthStep } from "./strength";

/** How one strength step searches and picks among Stockfish's lines. */
export interface StepProfile {
  /** Depth 1–20, multiPv 1–10, movetimeMs 100–1000 (the backstop). */
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
  /*
   * The mistake and blunder bands (see `chooseHumanMove`). Every entry in
   * STEP_PROFILES sets them; they are optional only so older hand-built
   * profiles still type-check, and a missing one counts as 0.
   */
  /** 0–1, the chance per move of a mistake (a line losing 20 to 30 win %). */
  mistakeChance?: number;
  /** 0–1, the chance per move of a blunder (losing 30 or more); with `mistakeChance` ≤ 1. */
  blunderChance?: number;
  /** cp ≥ 0: a blunder falls less than this many centipawns below the best line. */
  blunderMaxCp?: number;
  /** 0–1, the pick weight of a band line that hangs material (1 = like any other). */
  hangWeight?: number;
}

/**
 * Set from `npm run calibrate` (pod-docs/decisions.md, 2026-10-12). Going up the
 * steps, depth never falls and the loss limits, slip chance, slip limit and
 * temperature never rise. A search stops at its depth or its `movetimeMs`,
 * whichever comes first. Full's real limit is time: at 1000 ms it stops at
 * depth 13 to 16 and never reaches 18, yet still plays Stockfish's best move.
 * The 1 s limit stays so phones answer quickly.
 */
export const STEP_PROFILES: Readonly<Record<StrengthStep, StepProfile>> = {
  1400: {
    search: { depth: 8, multiPv: 10, movetimeMs: 400 },
    maxLoss: 10,
    temperature: 5,
    slipChance: 0.05,
    slipMaxLoss: 15,
    aheadMaxLoss: 2,
    forceMateIn: 2,
    mistakeChance: 0.35,
    blunderChance: 0.6,
    blunderMaxCp: 900,
    hangWeight: 1,
  },
  1700: {
    search: { depth: 9, multiPv: 10, movetimeMs: 500 },
    maxLoss: 8,
    temperature: 4,
    slipChance: 0.04,
    slipMaxLoss: 12,
    aheadMaxLoss: 1.5,
    forceMateIn: 3,
    mistakeChance: 0.25,
    blunderChance: 0.6,
    blunderMaxCp: 850,
    hangWeight: 1,
  },
  1900: {
    search: { depth: 10, multiPv: 10, movetimeMs: 600 },
    maxLoss: 6,
    temperature: 3,
    slipChance: 0.03,
    slipMaxLoss: 10,
    aheadMaxLoss: 1.25,
    forceMateIn: 4,
    mistakeChance: 0.25,
    blunderChance: 0.45,
    blunderMaxCp: 800,
    hangWeight: 0.8,
  },
  2100: {
    search: { depth: 11, multiPv: 10, movetimeMs: 700 },
    maxLoss: 4.5,
    temperature: 2.2,
    slipChance: 0.02,
    slipMaxLoss: 8,
    aheadMaxLoss: 1,
    forceMateIn: 6,
    mistakeChance: 0.22,
    blunderChance: 0.4,
    blunderMaxCp: 700,
    hangWeight: 0.8,
  },
  2300: {
    search: { depth: 12, multiPv: 10, movetimeMs: 800 },
    maxLoss: 3,
    temperature: 1.5,
    slipChance: 0.015,
    slipMaxLoss: 6,
    aheadMaxLoss: 0.75,
    forceMateIn: 10,
    mistakeChance: 0.2,
    blunderChance: 0.4,
    blunderMaxCp: 650,
    hangWeight: 0.6,
  },
  2500: {
    search: { depth: 14, multiPv: 10, movetimeMs: 900 },
    maxLoss: 1.5,
    temperature: 0.75,
    slipChance: 0.01,
    slipMaxLoss: 4,
    aheadMaxLoss: 0.5,
    forceMateIn: Infinity,
    mistakeChance: 0.2,
    blunderChance: 0.4,
    blunderMaxCp: 600,
    hangWeight: 0.6,
  },
  full: {
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
  },
};
