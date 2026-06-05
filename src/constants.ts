import { Square } from "game/board-types";
import { PieceType } from "game/piece-type";
import { PROMOTED_IDS } from "game/engine/moves/promotion";

export const initialSquares: Square[][] = [
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
].map((row) =>
  row.map((pieceType) => ({
    pieceType,
    isEnemyAttacked: false,
  }))
);

/**
 * Single-sourced from the engine's `PROMOTED_IDS` (the live promotion-id table
 * after the legacy `piece-moves.ts` table was deleted). Re-exported here under
 * the historical `PromotionBoard` name so the public `constants` surface is
 * preserved. The 8-slot order is `[WQ, WR, WB, WN, BQ, BR, BB, BN]`.
 */
export const PromotionBoard = PROMOTED_IDS;

export const SQUARE_SIZE_XS = 39;
export const SQUARE_SIZE_MD = 52;
export const SQUARE_SIZE_XL = 78;
export const DEFAULT_TIME = 600;
