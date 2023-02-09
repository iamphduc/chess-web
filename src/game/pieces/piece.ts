import { HistorySquares } from "game/calculate-attack";
import { PieceOccupied } from "game/piece-type";

export type Position = [number, number];

export abstract class Piece {
  protected readonly isBlack: boolean;
  protected point: number;

  constructor(isBlack: boolean) {
    this.isBlack = isBlack;
    this.point = 0;
  }

  abstract getPossibleMoves([fromY, fromX]: Position, squares: HistorySquares): Position[];
  abstract getImage(): string;
  abstract getWeight(): number;

  protected getOccupiedSquare([toY, toX]: Position, squares: HistorySquares): PieceOccupied {
    if (toY < 0 || toY >= 8 || toX < 0 || toY >= 8) {
      throw new Error("Out of the board");
    }

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
