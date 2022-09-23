import { PieceType } from "game/piece-type";

export type HistorySquares = (PieceType | null)[][];

// prettier-ignore
export const initialSquares: HistorySquares = [
  // 1st
  [
    PieceType.BlackQueenRook,
    PieceType.BlackQueenKnight,
    PieceType.BlackQueenBishop,
    PieceType.BlackQueen,
    PieceType.BlackKing,
    PieceType.BlackKingBishop,
    PieceType.BlackKingKnight,
    PieceType.BlackKingRook,
  ],
  // 2nd
  [
    PieceType.BlackPawnA,
    PieceType.BlackPawnB,
    PieceType.BlackPawnC,
    PieceType.BlackPawnD,
    PieceType.BlackPawnE,
    PieceType.BlackPawnF,
    PieceType.BlackPawnG,
    PieceType.BlackPawnH,
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
    PieceType.WhitePawnA,
    PieceType.WhitePawnB,
    PieceType.WhitePawnC,
    PieceType.WhitePawnD,
    PieceType.WhitePawnE,
    PieceType.WhitePawnF,
    PieceType.WhitePawnG,
    PieceType.WhitePawnH,
  ],
  // 8th
  [
    PieceType.WhiteQueenRook,
    PieceType.WhiteQueenKnight,
    PieceType.WhiteQueenBishop,
    PieceType.WhiteQueen,
    PieceType.WhiteKing,
    PieceType.WhiteKingBishop,
    PieceType.WhiteKingKnight,
    PieceType.WhiteKingRook,
  ],
];
