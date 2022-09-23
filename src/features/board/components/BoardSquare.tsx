import React from "react";
import { useDrop } from "react-dnd";

import "./BoardSquare.css";
import { PieceDragType } from "game/piece-type";
import { useAppSelector, useAppDispatch } from "app/hooks";
import { movePiece } from "../BoardSlice";
import { Square } from "./Square";
import { Overlay, OverlayType } from "./Overlay";
import { Piece } from "./Piece";

interface Props {
  y: number;
  x: number;
  dragType: PieceDragType | null;
  isPossibleMove: boolean;
}

export const BoardSquare = ({ y, x, dragType, isPossibleMove }: Props) => {
  const { selectedPiece } = useAppSelector((state) => state.board);
  const dispatch = useAppDispatch();

  const isDark = (y + x) % 2 === 1;

  const movePieceTo = (toY: number, toX: number) => {
    dispatch(movePiece({ toY, toX }));
  };

  const [{ isOver, canDrop }, drop] = useDrop(
    () => ({
      accept: selectedPiece ? selectedPiece.dragType : "NONE",
      canDrop: () => isPossibleMove,
      drop: () => movePieceTo(y, x),
      collect: (monitor) => ({
        isOver: !!monitor.isOver(),
        canDrop: !!monitor.canDrop(),
      }),
    }),
    [y, x, selectedPiece]
  );

  return (
    <div ref={drop} className="board__square">
      <Square isDark={isDark}>
        {dragType && <Piece y={y} x={x} dragType={dragType} />}
        {isOver && !canDrop && <Overlay type={OverlayType.Illegal} />}
        {isOver && canDrop && <Overlay type={OverlayType.Legal} />}
        {isPossibleMove && (
          <Overlay type={OverlayType.Possible} handleClick={() => movePieceTo(y, x)} />
        )}
      </Square>
    </div>
  );
};
