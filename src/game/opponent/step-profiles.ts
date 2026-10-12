// Imports types only, so `liemTurn` can pull this table into the entry bundle.
import type { SearchLimits } from "./engine/lines";
import type { StrengthStep } from "./strength";

export interface StepProfile {
  search: SearchLimits;
  maxLoss: number;
  temperature: number;
  slipChance: number;
  slipMaxLoss: number;
  aheadMaxLoss: number;
  forceMateIn: number;
}

export const STEP_PROFILES = {} as Readonly<Record<StrengthStep, StepProfile>>;
