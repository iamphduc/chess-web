import React, { type CSSProperties, useState } from "react";
import { motion } from "framer-motion";

import "features/board/components/Square.css";
import "features/board/components/Piece.css";
import "./ReviewBoard.css";
import WQueen from "assets/queen-white.svg";
import BQueen from "assets/queen-black.svg";
import WRook from "assets/rook-white.svg";
import BRook from "assets/rook-black.svg";
import WBishop from "assets/bishop-white.svg";
import BBishop from "assets/bishop-black.svg";
import WKnight from "assets/knight-white.svg";
import BKnight from "assets/knight-black.svg";
import { Overlay, OverlayType } from "features/board/components/Overlay";
import { checkedKingPieceType } from "features/board/engineAdapter";
import { displayOrder, promotionPlacement, squareLabels } from "features/board/orientation";
import { nextReviewStep, transitionFor, type ReviewStepShown } from "features/board/pieceMotion";
import { squareMarks } from "features/board/squareMarks";
import type { GameState } from "game/engine/game-state";
import { pieceFactory } from "game/piece-factory";
import { choosePromotion, clickSquare, NO_SELECTION, targetsOf, type PromotionPiece, type TryStep, type TrySelection } from "../tryBoard";

interface Props {
  state: GameState;
  /** The game under review: its pieces get their own layout ids. */
  gameId: number;
  /** Which position `state` is, so a one-ply step can slide. */
  ply: number;
  flipped: boolean;
  /** Square size in px. */
  size: number;
  /** A UCI move whose two squares get the last-move tint, or `null`. */
  highlight: string | null;
  /** Clicks and taps try a move only when this is set. */
  interactive: boolean;
  onMove: (uci: string) => void;
}

const FILES = "abcdefgh";
const nameOf = (y: number, x: number) => `${FILES[x]}${8 - y}`;
const coordOf = (name: string): [number, number] => [8 - Number(name[1]), FILES.indexOf(name[0])];

const PROMOTION_CHOICES: { piece: PromotionPiece; label: string; white: string; black: string }[] = [
  { piece: "q", label: "Queen", white: WQueen, black: BQueen },
  { piece: "r", label: "Rook", white: WRook, black: BRook },
  { piece: "b", label: "Bishop", white: WBishop, black: BBishop },
  { piece: "n", label: "Knight", white: WKnight, black: BKnight },
];

/**
 * A board for one position of the review, drawn like the game board. When
 * `interactive`, click a piece of the side to move and then a target to try a
 * move; a promotion asks for the piece. No drag. A one-ply step slides its move;
 * any other change of position snaps (`reviewStepMotion`).
 */
export const ReviewBoard = ({ state, gameId, ply, flipped, size, highlight, interactive, onMove }: Props) => {
  // Derived during render (like `held` below), so the step and its motion land together.
  const [shown, setShown] = useState<ReviewStepShown | null>(null);
  const next = nextReviewStep(shown, { gameId, ply, flipped, size });
  if (next !== shown) setShown(next);
  const transition = transitionFor(next.motion);

  // The selection belongs to one position; a new position starts with none.
  const [held, setHeld] = useState<{ position: GameState; selection: TrySelection }>({
    position: state,
    selection: NO_SELECTION,
  });
  const selection = interactive && held.position === state ? held.selection : NO_SELECTION;

  const apply = (step: TryStep) => {
    setHeld({ position: state, selection: step.selection });
    if (step.move !== null) onMove(step.move);
  };

  const targets = new Set(targetsOf(state, selection));
  const lit = highlight === null ? [] : [highlight.slice(0, 2), highlight.slice(2, 4)];
  const checkedKing = checkedKingPieceType(state);

  const squares = displayOrder(flipped).map(([y, x]) => {
    const name = nameOf(y, x);
    const pieceType = state.squares[y][x];
    const marks = squareMarks({
      isLastMove: lit.includes(name),
      isSelected: selection.selected === name,
      isPossibleMove: targets.has(name),
      hasPiece: pieceType !== null,
      isCheckedKing: pieceType !== null && pieceType === checkedKing,
      isOver: false,
      canDrop: false,
    });
    const labels = squareLabels(y, x, flipped);
    const input = interactive
      ? {
          role: "button",
          tabIndex: 0,
          "aria-label": name,
          onClick: () => apply(clickSquare(state, selection, name)),
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            apply(clickSquare(state, selection, name));
          },
        }
      : {};
    return (
      <div
        key={y * 8 + x}
        className={`square square--${(y + x) % 2 === 1 ? "dark" : "light"}`}
        data-square={name}
        style={{ width: size, height: size, "--square-size": `${size}px` } as CSSProperties}
        {...input}
      >
        {marks.highlight && <Overlay type={OverlayType.Highlight} />}
        {marks.check && <Overlay type={OverlayType.Check} />}
        {pieceType && (
          <motion.div
            // Its own element per piece: reusing the taker's element for the piece it
            // took (◀ from a capture) makes Framer fade the returning piece out.
            key={pieceType}
            className={`piece piece__${pieceType}`}
            style={{ backgroundImage: `url(${pieceFactory.getPiece(pieceType).getImage()})` }}
            // Never the game board's `${gameId}-${pieceType}`, so the two boards share no box.
            layoutId={`review-${gameId}-${pieceType}`}
            data-layout-id={`review-${gameId}-${pieceType}`}
            transition={transition}
          />
        )}
        {marks.hint === "dot" && <Overlay type={OverlayType.Dot} />}
        {marks.hint === "ring" && <Overlay type={OverlayType.Ring} />}
        {labels.rank && <span className="square__label square__label--rank">{labels.rank}</span>}
        {labels.file && <span className="square__label square__label--file">{labels.file}</span>}
      </div>
    );
  });

  const pending = selection.promotion;
  let picker: React.ReactNode = null;
  if (pending !== null) {
    const [y, x] = coordOf(pending.to);
    const place = promotionPlacement(y, x, flipped, size);
    const white = state.turn === "white";
    picker = (
      <div className="review-board__promotion" role="group" aria-label="Promote to" style={place}>
        {PROMOTION_CHOICES.map((c) => (
          <button
            key={c.piece}
            type="button"
            className="review-board__promote"
            aria-label={c.label}
            style={{ width: size * 0.8, height: size * 0.8, backgroundImage: `url(${white ? c.white : c.black})` }}
            onClick={() => apply(choosePromotion(state, selection, c.piece))}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`review-board${interactive ? " review-board--interactive" : ""}`}
      data-interactive={interactive ? "true" : "false"}
      style={{ width: size * 8 }}
    >
      <div className="review-board__grid">{squares}</div>
      {picker}
    </div>
  );
};
