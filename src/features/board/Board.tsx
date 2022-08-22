import React from "react";

import "./Board.css";
import { useAppSelector } from "app/hooks";
import { BoardSquare } from "./components/BoardSquare";

export const Board = () => {
  const { history } = useAppSelector((state) => state.board);

  const current = history[history.length - 1];

  const board = [];
  for (let x = 0; x < 8; x++) {
    const row = [];
    for (let y = 0; y < 8; y++) {
      const index = x * 8 + y;
      const piece = current.squares[x * 8 + y];
      row.push(<BoardSquare key={index} x={x} y={y} piece={piece} />);
    }
    board.push(
      <div key={x} className="board__row">
        {row}
      </div>
    );
  }

  return <div className="board">{board}</div>;
};
