import React from "react";
import { DragPreviewImage, useDrag } from "react-dnd";
import { motion } from "framer-motion";

import "./Piece.css";
import { PieceType } from "game/piece-type";
import { useAppDispatch } from "app/hooks";
import { selectPiece } from "../BoardSlice";
import { pieceFactory } from "game/piece-factory";

interface Props {
  pieceType: PieceType;
  y: number;
  x: number;
}

export const Piece = ({ pieceType, y, x }: Props) => {
  const piece = pieceFactory.getPiece(pieceType);
  const image = piece.getImage();

  const dispatch = useAppDispatch();
  const [{ isDragging }, drag, preview] = useDrag(
    () => ({
      type: pieceType,
      collect: (monitor) => ({
        isDragging: !!monitor.isDragging(),
      }),
    }),
    [pieceType]
  );

  const handleMouseDown = () => {
    dispatch(selectPiece({ type: pieceType, y, x }));
  };

  return (
    <>
      <DragPreviewImage connect={preview} src={image} />
      <motion.div
        ref={drag}
        className={`piece piece__${pieceType.toLowerCase()}`}
        style={{
          backgroundImage: `url(${image})`,
          opacity: isDragging ? 0.5 : 1,
        }}
        onMouseDown={handleMouseDown}
        layoutId={pieceType}
      />
    </>
  );
};
