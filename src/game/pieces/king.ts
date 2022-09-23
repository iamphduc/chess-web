import WKing from "assets/king-white.svg";
import BKing from "assets/king-black.svg";
import { HistorySquares } from "game/constants";
import { PieceType, PieceOccupied } from "game/piece-type";
import { Piece, Position } from "./piece";

export class King extends Piece {
  protected directions: [number, number][];

  constructor(isBlack = false) {
    super(isBlack);

    this.directions = [
      // Above row
      [-1, -1],
      [0, -1],
      [1, -1],
      // Current row
      [-1, 0],
      [1, 0],
      // Below row
      [-1, 1],
      [0, 1],
      [1, 1],
    ];
  }

  public getPossibleMoves(
    type: PieceType,
    [fromY, fromX]: Position,
    squares: HistorySquares
  ): number[] {
    const moves: number[] = this.directions.map(([x, y]) => {
      const toY = fromY + y;
      const toX = fromX + x;
      if (toY >= 8 || toY < 0 || toX >= 8 || toX < 0) {
        return -1;
      }

      const pieceOccupied = super.getOccupiedSquare(type, [toY, toX], squares);
      if (pieceOccupied === PieceOccupied.Ours) {
        return -1;
      }

      return toY * 8 + toX;
    });

    return moves;
  }

  public getImage(): string {
    return this.isBlack ? BKing : WKing;
  }
}

export const whiteKing = new King();
export const blackKing = new King(true);
