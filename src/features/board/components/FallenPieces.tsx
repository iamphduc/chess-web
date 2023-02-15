import React, { ReactElement } from "react";

import "./FallenPieces.css";
import { useAppSelector } from "app/hooks";
import { FallenPiece } from "./FallenPiece";

export const FallenPieces = () => {
  const { fallenPieces } = useAppSelector((state) => state.board);

  const whiteFallenPieces: ReactElement[] = [];
  const blackFallenPieces: ReactElement[] = [];
  let whiteWeight = 0;
  let blackWeight = 0;

  fallenPieces.forEach(({ pieceType, weight, isWhite }) => {
    if (isWhite) {
      whiteFallenPieces.push(<FallenPiece key={pieceType} pieceType={pieceType} />);
      whiteWeight += Math.floor(weight);
    } else {
      blackFallenPieces.push(<FallenPiece key={pieceType} pieceType={pieceType} />);
      blackWeight += Math.floor(weight);
    }
  });

  const weightDiff = whiteWeight - blackWeight;

  return (
    <>
      <div className="fallen-pieces fallen-pieces--white">
        {whiteFallenPieces}
        <div className="weight">{weightDiff > 0 ? "+" + weightDiff : ""}</div>
      </div>
      <div className="fallen-pieces fallen-pieces--black">
        {blackFallenPieces}
        <div className="weight">{weightDiff < 0 ? "+" + Math.abs(weightDiff) : ""}</div>
      </div>
    </>
  );
};
