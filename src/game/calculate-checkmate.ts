import { updateSquares } from "features/board/BoardSlice";
import { calculateAttack, HistorySquares } from "./calculate-attack";
import { pieceFactory } from "./piece-factory";
import { King } from "./pieces/king";
import { Position } from "./pieces/piece";

export const calculateCheckmate = (
  squares: HistorySquares,
  isWhiteTurn: boolean,
  [kingY, kingX]: Position
): boolean => {
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const { pieceType } = squares[y][x];
      if (!pieceType) continue;

      const piece = pieceFactory.getPiece(pieceType);
      if (isWhiteTurn !== piece.isWhitePiece()) continue;

      let currentKingY = kingY;
      let currentKingX = kingX;
      const possibleMoves = piece.getPossibleMoves([y, x], squares);
      for (const [toY, toX] of possibleMoves) {
        if (toY >= 0 && toY < 8 && toX >= 0 && toY < 8) {
          const newSquares = JSON.parse(JSON.stringify(squares));

          updateSquares(newSquares, pieceType, [y, x], [toY, toX]);
          const calculatedSquares = calculateAttack(newSquares, !isWhiteTurn);

          if (piece instanceof King) {
            [currentKingY, currentKingX] = [toY, toX];
          }

          if (!calculatedSquares[currentKingY][currentKingX].isEnemyAttacked) {
            return false;
          }
        }
      }
    }
  }

  return true;
};
