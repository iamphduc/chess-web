import React from "react";
import { AnimatePresence } from "framer-motion";

import "./Board.css";
import { PlayerInfo, players } from "game/players";
import { useAppSelector } from "app/hooks";
import { Square } from "./components/Square";
import { Player } from "./components/Player";
import { BoardSidebar } from "./components/BoardSidebar";

const renderPlayer = ({ name, title, avatar, isWhite }: PlayerInfo) => (
  <Player name={name} title={title} avatar={avatar} isWhite={isWhite} />
);

export const Board = () => {
  const { history, possibleMoves } = useAppSelector((state) => state.board);

  const squareSize = 52;
  const current = history[history.length - 1];
  const squares = [];

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const squareIndex = y * 8 + x;
      const square = current.squares[y][x];
      const isPossibleMove = possibleMoves.some(([toY, toX]) => toY === y && toX === x);

      squares.push(
        <Square
          key={squareIndex}
          y={y}
          x={x}
          pieceType={square.pieceType}
          isPossibleMove={isPossibleMove}
          size={squareSize}
        />
      );
    }
  }

  return (
    <>
      <div className="board" style={{ width: squareSize * 8 }}>
        {renderPlayer(players[1])}
        <div className="squares">
          <AnimatePresence>{squares}</AnimatePresence>
        </div>
        {renderPlayer(players[0])}
      </div>
      <BoardSidebar />
    </>
  );
};
