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

/** Marks a `#/review` history entry that sits right on top of a `#/play` entry. */
const OVER_PLAY = "liem-sparring.reviewOverPlay";

function isOverPlay(state: unknown): boolean {
  return typeof state === "object" && state !== null && (state as Record<string, unknown>)[OVER_PLAY] === true;
}

/**
 * Arrives at the current hash and, when the screen shown has another hash,
 * replaces it (no history entry, no `hashchange`). Returns the screen shown.
 * `from` is the hash just left (a hashchange's old URL): a review opened from
 * `#/play` marks its entry, so Play again can step back onto that entry.
 */
export function followHash(dispatch: AppDispatch, win: HashWindow, from?: string): Screen {
  const shown = dispatch(arriveAt(parseHash(win.location.hash)));
  const hash = hashFor(shown);
  if (win.location.hash !== hash) {
    win.history.replaceState(win.history.state, "", hash);
  } else if (shown === "review" && from !== undefined && parseHash(from) === "play" && !isOverPlay(win.history.state)) {
    const state = typeof win.history.state === "object" && win.history.state !== null ? win.history.state : {};
    win.history.replaceState({ ...state, [OVER_PLAY]: true }, "", hash);
  }
  return shown;
}

/** The parts of `window` that leaving the review for play uses. */
export interface ReviewExitWindow {
  location: { hash: string; replace(url: string): void };
  history: { state: unknown; back(): void };
}

/**
 * Leaves `#/review` for `#/play` without stacking a new entry: Back onto the
 * `#/play` entry under it when there is one, else `#/review` becomes `#/play`.
 * Either way `hashchange` runs the route. Off the review it is `goTo("play")`.
 * Does nothing without `window`.
 */
export function leaveReviewForPlay(win: ReviewExitWindow | undefined = globalWindow()): void {
  if (win === undefined) return;
  if (parseHash(win.location.hash) !== "review") {
    win.location.hash = hashFor("play");
  } else if (isOverPlay(win.history.state)) {
    win.history.back();
  } else {
    win.location.replace(hashFor("play"));
  }
}

function globalWindow(): ReviewExitWindow | undefined {
  return typeof window === "undefined" ? undefined : window;
}
