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
  for (let fromY = 0; fromY < 8; fromY++) {
    for (let fromX = 0; fromX < 8; fromX++) {
      const { pieceType } = squares[fromY][fromX];
      if (!pieceType) continue;

      const piece = pieceFactory.getPiece(pieceType);
      if (isWhiteTurn !== piece.isWhitePiece()) continue;

      // Cannot castling while in a check
      if (piece instanceof King) {
        piece.removePossibleCastling("BOTH");
      }

      const possibleMoves = piece.getPossibleMoves([fromY, fromX], squares);
      for (const [toY, toX] of possibleMoves) {
        const newSquares = JSON.parse(JSON.stringify(squares));

        updateSquares(newSquares, pieceType, [fromY, fromX], [toY, toX]);
        const calculatedSquares = calculateAttack(newSquares, isWhiteTurn);

        if (!calculatedSquares[kingY][kingX].isEnemyAttacked) {
          return false;
        }
      }
    }
  }

  return true;
};
