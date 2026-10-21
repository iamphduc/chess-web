import { useAppDispatch, useAppSelector } from "app/hooks";
import { hashFor } from "app/route";
import React, { useRef } from "react";

import { type Entrance, firstShownAt, gameOverEntrance, prefersReducedMotion } from "../gameOverEntrance";
import { gameOverNewGame, gameOverView } from "../gameOverView";
import "./GameOver.css";

/**
 * The entrance for this mount's card, decided once when the card for `end` first
 * renders here, so a re-render or a resize never changes or replays it.
 */
function useEntrance(end: object | null): Entrance {
  const decided = useRef<{ end: object; entrance: Entrance } | null>(null);
  if (end === null) {
    decided.current = null;
    return "instant";
  }
  if (decided.current?.end !== end) {
    const now = Date.now();
    decided.current = { end, entrance: gameOverEntrance(prefersReducedMotion(), firstShownAt(end, now), now) };
  }
  return decided.current.entrance;
}

/**
 * The game-over card over a dimmed board. The scrim takes no clicks, so the
 * final position shows through it; only the card's buttons take clicks.
 */
export const GameOver = () => {
  const dispatch = useAppDispatch();
  const board = useAppSelector((state) => state.board);
  const match = useAppSelector((state) => state.match);
  const view = gameOverView(board, match);
  // The card is due once there's a view, so the pause starts after a pending promotion pick.
  const entrance = useEntrance(view === null ? null : board.result);
  if (view === null) return null;

  return (
    <div className="game-over" data-entrance={entrance}>
      <div className="game-over__card">
        <p className="game-over__title">{view.title}</p>
        <p className="game-over__reason">{view.reason}</p>
        <div className="game-over__actions">
          {view.review && (
            <a className="button button--play" href={hashFor("review")}>
              Review game
            </a>
          )}
          <button type="button" className="button" onClick={() => dispatch(gameOverNewGame(match.mode))}>
            New game
          </button>
        </div>
      </div>
    </div>
  );
};
