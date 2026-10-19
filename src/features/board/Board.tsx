import React, { useMemo } from "react";
import { AnimatePresence, MotionConfig } from "framer-motion";

import "./Board.css";
import { PlayerInfo, players } from "game/players";
import { useAppDispatch, useAppSelector } from "app/hooks";
import type { PieceColor } from "game/engine/game-state";
import type { StrengthStep } from "game/opponent/strength";
import { BookNote } from "features/liem/components/BookNote";
import { LiemCardDetail } from "features/liem/components/LiemCardDetail";
import { replayLiemGame } from "features/liem/liemActions";
import { levelView } from "features/liem/levelView";
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
import { backToGame, canOpenReview, selectPosition, steppingLocked } from "features/review/reviewActions";
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
import { Notation } from "./components/Notation";
import { GameOver } from "./components/GameOver";
import { Button, ButtonType } from "./components/Button";
import { TopBar } from "./components/TopBar";
import { hashFor } from "app/route";
import { useMediaQuery } from "hooks/useMediaQuery";
import { displayOrder } from "./orientation";
import { squareSizeFor, WIDE_1200, WIDE_768 } from "./boardSize";
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

/** His card at the picked level: a sparring bot's ♞ card, or his own with photo and GM. */
const renderLiem = (color: PieceColor, strength: StrengthStep) => {
  const view = levelView(strength);
  return (
    <Player
      key={color}
      name={view.name}
      title={view.title}
      avatar={view.avatar}
      glyph={view.glyph ?? undefined}
      isWhite={color === "white"}
      detail={<LiemCardDetail />}
    />
  );
};

const renderYou = (color: PieceColor) => (
  <Player key={color} name="You" title={null} avatar={null} isWhite={color === "white"} />
);

/** A link: the route opens the review (`arriveAt("review")`). */
const ReviewGameLink = () => (
  <a className="button button--play" href={hashFor("review")}>
    Review game
  </a>
);

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

/** A new game at the same level and color (Random draws again). */
const NewGameButton = () => {
  const dispatch = useAppDispatch();
  return (
    <button type="button" className="button" onClick={() => dispatch(replayLiemGame())}>
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
  // Before a game (home) the board isn't shown; App renders Home instead.
  const liemHuman: PieceColor | null = vsLiem && !match.setupOpen ? humanColor : null;

  const wide = useMediaQuery(WIDE_768);
  const squareSize = squareSizeFor(wide, useMediaQuery(WIDE_1200));

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
    // In a game, your color; before one, the color picked so far (Random shows White).
    const yours: PieceColor = liemHuman ?? (match.colorPick === "black" ? "black" : "white");
    const cardFor = (c: PieceColor) => (c === yours ? renderYou(c) : renderLiem(c, match.strength));
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

  const icons = (
    <span className="moves-card__icons">
      <Button type={ButtonType.Flip} />
      <Button type={ButtonType.Sound} />
    </span>
  );
  let foot: React.ReactNode;
  if (!vsLiem) {
    foot = (
      <>
        <Button type={ButtonType.Play} />
        <Button type={ButtonType.Reset} />
        {icons}
      </>
    );
  } else if (liemHuman) {
    foot = (
      <>
        {reviewable && <ReviewGameLink />}
        <NewGameButton />
        {icons}
      </>
    );
  } else {
    foot = icons;
  }

  return (
    <MotionConfig reducedMotion="user">
      <TopBar />
      <div className="board-screen">
        <div className="board" style={{ width: squareSize * 8 }}>
          {top}
          {/* One squares subtree in every game, so a new game or a flip never remounts a square. */}
          <div className="squares">
            <div className="squares__grid">
              <AnimatePresence>{squaresToRender}</AnimatePresence>
            </div>
            <Promotion squareSize={squareSize} />
            <GameOver />
          </div>
          {bottom}
        </div>

        <div className="sidebar">
          {liemHuman && <BookNote onRetry={retry} />}
          <BoardSidebar title="Moves" className="moves-card" flush foot={foot}>
            <Notation />
          </BoardSidebar>
        </div>
      </div>
    </MotionConfig>
  );
};
