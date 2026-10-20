/*
 * What the review screen shows where, and its Moves card foot's Play again. Pure rules,
 * so Board.tsx only wires them up.
 */
import type { AnyAction, ThunkAction } from "@reduxjs/toolkit";

import type { RootState } from "app/store";
import { leaveReviewForPlay } from "app/route";
import { replayLiemGame } from "features/liem/liemActions";

export type GraphPlace = "sidebar" | "sheet";

export interface GraphPlacementInput {
  /** 768 px and up: no bottom sheet. */
  wide: boolean;
  sheetOpen: boolean;
  /** The sheet sits low while you try a move: only its title and buttons show. */
  low: boolean;
}

/**
 * Where the win % graph goes, so it shows exactly once: the top of the phone's
 * sheet while the sheet is open and up, else the top of the sidebar.
 */
export function graphPlacement({ wide, sheetOpen, low }: GraphPlacementInput): GraphPlace {
  return !wide && sheetOpen && !low ? "sheet" : "sidebar";
}

/**
 * Play again: a new game at the same level and color (Random draws again), then
 * `#/play` with no new history entry, so one Back from the board goes home.
 */
export const playAgain =
  (random?: () => number): ThunkAction<void, RootState, unknown, AnyAction> =>
  (dispatch) => {
    dispatch(replayLiemGame(random));
    leaveReviewForPlay();
  };
