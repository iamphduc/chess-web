import React from "react";

import "./Promotion.css";
import WQueen from "assets/queen-white.svg";
import BQueen from "assets/queen-black.svg";
import WRook from "assets/rook-white.svg";
import BRook from "assets/rook-black.svg";
import WBishop from "assets/bishop-white.svg";
import BBishop from "assets/bishop-black.svg";
import WKnight from "assets/knight-white.svg";
import BKnight from "assets/knight-black.svg";
import { useAppDispatch, useAppSelector } from "app/hooks";
import { promotePawn } from "../BoardSlice";
import { PiecePromoted } from "../piecePromoted";
import { promotionPlacement } from "../orientation";

/** The picker's buttons, in order, with their screen-reader names. */
const CHOICES: [PiecePromoted, string][] = [
  [PiecePromoted.Queen, "Queen"],
  [PiecePromoted.Rook, "Rook"],
  [PiecePromoted.Bishop, "Bishop"],
  [PiecePromoted.Knight, "Knight"],
];

interface Props {
  squareSize: number;
}

export const Promotion = ({ squareSize }: Props) => {
  const {
    promotionPosition: [y, x],
  } = useAppSelector((state) => state.board);
  const flipped = useAppSelector((state) => state.view.flipped);
  const dispatch = useAppDispatch();

  // If pawn reach the 0th row, then it is white side
  const isWhite = y === 0;

  const images: Record<PiecePromoted, string> = {
    [PiecePromoted.Queen]: isWhite ? WQueen : BQueen,
    [PiecePromoted.Rook]: isWhite ? WRook : BRook,
    [PiecePromoted.Bishop]: isWhite ? WBishop : BBishop,
    [PiecePromoted.Knight]: isWhite ? WKnight : BKnight,
  };
  const promotionPieceSize = { width: squareSize * 0.6, height: squareSize * 0.6 };

  return y !== -1 && x !== -1 ? (
    <div
      className="promotion"
      style={promotionPlacement(y, x, flipped, squareSize)}
      role="group"
      aria-label="Promote to"
    >
      {CHOICES.map(([piece, label]) => (
        <button
          key={piece}
          type="button"
          aria-label={label}
          style={{ backgroundImage: `url(${images[piece]})`, ...promotionPieceSize }}
          className="promotion__piece"
          onClick={() => dispatch(promotePawn({ piecePromoted: piece }))}
        />
      ))}
    </div>
  ) : (
    <></>
  );
};
