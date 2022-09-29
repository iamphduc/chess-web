import { Position } from "./pieces/piece";
import { Pawn } from "./pieces/pawn";
import { pieceFactory } from "./piece-factory";
import { PieceType } from "./piece-type";

export type HistorySquares = Square[][];

export interface Square {
  pieceType: PieceType | null;
  controllers: PieceType[];
}

export const calculateControlledSquares = (squares: HistorySquares) => {
  const calculatedSquares: Square[][] = [...new Array(8)].map(() =>
    [...new Array(8)].map(() => ({
      pieceType: null,
      controllers: [],
    }))
  );

  squares.forEach((initalRow: Square[], fromY: number) => {
    initalRow.forEach(({ pieceType }: Square, fromX: number) => {
      if (!pieceType) return;

      calculatedSquares[fromY][fromX].pieceType = pieceType;

      const piece = pieceFactory.getPiece(pieceType);

      let controlledSquares: Position[] = [];
      if (piece instanceof Pawn) {
        controlledSquares = piece.getControlledSquares([fromY, fromX]);
      } else {
        controlledSquares = piece.getPossibleMoves([fromY, fromX], squares);
      }

      controlledSquares.forEach(([toY, toX]) => {
        if (toY < 0 || toX < 0) return;
        calculatedSquares[toY][toX].controllers.push(pieceType);
      });
    });
  });

  return calculatedSquares;
};
