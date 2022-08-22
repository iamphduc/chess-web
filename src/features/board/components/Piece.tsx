import React from "react";
import { DragPreviewImage, useDrag } from "react-dnd";

import "./Piece.css";
import WKnight from "assets/knight-white.svg";
import BKnight from "assets/knight-black.svg";
import WRook from "assets/rook-white.svg";
import BRook from "assets/rook-black.svg";
import WBishop from "assets/bishop-white.svg";
import BBishop from "assets/bishop-black.svg";
import WQueen from "assets/queen-white.svg";
import BQueen from "assets/queen-black.svg";
import WKing from "assets/king-white.svg";
import BKing from "assets/king-black.svg";
import WPawn from "assets/pawn-white.svg";
import BPawn from "assets/pawn-black.svg";
import { PieceDragType, PieceType } from "game/piece-type";
import { convertDragType } from "game/convert-drag-type";
import { useAppDispatch } from "app/hooks";
import { selectPiece } from "../BoardSlice";

interface Props {
  dragType: PieceDragType;
  x: number;
  y: number;
}

const getImage = (isBlack: boolean | undefined, type: PieceType) => {
  const imageType = {
    [PieceType.Knight]: isBlack ? BKnight : WKnight,
    [PieceType.Rook]: isBlack ? BRook : WRook,
    [PieceType.Bishop]: isBlack ? BBishop : WBishop,
    [PieceType.Queen]: isBlack ? BQueen : WQueen,
    [PieceType.King]: isBlack ? BKing : WKing,
    [PieceType.Pawn]: isBlack ? BPawn : WPawn,
  };
  return imageType[type];
};

export const Piece = ({ dragType, x, y }: Props) => {
  const { isBlack, type } = convertDragType(dragType);
  const image = getImage(isBlack, type);

  const dispatch = useAppDispatch();

  const [{ isDragging }, drag, preview] = useDrag(
    () => ({
      type: dragType,
      collect: (monitor) => ({
        isDragging: !!monitor.isDragging(),
      }),
    }),
    [dragType]
  );

  const handleMouseDown = () => {
    dispatch(selectPiece({ dragType, x, y }));
  };

  return (
    <>
      <DragPreviewImage connect={preview} src={image} />
      <div
        ref={drag}
        className={`piece piece__${dragType.toLowerCase()}`}
        style={{
          backgroundImage: `url(${image})`,
          opacity: isDragging ? 0.5 : 1,
        }}
        onMouseDown={handleMouseDown}
      />
    </>
  );
};
