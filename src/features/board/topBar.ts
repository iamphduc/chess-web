import type { RootState } from "app/store";
import type { PieceColor } from "game/engine/game-state";
import type { StrengthStep } from "game/opponent/strength";
import { levelView } from "features/liem/levelView";
import type { Mode } from "features/liem/matchSlice";

/** What the board screen's top bar title depends on. */
export interface TopBarInput {
  mode: Mode;
  strength: StrengthStep;
  /** The side you play: the game's color, or the pick so far before a game. */
  humanColor: PieceColor;
  review: boolean;
}

const COLOR_NAMES: Record<PieceColor, string> = { white: "White", black: "Black" };

/**
 * The top bar's title: "vs Medium · you play White", "vs Liem · you play Black",
 * "Two players" or "Review · vs Medium". Names come from `levelView`, never a rating.
 */
export function topBarTitle({ mode, strength, humanColor, review }: TopBarInput): string {
  if (mode === "two-player") return "Two players";
  const vs = `vs ${levelView(strength).opponentName}`;
  if (review) return `Review · ${vs}`;
  return `${vs} · you play ${COLOR_NAMES[humanColor]}`;
}

/** The title's input from the store. Before a game it's the pick so far: Random shows White. */
export function topBarInput(state: RootState): TopBarInput {
  const { mode, strength, colorPick } = state.match;
  const picked: PieceColor = colorPick === "black" ? "black" : "white";
  return {
    mode,
    strength,
    humanColor: state.board.humanColor ?? picked,
    review: state.review.open,
  };
}
