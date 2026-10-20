import { useAppSelector } from "app/hooks";
import React from "react";

import "./GameOver.css";

export enum GameOverType {
  Win = "WIN",
  Draw = "Draw",
  Continue = "Continue",
}

export const GameOver = () => {
  const { history, gameOver, flagFallWinner } = useAppSelector((state) => state.board);

  // Checkmate: the side to move lost. A flag fall stores its own winner.
  const isWhiteTurn = history.length % 2 === 1;
  const winner = flagFallWinner ?? (isWhiteTurn ? "Black" : "White");

  return gameOver === GameOverType.Continue ? (
    <></>
  ) : (
    <div className="game-over">
      <div className="game-over__card">
        <p className="game-over__title">
          {gameOver === GameOverType.Win ? `${winner} Win!` : "Draw!"}
        </p>
      </div>
    </div>
  );
};
