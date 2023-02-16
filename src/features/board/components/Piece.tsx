import React from "react";
import { DragPreviewImage, useDrag } from "react-dnd";
import { motion } from "framer-motion";

import "./Piece.css";
import { PieceType } from "game/piece-type";
import { pieceFactory } from "game/piece-factory";
import { King } from "game/pieces/king";

interface Props {
  pieceType: PieceType;
  isWhiteTurn: boolean;
  isPieceAttackedKing: boolean;
  isInCheck: boolean;
  handleClick: () => void;
}

export const Piece = ({
  pieceType,
  isWhiteTurn,
  isPieceAttackedKing,
  isInCheck,
  handleClick,
}: Props) => {
  const piece = pieceFactory.getPiece(pieceType);
  const image = piece.getImage();
  const isOursTurn = isWhiteTurn === piece.isWhitePiece();
  const isKingBeingAttacked = piece instanceof King && isOursTurn && isInCheck;

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
    if (isOursTurn) {
      handleClick();
    }
  };

  return (
    <>
      <DragPreviewImage connect={preview} src={image} />
      <motion.div
        ref={drag}
        className={`piece piece__${pieceType} ${
          isPieceAttackedKing || isKingBeingAttacked ? "piece--check" : ""
        }`}
        style={{
          backgroundImage: `url(${image})`,
          opacity: isDragging ? 0.5 : 1,
        }}
        onMouseDown={handleMouseDown}
        layoutId={pieceType}
        key={pieceType}
      />
    </>
  );
};
