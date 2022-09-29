import { Position } from "./pieces/piece";
import { Pawn } from "./pieces/pawn";
import { pieceFactory } from "./piece-factory";
import { PieceType } from "./piece-type";

export type HistorySquares = Square[][];

export interface Square {
  pieceType: PieceType | null;
  isEnemyAttacked: boolean;
}

export const calculateSquares = (squares: HistorySquares) => {
  const calculatedSquares: Square[][] = [...new Array(8)].map(() =>
    [...new Array(8)].map(() => ({
      pieceType: null,
      isEnemyAttacked: false,
    }))
  );

  squares.forEach((initalRow: Square[], fromY: number) => {
    initalRow.forEach(({ pieceType }: Square, fromX: number) => {
      if (!pieceType) return;

      calculatedSquares[fromY][fromX].pieceType = pieceType;

      const piece = pieceFactory.getPiece(pieceType);

      let attackedSquares: Position[] = [];
      if (piece instanceof Pawn) {
        attackedSquares = piece.getAttackedSquares([fromY, fromX]);
      } else {
        attackedSquares = piece.getPossibleMoves([fromY, fromX], squares);
      }

      for (const [toY, toX] of attackedSquares) {
        if (toY < 0 || toY >= 8 || toX < 0 || toX >= 8) {
          throw new Error(`Invalid attacked squares: ${[toY, toX]}`);
        }
        calculatedSquares[toY][toX].isEnemyAttacked = true;
      }
    });
  });

  return calculatedSquares;
};
