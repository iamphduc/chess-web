// Stub: filled in by the feat commit.
import type { Score } from "../../src/game/opponent/engine/lines";

export type { Score };
export type Side = "white" | "black";

export interface GradedGame {
  uci: string[];
  evals: Score[];
  graded: boolean[];
  sides: Side[];
}

export interface GradeRates {
  inaccuracy: number | null;
  mistake: number | null;
  blunder: number | null;
}

export interface LevelRates {
  games: number;
  sides: number;
  gradedMoves: number;
  per40: {
    review: GradeRates;
    lichess: GradeRates;
    hung: number | null;
    missedCapture: number | null;
  };
  avgLoss: number | null;
  accuracy: number | null;
}

export const TARGET_SHARE = 0;
export const TOLERANCE = 0;

export function cpLoss(_before: Score, _after: Score): number {
  return -1;
}

export function measureGames<G extends GradedGame>(
  _games: readonly G[],
  _opts?: { accuracy?: (game: G, side: Side) => number | null }
): LevelRates {
  const r = { inaccuracy: -1, mistake: -1, blunder: -1 };
  return {
    games: -1,
    sides: -1,
    gradedMoves: -1,
    per40: { review: r, lichess: r, hung: -1, missedCapture: -1 },
    avgLoss: -1,
    accuracy: -1,
  };
}

export function targetFor(_human: number | null): number | null {
  return -1;
}

export function withinTarget(_bot: number | null, _human: number | null): boolean {
  return false;
}
