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
import { useAppDispatch } from "app/hooks";
import { CELL_SIZE } from "game/constants";
import { Position } from "game/pieces/piece";
import { promotePawn } from "../BoardSlice";

interface Props {
  position: Position;
}

export enum PiecePromoted {
  Queen = "QUEEN",
  Rook = "ROOK",
  Bishop = "BISHOP",
  Knight = "KNIGHT",
}

export const Promotion = ({ position }: Props) => {
  const dispatch = useAppDispatch();
  const [y, x] = position;

  // If pawn reach the 0th row, then it is white side
  const isWhite = y === 0;

  const queenImage = isWhite ? WQueen : BQueen;
  const rookImage = isWhite ? WRook : BRook;
  const bishopImage = isWhite ? WBishop : BBishop;
  const knightImage = isWhite ? WKnight : BKnight;

  return (
    <div
      className={`promotion`}
      style={{
        left: x <= 3 ? CELL_SIZE * x - CELL_SIZE / 2 : "unset",
        right: x > 3 ? CELL_SIZE * (7 - x) - CELL_SIZE / 2 : "unset",
        top: y === 0 ? CELL_SIZE : "unset",
        bottom: y === 7 ? CELL_SIZE : "unset",
      }}
    >
      <div
        style={{ backgroundImage: `url(${queenImage})` }}
        className="promotion__piece"
        onClick={() => dispatch(promotePawn({ y, x, piecePromoted: PiecePromoted.Queen }))}
      />
      <div
        style={{ backgroundImage: `url(${rookImage})` }}
        className="promotion__piece"
        onClick={() => dispatch(promotePawn({ y, x, piecePromoted: PiecePromoted.Rook }))}
      />
      <div
        style={{ backgroundImage: `url(${bishopImage})` }}
        className="promotion__piece"
        onClick={() => dispatch(promotePawn({ y, x, piecePromoted: PiecePromoted.Bishop }))}
      />
      <div
        style={{ backgroundImage: `url(${knightImage})` }}
        className="promotion__piece"
        onClick={() => dispatch(promotePawn({ y, x, piecePromoted: PiecePromoted.Knight }))}
      />
    </div>
  );
};
