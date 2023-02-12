import React from "react";

import "./BoardSidebar.css";
import { useAppSelector } from "app/hooks";
import { FallenPiece } from "./FallenPiece";

export const BoardSidebar = () => {
  const { whiteFallenPieces, blackFallenPieces } = useAppSelector((state) => state.board);
  const whiteWeight = whiteFallenPieces.reduce((acc, curr) => acc + Math.floor(curr.weight), 0);
  const blackWeight = blackFallenPieces.reduce((acc, curr) => acc + Math.floor(curr.weight), 0);
  const diff = whiteWeight - blackWeight;

  return (
    <div className="board-sidebar">
      <h3 className="board-sidebar__title">Fallen pieces</h3>
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
    </div>
  );
};
