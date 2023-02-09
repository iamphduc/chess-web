import React from "react";

import "./FallenPiece.css";
import { PieceType } from "game/piece-type";
import { pieceFactory } from "game/piece-factory";

interface Props {
  pieceType: PieceType;
}

export const FallenPiece = ({ pieceType }: Props) => {
  const piece = pieceFactory.getPiece(pieceType);
  const image = piece.getImage();

  return <img className="fallen-piece" src={image} alt={pieceType} />;
};
