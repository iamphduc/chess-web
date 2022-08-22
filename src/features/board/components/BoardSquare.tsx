import React from "react";
import { useDrop } from "react-dnd";

import "./BoardSquare.css";
import PieceMove, { Position } from "game/piece-move";
import { PieceDragType, PieceType } from "game/piece-type";
import { convertDragType } from "game/convert-drag-type";
import { useAppSelector, useAppDispatch } from "app/hooks";
import { movePiece } from "../BoardSlice";
import { Square } from "./Square";
import { Overlay, OverlayType } from "./Overlay";
import { Piece } from "./Piece";

interface Props {
  x: number;
  y: number;
  piece: PieceDragType | null;
}

const canMove = (dragType: PieceDragType, from: Position, to: Position) => {
  const { type } = convertDragType(dragType);

  switch (type) {
    case PieceType.Rook:
      return PieceMove.canRookMove(from, to);
    case PieceType.Knight:
      return PieceMove.canKnightMove(from, to);
    case PieceType.Bishop:
      return PieceMove.canBishopMove(from, to);
    case PieceType.Queen:
      return PieceMove.canQueenMove(from, to);
    case PieceType.King:
      return PieceMove.canKingMove(from, to);
    case PieceType.Pawn:
      return PieceMove.canWhitePawnMove(from, to);
    default:
      return false;
  }
};

export const BoardSquare = ({ x, y, piece }: Props) => {
  const { selectedPiece } = useAppSelector((state) => state.board);
  const dispatch = useAppDispatch();

  const move = (
    selectedPiece: { dragType: PieceDragType; x: number; y: number },
    toX: number,
    toY: number
  ) => {
    if (selectedPiece.dragType) {
      dispatch(movePiece({ selectedPiece, toX, toY }));
    }
  };

  const [{ isOver, canDrop }, drop] = useDrop(
    () => ({
      accept: selectedPiece?.dragType || "NONE",
      canDrop: () => canMove(selectedPiece.dragType, [selectedPiece.x, selectedPiece.y], [x, y]),
      drop: () => move(selectedPiece, x, y),
      collect: (monitor) => ({
        isOver: !!monitor.isOver(),
        canDrop: !!monitor.canDrop(),
      }),
    }),
    [x, y, selectedPiece]
  );

  const isDark = (x + y) % 2 === 1;

  return (
    <div ref={drop} className="board__square">
      <Square isDark={isDark}>{piece && <Piece dragType={piece} x={x} y={y} />}</Square>
      {isOver && !canDrop && <Overlay type={OverlayType.Illegal} />}
      {!isOver && canDrop && <Overlay type={OverlayType.Possible} />}
      {isOver && canDrop && <Overlay type={OverlayType.Legal} />}
    </div>
  );
};
