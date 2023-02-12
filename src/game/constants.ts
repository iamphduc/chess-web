import { PieceType } from "game/piece-type";
import { Square } from "./calculate-attack";

// prettier-ignore
const initialPiecesPosition = [
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

export const initialSquares: Square[][] = initialPiecesPosition.map((row) =>
  row.map((pieceType) => ({
    pieceType,
    isEnemyAttacked: false,
  }))
);

export const piecePromotedBoard = [
  // White side
  [
    PieceType.WhiteQueenPromoted1,
    PieceType.WhiteQueenPromoted2,
    PieceType.WhiteQueenPromoted3,
    PieceType.WhiteQueenPromoted4,
  ],
  [
    PieceType.WhiteRookPromoted1,
    PieceType.WhiteRookPromoted2,
    PieceType.WhiteRookPromoted3,
    PieceType.WhiteRookPromoted4,
  ],
  [
    PieceType.WhiteBishopPromoted1,
    PieceType.WhiteBishopPromoted2,
    PieceType.WhiteBishopPromoted3,
    PieceType.WhiteBishopPromoted4,
  ],
  [
    PieceType.WhiteKnightPromoted1,
    PieceType.WhiteKnightPromoted2,
    PieceType.WhiteKnightPromoted3,
    PieceType.WhiteKnightPromoted4,
  ],

  // Black side
  [
    PieceType.BlackQueenPromoted1,
    PieceType.BlackQueenPromoted2,
    PieceType.BlackQueenPromoted3,
    PieceType.BlackQueenPromoted4,
  ],
  [
    PieceType.BlackRookPromoted1,
    PieceType.BlackRookPromoted2,
    PieceType.BlackRookPromoted3,
    PieceType.BlackRookPromoted4,
  ],
  [
    PieceType.BlackBishopPromoted1,
    PieceType.BlackBishopPromoted2,
    PieceType.BlackBishopPromoted3,
    PieceType.BlackBishopPromoted4,
  ],
  [
    PieceType.BlackKnightPromoted1,
    PieceType.BlackKnightPromoted2,
    PieceType.BlackKnightPromoted3,
    PieceType.BlackKnightPromoted4,
  ],
];

export const CELL_SIZE = 52;
