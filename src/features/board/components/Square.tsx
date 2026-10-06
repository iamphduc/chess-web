import React, { CSSProperties, memo } from "react";
import { useDrop } from "react-dnd";

import "./Square.css";
import { PieceType } from "game/piece-type";
import { useAppDispatch, useAppSelector } from "app/hooks";
import { clickSquare, movePiece } from "../BoardSlice";
import { squareLabels } from "../orientation";
import { squareMarks } from "../squareMarks";
import { Overlay, OverlayType } from "./Overlay";
import { Piece } from "./Piece";

interface Props {
  size?: number;
  /** Board coordinates (White's view), whether or not the board is flipped. */
  y: number;
  x: number;
  pieceType: PieceType | null;
  isPossibleMove: boolean;
  isLastMove: boolean;
  isWhiteTurn: boolean;
  /** This square holds the king that is in check. */
  isPieceAttackedKing: boolean;
  isInCheck: boolean;
}

export const Square = memo(
  ({ y, x, pieceType, isPossibleMove, isLastMove, isWhiteTurn, isPieceAttackedKing, size }: Props) => {
    const dispatch = useAppDispatch();
    const flipped = useAppSelector((state) => state.view.flipped);
    const isSelected = useAppSelector(
      (state) => state.board.selectedPiece?.y === y && state.board.selectedPiece?.x === x
    );

    const [{ isOver, canDrop }, drop] = useDrop(
      () => ({
        accept: Object.values(PieceType),
        canDrop: () => isPossibleMove,
        drop: () => {
          dispatch(movePiece({ to: [y, x] }));
        },
        collect: (monitor) => ({
          isOver: !!monitor.isOver(),
          canDrop: !!monitor.canDrop(),
        }),
      }),
      [y, x, isPossibleMove]
    );

    const marks = squareMarks({
      isLastMove,
      isSelected,
      isPossibleMove,
      hasPiece: pieceType !== null,
      isCheckedKing: isPieceAttackedKing,
      isOver,
      canDrop,
    });
    const labels = squareLabels(y, x, flipped);
    const isDarkSquare = (y + x) % 2 === 1;
    const name = `${String.fromCharCode(97 + x)}${8 - y}`;
    const style = { width: size, height: size, "--square-size": `${size}px` } as CSSProperties;

    return (
      <div
        ref={drop}
        className={`square square--${isDarkSquare ? "dark" : "light"}`}
        data-square={name}
        style={style}
        onClick={() => dispatch(clickSquare({ y, x }))}
      >
        {marks.highlight && <Overlay type={OverlayType.Highlight} />}
        {marks.check && <Overlay type={OverlayType.Check} />}
        {pieceType && <Piece pieceType={pieceType} y={y} x={x} isWhiteTurn={isWhiteTurn} />}
        {marks.hint === "dot" && <Overlay type={OverlayType.Dot} />}
        {marks.hint === "ring" && <Overlay type={OverlayType.Ring} />}
        {marks.dropEdge && <Overlay type={OverlayType.DropEdge} />}

        {labels.rank && <span className="square__label square__label--rank">{labels.rank}</span>}
        {labels.file && <span className="square__label square__label--file">{labels.file}</span>}
      </div>
    );
  }
);
