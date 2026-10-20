import type { AnyAction, ThunkAction } from "@reduxjs/toolkit";

import type { RootState } from "app/store";
import { replayLiemGame } from "features/liem/liemActions";
import type { Mode } from "features/liem/matchSlice";
import { canOpenReview } from "features/review/reviewActions";
import { reset } from "./BoardSlice";
import { type EndReason, gameEnd } from "./gameEnd";

/** What the game-over card says, and whether it offers Review game. */
export interface GameOverView {
  /** "White wins", "Black wins" or "Draw", in both modes. */
  title: string;
  /** "Checkmate", "Stalemate", "On time" or "Resigned". */
  reason: string;
  /** Review game shows: a finished vs-Liem game with a move of yours. */
  review: boolean;
}

const REASONS: Record<EndReason, string> = {
  checkmate: "Checkmate",
  stalemate: "Stalemate",
  time: "On time",
  resigned: "Resigned",
};

type ViewBoard = Pick<
  RootState["board"],
  "result" | "pendingPromotion" | "engineHistory" | "humanColor" | "gameOver"
>;

/**
 * The card for a finished game, or `null` while the game goes on. It also waits
 * while a promotion pick is pending, so the picker can still be clicked.
 */
export function gameOverView(
  board: ViewBoard,
  match: Pick<RootState["match"], "mode" | "setupOpen">
): GameOverView | null {
  const end = gameEnd(board);
  if (end === null || board.pendingPromotion !== null) return null;
  const title = end.winner === null ? "Draw" : end.winner === "white" ? "White wins" : "Black wins";
  return { title, reason: REASONS[end.reason], review: canOpenReview(board, match) };
}

/** New game from the card: vs Liem replays the level and color; Two players gets a fresh board. */
export function gameOverNewGame(mode: Mode): ThunkAction<void, RootState, unknown, AnyAction> {
  if (mode === "liem") return replayLiemGame();
  return (dispatch) => {
    dispatch(reset());
  };
}
