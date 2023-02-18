import React, { memo } from "react";
import { useDrop } from "react-dnd";

import "./Square.css";
import { PieceType } from "game/piece-type";
import { useAppDispatch } from "app/hooks";
import { movePiece, selectPiece } from "../BoardSlice";
import { Overlay, OverlayType } from "./Overlay";
import { Piece } from "./Piece";

interface Props {
  size?: number;
  y: number;
  x: number;
  pieceType: PieceType | null;
  isPossibleMove: boolean;
  isLastMove: boolean;
  isWhiteTurn: boolean;
  isPieceAttackedKing: boolean;
  isInCheck: boolean;
}

export const Square = memo(
  ({
    y,
    x,
    pieceType,
    isPossibleMove,
    isLastMove,
    isWhiteTurn,
    isPieceAttackedKing,
    isInCheck,
    size,
  }: Props) => {
    const dispatch = useAppDispatch();

    const isDarkSquare = (y + x) % 2 === 1;

    const [{ isOver, canDrop }, drop] = useDrop(
      () => ({
        accept: Object.values(PieceType),
        canDrop: () => isPossibleMove,
        drop: () => dispatch(movePiece({ to: [y, x] })),
        collect: (monitor) => ({
          isOver: !!monitor.isOver(),
          canDrop: !!monitor.canDrop(),
        }),
      }),
      [y, x, isPossibleMove]
    );

    const handlePossibleClick = () => {
      if (isPossibleMove) {
        dispatch(movePiece({ to: [y, x] }));
      }
    };

    const handlePieceClick = () => {
      if (pieceType) {
        dispatch(selectPiece({ pieceType, y, x }));
      }
    };

    return (
      <div
        ref={drop}
        className={`square square--${isDarkSquare ? "dark" : "light"}`}
        style={{ width: size, height: size }}
      >
        {pieceType && (
          <Piece
            pieceType={pieceType}
            isWhiteTurn={isWhiteTurn}
            isPieceAttackedKing={isPieceAttackedKing}
            isInCheck={isInCheck}
            handleClick={handlePieceClick}
          />
        )}

        {isOver && !canDrop && <Overlay type={OverlayType.Illegal} />}
        {isOver && canDrop && <Overlay type={OverlayType.Legal} />}
        {isLastMove && <Overlay type={OverlayType.LastMove} />}
        {isPossibleMove && !pieceType && (
          <Overlay type={OverlayType.Possible} handleClick={handlePossibleClick} />
        )}
        {isPossibleMove && pieceType && (
          <Overlay type={OverlayType.Enemy} handleClick={handlePossibleClick} />
        )}

        {y === 7 && (
          <span
            className={`square__letter square__letter--alpha ${
              isDarkSquare ? "square__letter--dark" : ""
            }`}
          >
            {String.fromCharCode(x + 97)}
          </span>
        )}
        {x === 0 && (
          <span className={`square__letter ${isDarkSquare ? "square__letter--dark" : ""}`}>
            {8 - y + ""}
          </span>
        )}
      </div>
    );
  }
);
