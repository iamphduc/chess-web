// Relative imports only: the Node scripts (run with tsx) may load this file.
import { GameState } from "../engine/game-state";
import { Score } from "./engine/lines";
import { StepProfile } from "./step-profiles";

export const AHEAD_WIN = 85;

export function winPercent(_score: Score): number {
  return NaN;
}

export function chooseHumanMove(
  _lines: readonly { move: string; score: Score }[],
  _state: GameState,
  _profile: StepProfile,
  _random: () => number
): string | null {
  return null;
}
