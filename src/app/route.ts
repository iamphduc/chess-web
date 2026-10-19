import type { AnyAction, ThunkAction } from "@reduxjs/toolkit";

import type { AppDispatch, RootState } from "app/store";
import { goHome, liemGameStarted, switchMode } from "features/liem/liemActions";
import { backToGame, canOpenReview, openReview } from "features/review/reviewActions";

export type Screen = "home" | "play" | "two-players" | "review";

const HASHES: Record<Screen, string> = {
  home: "#/",
  play: "#/play",
  "two-players": "#/two-players",
  review: "#/review",
};

/** `""`, `"#"` and `"#/"` are home; the other screens match their hash exactly. Else `null`. */
export function parseHash(hash: string): Screen | null {
  if (hash === "" || hash === "#") return "home";
  const found = (Object.keys(HASHES) as Screen[]).find((screen) => HASHES[screen] === hash);
  return found ?? null;
}

export function hashFor(screen: Screen): string {
  return HASHES[screen];
}

/** Shows `screen` by setting the hash, which adds a history entry. Does nothing without `window`. */
export function goTo(screen: Screen): void {
  if (typeof window === "undefined") return;
  window.location.hash = hashFor(screen);
}

type RouteThunk = ThunkAction<Screen, RootState, unknown, AnyAction>;

function isHome(state: RootState): boolean {
  return state.match.mode === "liem" && state.match.setupOpen && !state.review.open;
}

/**
 * Brings the store in line with the requested screen and returns the screen to
 * show. Anything that can't be shown falls back to play, then home; home ends
 * the game in progress but keeps the level and color picks.
 */
export const arriveAt =
  (requested: Screen | null): RouteThunk =>
  (dispatch, getState) => {
    const home = (): Screen => {
      if (!isHome(getState())) dispatch(goHome());
      return "home";
    };
    const play = (): Screen => {
      if (!liemGameStarted(getState().match)) return home();
      if (getState().review.open) dispatch(backToGame());
      return "play";
    };

    switch (requested) {
      case "play":
        return play();
      case "two-players":
        dispatch(switchMode("two-player"));
        return "two-players";
      case "review": {
        const { board, match } = getState();
        if (!canOpenReview(board, match)) return play();
        dispatch(openReview());
        return "review";
      }
      default:
        return home();
    }
  };

/** The parts of `window` the hash route reads and writes. */
export interface HashWindow {
  location: { hash: string };
  history: { state: unknown; replaceState(state: unknown, unused: string, url: string): void };
}

/**
 * Arrives at the current hash and, when the screen shown has another hash,
 * replaces it (no history entry, no `hashchange`). Returns the screen shown.
 */
export function followHash(dispatch: AppDispatch, win: HashWindow): Screen {
  const shown = dispatch(arriveAt(parseHash(win.location.hash)));
  const hash = hashFor(shown);
  if (win.location.hash !== hash) win.history.replaceState(win.history.state, "", hash);
  return shown;
}
