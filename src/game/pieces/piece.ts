import { HistorySquares } from "game/constants";
import { PieceType, PieceOccupied } from "game/piece-type";

export type Position = [number, number];

export abstract class Piece {
  protected readonly isBlack: boolean;

  constructor(isBlack: boolean) {
    this.isBlack = isBlack;
  }

  abstract getPossibleMoves(
    type: PieceType,
    [fromY, fromX]: Position,
    squares: HistorySquares
  ): number[];

  abstract getImage(): string;

  public getOccupiedSquare(
    type: PieceType,
    [toY, toX]: Position,
    squares: HistorySquares
  ): PieceOccupied {
    const occupiedSquare = squares[toY][toX];

    if (!occupiedSquare) {
      return PieceOccupied.None;
    }

    const isSelectedPieceWhite = type.includes("WHITE");
    const isOccupiedPieceWhite = occupiedSquare.includes("WHITE");
    if (isSelectedPieceWhite === isOccupiedPieceWhite) {
      return PieceOccupied.Ours;
    }

    return PieceOccupied.Enemy;
  }
}
