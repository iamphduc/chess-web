import { HistorySquares } from "game/calculate-squares";
import { PieceOccupied } from "game/piece-type";

export type Position = [number, number];

export abstract class Piece {
  protected readonly isBlack: boolean;

  constructor(isBlack: boolean) {
    this.isBlack = isBlack;
  }

  abstract getPossibleMoves([fromY, fromX]: Position, squares: HistorySquares): Position[];

  abstract getImage(): string;

  protected getOccupiedSquare([toY, toX]: Position, squares: HistorySquares): PieceOccupied {
    const occupiedSquare = squares[toY][toX];

    if (!occupiedSquare.pieceType) {
      return PieceOccupied.None;
    }

    const isOccupiedPieceBlack = occupiedSquare.pieceType.includes("BLACK");
    if (this.isBlack === isOccupiedPieceBlack) {
      return PieceOccupied.Ours;
    }

    return PieceOccupied.Enemy;
  }

  public isWhitePiece(): boolean {
    return !this.isBlack;
  }
}
