import React from "react";
import { DragPreviewImage, useDrag } from "react-dnd";
import { motion } from "framer-motion";

import "./Piece.css";
import { PieceType } from "game/piece-type";
import { pieceFactory } from "game/piece-factory";
import { useAppDispatch, useAppSelector } from "app/hooks";
import { pickUp } from "../BoardSlice";
import { GameOverType } from "./GameOver";

interface Props {
  pieceType: PieceType;
  /** Board coordinates of the square the piece stands on. */
  y: number;
  x: number;
  isWhiteTurn: boolean;
}

export const Piece = ({ pieceType, y, x, isWhiteTurn }: Props) => {
  const dispatch = useAppDispatch();
  const inputOpen = useAppSelector(
    (state) => state.board.gameOver === GameOverType.Continue && !state.board.pendingPromotion
  );

  const piece = pieceFactory.getPiece(pieceType);
  const image = piece.getImage();
  const canMove = inputOpen && isWhiteTurn === piece.isWhitePiece();

  const [{ isDragging }, drag, preview] = useDrag(
    () => ({
      type: pieceType,
      canDrag: () => canMove,
      // Drag start selects the piece (never toggles), so the legal-move dots show while dragging.
      item: () => {
        dispatch(pickUp({ y, x }));
        return { pieceType };
      },
      collect: (monitor) => ({
        isDragging: !!monitor.isDragging(),
      }),
    }),
    [pieceType, y, x, canMove]
  );

  return (
    <>
      <DragPreviewImage connect={preview} src={image} />
      <motion.div
        ref={drag}
        className={`piece piece__${pieceType}${canMove ? " piece--movable" : ""}`}
        style={{
          backgroundImage: `url(${image})`,
          opacity: isDragging ? 0.5 : 1,
        }}
        layoutId={pieceType}
        key={pieceType}
      />
    </>
  );
};
