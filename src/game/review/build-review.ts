// Relative imports only, no React.
import type { BuildReviewInput, Grade, ReviewModel } from "./types";

export interface MomentCandidate {
  ply: number;
  grade: Grade;
  drop: number;
}

export function pickKeyMoments(
  candidates: readonly MomentCandidate[],
  locked: readonly number[]
): number[] {
  void candidates; void locked;
  return [];
}

export function buildReview(input: BuildReviewInput): ReviewModel {
  void input;
  return {
    moves: [],
    whiteWin: [],
    analysed: 0,
    total: 0,
    accuracy: null,
    counts: { inaccuracy: 0, mistake: 0, blunder: 0 },
    keyMoments: [],
    bookPlies: 0,
    leftBook: null,
  };
}
