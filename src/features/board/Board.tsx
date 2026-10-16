import React, { useMemo } from "react";
import { AnimatePresence, MotionConfig } from "framer-motion";

import "./Board.css";
import { SQUARE_SIZE_MD, SQUARE_SIZE_XL, SQUARE_SIZE_XS } from "../../constants";
import { PlayerInfo, players } from "game/players";
import { useAppDispatch, useAppSelector } from "app/hooks";
import type { PieceColor } from "game/engine/game-state";
import { LIEM } from "game/opponent/players";
import { ModeTabs } from "features/liem/components/ModeTabs";
import { SetupCard } from "features/liem/components/SetupCard";
import { BookNote } from "features/liem/components/BookNote";
import { LiemCardDetail } from "features/liem/components/LiemCardDetail";
import { newLiemGame } from "features/liem/liemActions";
import { useLiemOpponent } from "features/liem/useLiemOpponent";
import { ReviewGraph } from "features/review/components/ReviewGraph";
import { ReviewBoard } from "features/review/components/ReviewBoard";
import { StepButtons } from "features/review/components/StepButtons";
import { KeyMomentCard } from "features/review/components/KeyMomentCard";
import { BottomSheet } from "features/review/components/BottomSheet";
import { AccuracyPanel } from "features/review/components/AccuracyPanel";
import { MoveList } from "features/review/components/MoveList";
import { LeftBookNote } from "features/review/components/LeftBookNote";
import { keyMomentView } from "features/review/keyMomentView";
import { backToGame, canOpenReview, openReview, selectPosition, steppingLocked } from "features/review/reviewActions";
import {
  analysisRetried,
  answerShown,
  momentOpened,
  momentSkipped,
  setGraphSide,
  sheetClosed,
} from "features/review/reviewSlice";
import { selectReview, useGameReview } from "features/review/useGameReview";
import type { ReviewModel } from "game/review/types";
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

/** His card: name, title and avatar from `LIEM.entry` only, with his strength and Book badge. */
const renderLiem = (color: PieceColor) => {
  const { name, title, avatar } = LIEM.entry;
  return (
    <Player
      key={color}
      name={name}
      title={title}
      avatar={avatar}
      isWhite={color === "white"}
      detail={<LiemCardDetail />}
    />
  );
};

const renderYou = (color: PieceColor) => (
  <Player key={color} name="You" title={null} avatar={null} isWhite={color === "white"} />
);

const ReviewGameButton = () => {
  const dispatch = useAppDispatch();
  return (
    <button type="button" className="button button--play" onClick={() => dispatch(openReview())}>
      Review game
    </button>
  );
};

const BackToGameButton = () => {
  const dispatch = useAppDispatch();
  return (
    <button type="button" className="button button--play" onClick={() => dispatch(backToGame())}>
      Back to game
    </button>
  );
};

/** The key-moment card, wired to the review's actions. */
const ReviewCard = ({ model, humanColor }: { model: ReviewModel; humanColor: PieceColor }) => {
  const dispatch = useAppDispatch();
  const review = useAppSelector(selectReview);
  return (
    <KeyMomentCard
      model={model}
      review={review}
      humanColor={humanColor}
      onStart={(ply) => dispatch(momentOpened(ply))}
      onShowAnswer={(ply) => dispatch(answerShown(ply))}
      onSkip={(ply) => dispatch(momentSkipped(ply))}
      onNext={(ply) => dispatch(momentOpened(ply))}
      onRetry={() => dispatch(analysisRetried())}
    />
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
  const match = useAppSelector((state) => state.match);
  const review = useAppSelector(selectReview);
  const engineHistory = useAppSelector((state) => state.board.engineHistory);
  const reviewable = useAppSelector((state) => canOpenReview(state.board, state.match));
  const dispatch = useAppDispatch();
  useMoveSound();
  const { retry, analyse } = useLiemOpponent();
  const { model, onTry } = useGameReview(analyse);

  const vsLiem = match.mode === "liem";
  const setupOpen = vsLiem && match.setupOpen;
  const liemHuman: PieceColor | null = vsLiem && !setupOpen ? humanColor : null;

  const wide = useMediaQuery("only screen and (min-width: 768px)");
  const extraWide = useMediaQuery("only screen and (min-width: 1200px)");
  let squareSize = SQUARE_SIZE_XS;
  if (wide) squareSize = SQUARE_SIZE_MD;
  if (extraWide) squareSize = SQUARE_SIZE_XL;

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

  // The color shown at the top follows the flip, in every mode.
  const [topColor, bottomColor]: PieceColor[] = flipped ? ["white", "black"] : ["black", "white"];
  const [white, black] = players;
  let top: React.ReactNode;
  let bottom: React.ReactNode;
  if (!vsLiem) {
    top = renderPlayer(topColor === "white" ? white : black);
    bottom = renderPlayer(bottomColor === "white" ? white : black);
  } else {
    // In a game, your color; with the card open, the color picked so far (Random shows White).
    const yours: PieceColor = liemHuman ?? (match.colorPick === "black" ? "black" : "white");
    const cardFor = (c: PieceColor) => (c === yours ? renderYou(c) : renderLiem(c));
    top = cardFor(topColor);
    bottom = cardFor(bottomColor);
  }

  if (liemHuman !== null && review.open && model !== null) {
    const card = keyMomentView({ model, review, humanColor: liemHuman, summary: false });
    const select = (n: number) => dispatch(selectPosition(n, model));
    const cursor = Math.min(review.cursor, engineHistory.length - 1);
    const last = engineHistory.length - 1;
    const reviewCard = <ReviewCard model={model} humanColor={liemHuman} />;
    return (
      <MotionConfig reducedMotion="user">
        <div className="review" data-review-state={review.status}>
          <div className="review-top">
            <ReviewGraph
              model={model}
              humanColor={liemHuman}
              side={review.graphSide}
              cursor={cursor}
              onSelect={select}
              onSide={(side) => dispatch(setGraphSide(side))}
            />
          </div>

          <div className="board" style={{ width: squareSize * 8 }}>
            <ModeTabs />
            {top}
            <div className="squares">
              <ReviewBoard
                state={engineHistory[cursor]}
                flipped={flipped}
                size={squareSize}
                highlight={cursor > 0 ? model.moves[cursor - 1].uci : null}
                interactive={card.state === "trying"}
                onMove={onTry}
              />
            </div>
            {bottom}
            <div className="review-board-steps">
              <StepButtons cursor={cursor} last={last} disabled={steppingLocked(review)} onStep={select} />
            </div>
          </div>

          <div className="sidebar review-side">
            {wide && reviewCard}
            <AccuracyPanel model={model} />
            <MoveList model={model} cursor={cursor} onSelect={select} />
            <LeftBookNote model={model} />
            <BoardSidebar title="">
              <div className="buttons">
                <BackToGameButton />
                <NewGameButton />
                <Button type={ButtonType.Flip} />
                <Button type={ButtonType.Sound} />
              </div>
            </BoardSidebar>
          </div>

          {!wide && (
            <BottomSheet open={review.sheetOpen} low={card.low} onClose={() => dispatch(sheetClosed())}>
              {reviewCard}
            </BottomSheet>
          )}
        </div>
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="board" style={{ width: squareSize * 8 }}>
        <ModeTabs />
        {top}
        {/* One squares subtree in every state, so opening or closing the card never remounts a piece. */}
        <div className="squares">
          <div
            className={`squares__grid${setupOpen ? " liem-dimmed" : ""}`}
            aria-hidden={setupOpen || undefined}
          >
            <AnimatePresence>{squaresToRender}</AnimatePresence>
          </div>
          {setupOpen ? (
            <div className="squares__overlay">
              <SetupCard />
            </div>
          ) : (
            <>
              <Promotion squareSize={squareSize} />
              <GameOver />
            </>
          )}
        </div>
        {bottom}
      </div>

      <div className="sidebar">
        {liemHuman && (
          <div className="liem-side">
            <BookNote onRetry={retry} />
          </div>
        )}

        <BoardSidebar title="">
          <div className="buttons">
            {vsLiem ? (
              <>
                {liemHuman && reviewable && <ReviewGameButton />}
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
