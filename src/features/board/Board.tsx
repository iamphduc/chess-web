import React, { useMemo } from "react";
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
  const { history, possibleMoves, pieceAttackedKing } = useAppSelector((state) => state.board);

  const squaresToRender = useMemo(() => {
    const current = history[history.length - 1];
    const previous = history.length >= 2 ? history[history.length - 2] : current;

    const isWhiteTurn = history.length % 2 === 1;
    const isInCheck = pieceAttackedKing !== null;
    const possibleMovesSet = new Set<string>(possibleMoves.map(([y, x]) => `(${y}-${x})`));
    const squares = [];

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const squareIndex = y * 8 + x;
        const currentSquare = current.squares[y][x];
        const previousSquare = previous.squares[y][x];

        const isPossibleMove = possibleMovesSet.has(`(${y}-${x})`);
        const isLastMove = currentSquare.pieceType !== previousSquare.pieceType;
        const isPieceAttackedKing = pieceAttackedKing === currentSquare.pieceType;

        squares.push(
          <Square
            key={squareIndex}
            y={y}
            x={x}
            pieceType={currentSquare.pieceType}
            isPossibleMove={isPossibleMove}
            isLastMove={isLastMove}
            isWhiteTurn={isWhiteTurn}
            isPieceAttackedKing={isPieceAttackedKing}
            isInCheck={isInCheck}
          />
        );
      }
    }
    return squares;
  }, [history, pieceAttackedKing, possibleMoves]);

  return (
    <>
      <div className="board" style={{ width: SQUARE_SIZE * 8 }}>
        {renderPlayer(players[1])}
        <div className="squares">
          <AnimatePresence>{squaresToRender}</AnimatePresence>
          <Promotion />
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
