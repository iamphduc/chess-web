import React, { useMemo } from "react";
import { AnimatePresence, MotionConfig } from "framer-motion";

import "./Board.css";
import { SQUARE_SIZE_MD, SQUARE_SIZE_XL, SQUARE_SIZE_XS } from "../../constants";
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
import { useMediaQuery } from "hooks/useMediaQuery";
import { displayOrder } from "./orientation";

// Keyed by color, so each card (and its running clock) keeps its state when the cards swap.
const renderPlayer = ({ name, title, avatar, isWhite }: PlayerInfo) => (
  <Player
    key={isWhite ? "white" : "black"}
    name={name}
    title={title}
    avatar={avatar}
    isWhite={isWhite}
  />
);

export const Board = () => {
  const { history, possibleMoves, lastMoves, pieceAttackedKing } = useAppSelector(
    (state) => state.board
  );
  const flipped = useAppSelector((state) => state.view.flipped);

  let squareSize = SQUARE_SIZE_XS;
  if (useMediaQuery("only screen and (min-width: 768px)")) squareSize = SQUARE_SIZE_MD;
  if (useMediaQuery("only screen and (min-width: 1200px)")) squareSize = SQUARE_SIZE_XL;

  const squaresToRender = useMemo(() => {
    const current = history[history.length - 1];
    const lastMove = lastMoves[lastMoves.length - 1];

    const isWhiteTurn = history.length % 2 === 1;
    const isInCheck = pieceAttackedKing !== null;
    const possibleMovesSet = new Set<string>(possibleMoves.map(([y, x]) => `(${y}-${x})`));
    const squares = [];

    // Render order follows the flip; the key stays the board index, so a flip only reorders squares.
    for (const [y, x] of displayOrder(flipped)) {
      const squareIndex = y * 8 + x;
      const currentSquare = current.squares[y][x];

      const isPossibleMove = possibleMovesSet.has(`(${y}-${x})`);
      const isLastMoveFrom = lastMove[0][0] === y && lastMove[0][1] === x;
      const isLastMoveTo = lastMove[1][0] === y && lastMove[1][1] === x;
      const isPieceAttackedKing = pieceAttackedKing === currentSquare.pieceType;

      squares.push(
        <Square
          key={squareIndex}
          y={y}
          x={x}
          pieceType={currentSquare.pieceType}
          isPossibleMove={isPossibleMove}
          isLastMove={isLastMoveFrom || isLastMoveTo}
          isWhiteTurn={isWhiteTurn}
          isPieceAttackedKing={isPieceAttackedKing}
          isInCheck={isInCheck}
          size={squareSize}
        />
      );
    }
    return squares;
  }, [flipped, history, lastMoves, pieceAttackedKing, possibleMoves, squareSize]);

  const [white, black] = players;
  const [top, bottom] = flipped ? [white, black] : [black, white];

  return (
    <MotionConfig reducedMotion="user">
      <div className="board" style={{ width: squareSize * 8 }}>
        {renderPlayer(top)}
        <div key="squares" className="squares">
          <AnimatePresence>{squaresToRender}</AnimatePresence>
          <Promotion squareSize={squareSize} />
          <GameOver />
        </div>
        {renderPlayer(bottom)}
      </div>

      <div className="sidebar">
        <BoardSidebar title="">
          <div className="buttons">
            <Button type={ButtonType.Play} />
            <Button type={ButtonType.Reset} />
            <Button type={ButtonType.Flip} />
          </div>
        </BoardSidebar>

        <BoardSidebar title="Fallen Pieces">
          <FallenPieces />
        </BoardSidebar>

        <BoardSidebar title="Notation">
          <Notation />
        </BoardSidebar>
      </div>
    </MotionConfig>
  );
};
