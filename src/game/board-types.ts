import { PieceType } from "./piece-type";

export interface Square {
  pieceType: PieceType | null;
  isEnemyAttacked: boolean;
}

export type HistorySquares = Square[][];
