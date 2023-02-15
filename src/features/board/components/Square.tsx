import React from "react";
import { useDrop } from "react-dnd";

import "./Square.css";
import { SQUARE_SIZE } from "../../../constants";
import { PieceType } from "game/piece-type";
import { useAppSelector, useAppDispatch } from "app/hooks";
import { movePiece, selectPiece } from "../BoardSlice";
import { Overlay, OverlayType } from "./Overlay";
import { Piece } from "./Piece";

interface Props {
  size?: number;
  y: number;
  x: number;
  pieceType: PieceType | null;
  isPossibleMove: boolean;
}

export const Square = ({ y, x, pieceType, isPossibleMove, size = SQUARE_SIZE }: Props) => {
  const { selectedPiece, lastMove } = useAppSelector((state) => state.board);
  const dispatch = useAppDispatch();

  const [previousSquare, currentSquare] = lastMove;
  const isDark = (y + x) % 2 === 1;

  const [{ isOver, canDrop }, drop] = useDrop(
    () => ({
      accept: selectedPiece ? selectedPiece.pieceType : "NONE",
      canDrop: () => isPossibleMove,
      drop: () => dispatch(movePiece({ to: [y, x] })),
      collect: (monitor) => ({
        isOver: !!monitor.isOver(),
        canDrop: !!monitor.canDrop(),
      }),
    }),
    [y, x, selectedPiece]
  );

  const handlePossibleClick = () => {
    isPossibleMove && dispatch(movePiece({ to: [y, x] }));
  };

  const handlePieceClick = () => {
    pieceType && dispatch(selectPiece({ pieceType, y, x }));
  };

  return (
    <div
      ref={drop}
      className={`square square--${isDark ? "dark" : "light"}`}
      style={{ width: size, height: size }}
    >
      {pieceType && <Piece pieceType={pieceType} handleClick={handlePieceClick} />}

      {isOver && !canDrop && <Overlay type={OverlayType.Illegal} />}
      {isOver && canDrop && <Overlay type={OverlayType.Legal} />}
      {isPossibleMove && !pieceType && (
        <Overlay type={OverlayType.Possible} handleClick={handlePossibleClick} />
      )}
      {isPossibleMove && pieceType && (
        <Overlay type={OverlayType.Enemy} handleClick={handlePossibleClick} />
      )}
      {previousSquare[0] === y && previousSquare[1] === x && (
        <Overlay type={OverlayType.Previous} />
      )}
      {currentSquare[0] === y && currentSquare[1] === x && <Overlay type={OverlayType.Current} />}

      {y === 7 && (
        <span
          className={`square__letter square__letter--alpha square__letter--${
            isDark ? "dark" : "light"
          }`}
        >
          {String.fromCharCode(x + 97)}
        </span>
      )}
      {x === 0 && (
        <span className={`square__letter square__letter--${isDark ? "dark" : "light"}`}>
          {8 - y + ""}
        </span>
      )}
    </div>
  );
};
