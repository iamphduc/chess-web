import { HistorySquares } from "game/calculate-attack";
import { PieceOccupied } from "game/piece-type";

export type Position = [number, number];

export abstract class Piece {
  protected readonly isBlack: boolean;
  protected image: string;
  protected weight: number;
  protected abbreviation: string;

  constructor(isBlack: boolean) {
    this.isBlack = isBlack;
    this.image = "";
    this.weight = 0;
    this.abbreviation = "";
  }

  abstract getPossibleMoves([fromY, fromX]: Position, squares: HistorySquares): Position[];

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

  public getImage(): string {
    return this.image;
  }

  public getWeight(): number {
    return this.weight;
  }

  public getAbbreviation(): string {
    return this.abbreviation;
  }
}
