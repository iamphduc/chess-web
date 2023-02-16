import { useAppSelector } from "app/hooks";
import React from "react";

import "./GameOver.css";

export enum GameOverType {
  Win = "WIN",
  Draw = "Draw",
  Continue = "Continue",
}

export const GameOver = () => {
  const { history, gameOver } = useAppSelector((state) => state.board);

  const isWhiteTurn = history.length % 2 === 1;

  return gameOver === GameOverType.Continue ? (
    <></>
  ) : (
    <div className="game-over">
      {gameOver === GameOverType.Win && <div>{`${isWhiteTurn ? "White" : "Black"} Win!`}</div>}
      {gameOver === GameOverType.Draw && <div>Draw!</div>}
    </div>
  );
};
