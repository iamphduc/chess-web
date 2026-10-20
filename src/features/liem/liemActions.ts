import type { AnyAction, ThunkAction } from "@reduxjs/toolkit";

import type { RootState } from "app/store";
import { newGame, reset } from "features/board/BoardSlice";
import { setFlipped } from "features/board/viewSlice";
import { gameStarted, type Mode, openSetup, resolveColor, setMode } from "./matchSlice";

type LiemThunk = ThunkAction<void, RootState, unknown, AnyAction>;

/** The same mode does nothing. Otherwise a fresh board in the new mode; the flip stays. */
export const switchMode =
  (mode: Mode): LiemThunk =>
  (dispatch, getState) => {
    if (getState().match.mode === mode) return;
    dispatch(reset());
    dispatch(setMode(mode));
  };

/** Ends the vs-Liem game and reopens the setup card. Does nothing in two-player mode. */
export const newLiemGame = (): LiemThunk => (dispatch, getState) => {
  if (getState().match.mode !== "liem") return;
  dispatch(reset());
  dispatch(openSetup());
};

/**
 * Starts a vs-Liem game with the card's color pick; Black sees the board flipped.
 * Does nothing unless the setup card is open, so a second Start keeps the game.
 */
export const startLiemGame =
  (random?: () => number): LiemThunk =>
  (dispatch, getState) => {
    const { mode, setupOpen, colorPick } = getState().match;
    if (mode !== "liem" || !setupOpen) return;
    const humanColor = resolveColor(colorPick, random);
    dispatch(gameStarted());
    dispatch(newGame({ humanColor }));
    dispatch(setFlipped(humanColor === "black"));
  };

/** A vs-Liem game has started (running or over): the card is closed in liem mode. */
export function liemGameStarted(match: Pick<RootState["match"], "mode" | "setupOpen">): boolean {
  return match.mode === "liem" && !match.setupOpen;
}

/**
 * The home state: vs Liem with the card open and no game or review. Two
 * players switches back to vs Liem. The level and color picks stay.
 */
export const goHome = (): LiemThunk => (dispatch, getState) => {
  if (getState().match.mode !== "liem") {
    dispatch(switchMode("liem"));
    return;
  }
  dispatch(reset());
  dispatch(openSetup());
};

/**
 * New game from the board: the same level and color pick (Random draws again),
 * the board turned to the new color and any review cleared. Only with a
 * vs-Liem game started; does nothing on home or in two players.
 */
export const replayLiemGame =
  (random?: () => number): LiemThunk =>
  (dispatch, getState) => {
    if (!liemGameStarted(getState().match)) return;
    dispatch(reset());
    dispatch(openSetup());
    dispatch(startLiemGame(random));
  };
