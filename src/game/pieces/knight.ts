import WKnight from "assets/knight-white.svg";
import BKnight from "assets/knight-black.svg";
import { PieceOccupied } from "game/piece-type";
import { Piece, Position } from "./piece";
import { HistorySquares } from "game/piece-moves";

export class Knight extends Piece {
  protected directions: [number, number][];

  constructor(isBlack = false) {
    super(isBlack);
    this.image = this.isBlack ? BKnight : WKnight;
    this.weight = 3;
    this.directions = [
      // Top - Left
      [-2, -1],
      [-1, -2],
      // Top - Right
      [1, -2],
      [2, -1],
      // Bottom - Right
      [2, 1],
      [1, 2],
      // Bottom - Left
      [-1, 2],
      [-2, 1],
    ];
    this.abbreviation = "N";
  }

  public getPossibleMoves([fromY, fromX]: Position, squares: HistorySquares): Position[] {
    const moves: Position[] = [];

    this.directions.forEach(([x, y]) => {
      const toY = fromY + y;
      const toX = fromX + x;

      if (toY >= 8 || toY < 0 || toX >= 8 || toX < 0) return;
      if (super.getOccupiedSquare([toY, toX], squares) === PieceOccupied.Ours) return;

      moves.push([toY, toX]);
    });

    return moves;
  }
}

export const whiteKnight = new Knight();
export const blackKnight = new Knight(true);
