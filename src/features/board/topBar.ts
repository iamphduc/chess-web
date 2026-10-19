import type { RootState } from "app/store";
import type { PieceColor } from "game/engine/game-state";
import type { StrengthStep } from "game/opponent/strength";
import type { Mode } from "features/liem/matchSlice";

export interface TopBarInput {
  mode: Mode;
  strength: StrengthStep;
  humanColor: PieceColor;
  review: boolean;
}

export function topBarTitle(_input: TopBarInput): string {
  return "";
}

export function topBarInput(state: RootState): TopBarInput {
  return { mode: state.match.mode, strength: state.match.strength, humanColor: "white", review: false };
}
