import { HistorySquares } from "game/constants";
import { PieceDragType, PieceOccupied } from "game/piece-type";

export type Position = [number, number];

export abstract class Piece {
  public getOccupiedSquare(
    dragType: PieceDragType,
    [toY, toX]: Position,
    squares: HistorySquares
  ): PieceOccupied {
    const occupiedSquare = squares[toY][toX];

    if (!occupiedSquare) {
      return PieceOccupied.None;
    }

    const isSelectedPieceWhite = dragType.includes("WHITE");
    const isOccupiedPieceWhite = occupiedSquare.includes("WHITE");
    if (isSelectedPieceWhite === isOccupiedPieceWhite) {
      return PieceOccupied.Ours;
    }

    return PieceOccupied.Enemy;
  }

  abstract getPossibleMoves(
    dragType: PieceDragType,
    [fromY, fromX]: Position,
    squares: HistorySquares
  ): number[];
}
