import { useAppDispatch, useAppSelector } from "app/hooks";
import { hashFor } from "app/route";
import React from "react";

import { gameOverNewGame, gameOverView } from "../gameOverView";
import "./GameOver.css";

/**
 * The game-over card over a dimmed board. The scrim takes no clicks, so the
 * final position shows through it; only the card's buttons take clicks.
 */
export const GameOver = () => {
  const dispatch = useAppDispatch();
  const board = useAppSelector((state) => state.board);
  const match = useAppSelector((state) => state.match);
  const view = gameOverView(board, match);
  if (view === null) return null;

  return (
    <div className="game-over">
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
