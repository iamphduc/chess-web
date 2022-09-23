import { PieceDragType } from "game/piece-type";

export type HistorySquares = (PieceDragType | null)[][];

// prettier-ignore
export const initialSquares: HistorySquares = [
  // 1st
  [
    PieceDragType.BlackQueenRook,
    PieceDragType.BlackQueenKnight,
    PieceDragType.BlackQueenBishop,
    PieceDragType.BlackQueen,
    PieceDragType.BlackKing,
    PieceDragType.BlackKingBishop,
    PieceDragType.BlackKingKnight,
    PieceDragType.BlackKingRook,
  ],
  // 2nd
  [
    PieceDragType.BlackPawnA,
    PieceDragType.BlackPawnB,
    PieceDragType.BlackPawnC,
    PieceDragType.BlackPawnD,
    PieceDragType.BlackPawnE,
    PieceDragType.BlackPawnF,
    PieceDragType.BlackPawnG,
    PieceDragType.BlackPawnH,
  ],
  // 3rd
  [null, null, null, null, null, null, null, null],
  // 4th
  [null, null, null, null, null, null, null, null],
  // 5th
  [null, null, null, null, null, null, null, null],
  // 6th
  [null, null, null, null, null, null, null, null],
  // 7th
  [
    PieceDragType.WhitePawnA,
    PieceDragType.WhitePawnB,
    PieceDragType.WhitePawnC,
    PieceDragType.WhitePawnD,
    PieceDragType.WhitePawnE,
    PieceDragType.WhitePawnF,
    PieceDragType.WhitePawnG,
    PieceDragType.WhitePawnH,
  ],
  // 8th
  [
    PieceDragType.WhiteQueenRook,
    PieceDragType.WhiteQueenKnight,
    PieceDragType.WhiteQueenBishop,
    PieceDragType.WhiteQueen,
    PieceDragType.WhiteKing,
    PieceDragType.WhiteKingBishop,
    PieceDragType.WhiteKingKnight,
    PieceDragType.WhiteKingRook,
  ],
];
