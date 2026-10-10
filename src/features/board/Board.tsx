import React, { useMemo } from "react";
import { AnimatePresence, MotionConfig } from "framer-motion";

import "./Board.css";
import { SQUARE_SIZE_MD, SQUARE_SIZE_XL, SQUARE_SIZE_XS } from "../../constants";
import { PlayerInfo, players } from "game/players";
import { useAppDispatch, useAppSelector } from "app/hooks";
import type { RootState } from "app/store";
import type { PieceColor } from "game/engine/game-state";
import { LIEM } from "game/opponent/players";
import { ModeTabs } from "features/liem/components/ModeTabs";
import { SetupCard } from "features/liem/components/SetupCard";
import { BookNote } from "features/liem/components/BookNote";
import { LiemCardDetail } from "features/liem/components/LiemCardDetail";
import { newLiemGame } from "features/liem/liemActions";
import { useLiemOpponent } from "features/liem/useLiemOpponent";
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
import { useMoveSound } from "./useMoveSound";

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

/** One sidebar card in a vs-Liem game. `data-color` names the side it plays. */
const LiemSideCard = ({ color, children }: { color: PieceColor; children: React.ReactNode }) => (
  <div className="liem-side__card" data-color={color}>
    {children}
  </div>
);

/** The sidebar's vs-Liem block: his card, his book note, then yours. His data is `LIEM.entry` only. */
const LiemSide = ({ humanColor, onRetry }: { humanColor: PieceColor; onRetry: () => void }) => {
  const hisColor: PieceColor = humanColor === "white" ? "black" : "white";
  const { name, title, avatar } = LIEM.entry;
  return (
    <div className="liem-side">
      <LiemSideCard color={hisColor}>
        <Player
          key={hisColor}
          name={name}
          title={title}
          avatar={avatar}
          isWhite={hisColor === "white"}
          detail={<LiemCardDetail />}
        />
      </LiemSideCard>
      <BookNote onRetry={onRetry} />
      <LiemSideCard color={humanColor}>
        <Player key={humanColor} name="You" title={null} avatar={null} isWhite={humanColor === "white"} />
      </LiemSideCard>
    </div>
  );
};

const NewGameButton = () => {
  const dispatch = useAppDispatch();
  return (
    <button type="button" className="button" onClick={() => dispatch(newLiemGame())}>
      New game
    </button>
  );
};

export const Board = () => {
  const { history, possibleMoves, lastMoves, pieceAttackedKing } = useAppSelector(
    (state) => state.board
  );
  const flipped = useAppSelector((state) => state.view.flipped);
  const humanColor = useAppSelector((state) => state.board.humanColor);
  // Older test stores have no `match` reducer; they get the two-player board.
  const match = useAppSelector((state) => state.match as RootState["match"] | undefined);
  useMoveSound();
  const { retry } = useLiemOpponent();

  const vsLiem = match?.mode === "liem";
  const setupOpen = vsLiem && match.setupOpen;
  const liemHuman = vsLiem && !setupOpen ? humanColor : null;

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
        {match && <ModeTabs />}
        {!vsLiem && renderPlayer(top)}
        {setupOpen ? (
          <div key="squares" className="squares squares--setup">
            <div className="squares__grid liem-dimmed" aria-hidden="true">
              <AnimatePresence>{squaresToRender}</AnimatePresence>
            </div>
            <div className="squares__overlay">
              <SetupCard />
            </div>
          </div>
        ) : (
          <div key="squares" className="squares">
            <AnimatePresence>{squaresToRender}</AnimatePresence>
            <Promotion squareSize={squareSize} />
            <GameOver />
          </div>
        )}
        {!vsLiem && renderPlayer(bottom)}
      </div>

      <div className="sidebar">
        {liemHuman && <LiemSide humanColor={liemHuman} onRetry={retry} />}

        <BoardSidebar title="">
          <div className="buttons">
            {vsLiem ? (
              <>
                {liemHuman && <NewGameButton />}
                <Button type={ButtonType.Flip} />
                <Button type={ButtonType.Sound} />
              </>
            ) : (
              <>
                <Button type={ButtonType.Play} />
                <Button type={ButtonType.Reset} />
                <Button type={ButtonType.Flip} />
                <Button type={ButtonType.Sound} />
              </>
            )}
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
