import React from "react";
import { DragPreviewImage, useDrag } from "react-dnd";
import { motion } from "framer-motion";

import "./Piece.css";
import { PieceType } from "game/piece-type";
import { pieceFactory } from "game/piece-factory";

interface Props {
  pieceType: PieceType;
  handleClick: () => void;
}

export const Piece = ({ pieceType, handleClick }: Props) => {
  const piece = pieceFactory.getPiece(pieceType);
  const image = piece.getImage();

  const [{ isDragging }, drag, preview] = useDrag(
    () => ({
      type: pieceType,
      collect: (monitor) => ({
        isDragging: !!monitor.isDragging(),
      }),
    }),
    [pieceType]
  );

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
        onMouseDown={handleClick}
        layoutId={pieceType}
        key={pieceType}
      />
    </>
  );
};
