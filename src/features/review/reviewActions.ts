/* eslint-disable @typescript-eslint/no-unused-vars */
import type { AnyAction, ThunkAction } from "@reduxjs/toolkit";

import type { RootState } from "app/store";
import type { GameState } from "game/engine/game-state";
import type { ReviewModel } from "game/review/types";
import type { StepKey } from "./components/StepButtons";
import type { PositionEval, ReviewState } from "./reviewSlice";

type ReviewThunk<R = void> = ThunkAction<R, RootState, unknown, AnyAction>;

export function canOpenReview(board: RootState["board"], match: RootState["match"]): boolean {
  return false;
}
export const openReview = (): ReviewThunk => () => {};
export const backToGame = (): ReviewThunk => () => {};
export function passStart(evals: readonly (PositionEval | null)[]): number | null {
  return -1;
}
export function keyStep(key: StepKey, review: ReviewState): number | null {
  return -1;
}
export const selectPosition = (n: number, model: ReviewModel): ReviewThunk => () => {};
export const tryMove =
  (ply: number, uci: string, check: (s: GameState) => Promise<PositionEval>): ReviewThunk<Promise<void>> =>
  async () => {};
