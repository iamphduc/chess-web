import React from "react";

import "./Board.css";
import { useAppSelector } from "app/hooks";
import { Square } from "./components/Square";

export const Board = () => {
  const { history, possibleMoves } = useAppSelector((state) => state.board);

  const current = history[history.length - 1];
  const squares = [];

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const squareIndex = y * 8 + x;
      const pieceType = current.squares[y][x];
      const isPossibleMove = possibleMoves.includes(squareIndex);

      squares.push(
        <Square
          key={squareIndex}
          y={y}
          x={x}
          pieceType={pieceType}
          isPossibleMove={isPossibleMove}
        />
      );
    }
  }

  return <div className="board">{squares}</div>;
};
