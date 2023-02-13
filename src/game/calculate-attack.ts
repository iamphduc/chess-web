import { Position } from "./pieces/piece";
import { Pawn } from "./pieces/pawn";
import { pieceFactory } from "./piece-factory";
import { PieceType } from "./piece-type";

export type HistorySquares = Square[][];

export interface Square {
  pieceType: PieceType | null;
  isEnemyAttacked: boolean;
}

export const calculateAttack = (squares: HistorySquares, isWhiteTurn: boolean) => {
  const attackSquares: Square[][] = [...new Array(8)].map(() =>
    [...new Array(8)].map(() => ({
      pieceType: null,
      isEnemyAttacked: false,
    }))
  );

  squares.forEach((initalRow: Square[], fromY: number) => {
    initalRow.forEach(({ pieceType }: Square, fromX: number) => {
      if (!pieceType) return;

      attackSquares[fromY][fromX].pieceType = pieceType;

      const piece = pieceFactory.getPiece(pieceType);
      if (isWhiteTurn !== piece.isWhitePiece()) return;

      let attackedSquares: Position[] = [];
      if (piece instanceof Pawn) {
        attackedSquares = piece.getAttackedSquares([fromY, fromX], squares);
      } else {
        attackedSquares = piece.getPossibleMoves([fromY, fromX], squares);
      }

      for (const [toY, toX] of attackedSquares) {
        if (toY >= 0 && toY < 8 && toX >= 0 && toY < 8) {
          attackSquares[toY][toX].isEnemyAttacked = true;
        }
      }
    });
  });

  return attackSquares;
};
