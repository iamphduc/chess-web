import React from "react";

import "./FallenPieces.css";
import { useAppSelector } from "app/hooks";
import { FallenPiece } from "./FallenPiece";

export const FallenPieces = () => {
  const { whiteFallenPieces, blackFallenPieces } = useAppSelector((state) => state.board);
  const whiteWeight = whiteFallenPieces.reduce((acc, curr) => acc + Math.floor(curr.weight), 0);
  const blackWeight = blackFallenPieces.reduce((acc, curr) => acc + Math.floor(curr.weight), 0);
  const diff = whiteWeight - blackWeight;

  return (
    <>
      <div className="fallen-pieces fallen-pieces--white">
        {whiteFallenPieces.map(({ pieceType }) => (
          <FallenPiece key={pieceType} pieceType={pieceType} />
        ))}
        <div className="weight">{diff > 0 ? "+" + diff : ""}</div>
      </div>
      <div className="fallen-pieces fallen-pieces--black">
        {blackFallenPieces.map(({ pieceType }) => (
          <FallenPiece key={pieceType} pieceType={pieceType} />
        ))}
        <div className="weight">{diff < 0 ? "+" + Math.abs(diff) : ""}</div>
      </div>
    </>
  );
};
