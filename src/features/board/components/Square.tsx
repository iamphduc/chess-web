import React from "react";
import { useDrop } from "react-dnd";

import "./Square.css";
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

export const Square = ({ y, x, pieceType, isPossibleMove, size = 52 }: Props) => {
  const { selectedPiece } = useAppSelector((state) => state.board);
  const dispatch = useAppDispatch();

  const isDark = (y + x) % 2 === 1;

  const [{ isOver, canDrop }, drop] = useDrop(
    () => ({
      accept: selectedPiece ? selectedPiece.type : "NONE",
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
    pieceType && dispatch(selectPiece({ type: pieceType, y, x }));
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
      {isPossibleMove && <Overlay type={OverlayType.Possible} handleClick={handlePossibleClick} />}
    </div>
  );
};
