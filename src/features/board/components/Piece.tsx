import React from "react";
import { DragPreviewImage, useDrag } from "react-dnd";
import { motion } from "framer-motion";

import "./Piece.css";
import { PieceType } from "game/piece-type";
import { pieceFactory } from "game/piece-factory";
import { useAppSelector } from "app/hooks";
import { King } from "game/pieces/king";

interface Props {
  pieceType: PieceType;
  handleClick: () => void;
}

export const Piece = ({ pieceType, handleClick }: Props) => {
  const { isWhiteTurn, pieceAttackedKing } = useAppSelector((state) => state.board);

  const piece = pieceFactory.getPiece(pieceType);
  const image = piece.getImage();
  const isWhite = piece.isWhitePiece();

  const isPieceAttackingKing = pieceAttackedKing === pieceType;
  const isKingBeingAttacked = pieceAttackedKing && piece instanceof King && isWhite === isWhiteTurn;

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
    isWhite === isWhiteTurn && handleClick();
  };

  return (
    <>
      <DragPreviewImage connect={preview} src={image} />
      <motion.div
        ref={drag}
        className={`piece piece__${pieceType} ${
          isPieceAttackingKing || isKingBeingAttacked ? "piece--check" : ""
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
