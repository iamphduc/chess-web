import React from "react";

import "./Promotion.css";
import { SQUARE_SIZE } from "../../../constants";
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

export enum PiecePromoted {
  Queen = "QUEEN",
  Rook = "ROOK",
  Bishop = "BISHOP",
  Knight = "KNIGHT",
}

export const Promotion = () => {
  const {
    promotionPosition: [y, x],
  } = useAppSelector((state) => state.board);
  const dispatch = useAppDispatch();

  // If pawn reach the 0th row, then it is white side
  const isWhite = y === 0;

  const queenImage = isWhite ? WQueen : BQueen;
  const rookImage = isWhite ? WRook : BRook;
  const bishopImage = isWhite ? WBishop : BBishop;
  const knightImage = isWhite ? WKnight : BKnight;

  return y !== -1 && x !== -1 ? (
    <div
      className={`promotion`}
      style={{
        left: x <= 3 ? SQUARE_SIZE * x - SQUARE_SIZE / 2 : "unset",
        right: x > 3 ? SQUARE_SIZE * (7 - x) - SQUARE_SIZE / 2 : "unset",
        top: y === 0 ? SQUARE_SIZE : "unset",
        bottom: y === 7 ? SQUARE_SIZE : "unset",
      }}
    >
      <div
        style={{ backgroundImage: `url(${queenImage})` }}
        className="promotion__piece"
        onClick={() => dispatch(promotePawn({ piecePromoted: PiecePromoted.Queen }))}
      />
      <div
        style={{ backgroundImage: `url(${rookImage})` }}
        className="promotion__piece"
        onClick={() => dispatch(promotePawn({ piecePromoted: PiecePromoted.Rook }))}
      />
      <div
        style={{ backgroundImage: `url(${bishopImage})` }}
        className="promotion__piece"
        onClick={() => dispatch(promotePawn({ piecePromoted: PiecePromoted.Bishop }))}
      />
      <div
        style={{ backgroundImage: `url(${knightImage})` }}
        className="promotion__piece"
        onClick={() => dispatch(promotePawn({ piecePromoted: PiecePromoted.Knight }))}
      />
    </div>
  ) : (
    <></>
  );
};
