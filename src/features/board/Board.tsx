import React from "react";
import { AnimatePresence } from "framer-motion";

import "./Board.css";
import { SQUARE_SIZE } from "../../constants";
import { PlayerInfo, players } from "game/players";
import { useAppSelector } from "app/hooks";
import { Square } from "./components/Square";
import { Player } from "./components/Player";
import { BoardSidebar } from "./components/BoardSidebar";
import { Promotion } from "./components/Promotion";
import { FallenPieces } from "./components/FallenPieces";
import { Notation } from "./components/Notation";
import { GameOver } from "./components/GameOver";
import { Button, ButtonType } from "./components/Button";

const renderPlayer = ({ name, title, avatar, isWhite }: PlayerInfo) => (
  <Player name={name} title={title} avatar={avatar} isWhite={isWhite} />
);

export const Board = () => {
  const { history, possibleMoves, promotionPosition } = useAppSelector((state) => state.board);

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
        />
      );
    }
  }

  return (
    <>
      <div className="board" style={{ width: SQUARE_SIZE * 8 }}>
        {renderPlayer(players[1])}
        <div className="squares">
          <AnimatePresence>{squares}</AnimatePresence>
          {promotionPosition[0] !== -1 && <Promotion position={promotionPosition} />}
          <GameOver />
        </div>
        {renderPlayer(players[0])}
      </div>

      <div className="sidebar">
        <BoardSidebar title="">
          <div className="buttons">
            <Button type={ButtonType.Play} />
            <Button type={ButtonType.Reset} />
          </div>
        </BoardSidebar>

        <BoardSidebar title="Fallen Pieces">
          <FallenPieces />
        </BoardSidebar>

        <BoardSidebar title="Notation">
          <Notation />
        </BoardSidebar>
      </div>
    </>
  );
};
