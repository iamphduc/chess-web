import WPawn from "assets/pawn-white.svg";
import BPawn from "assets/pawn-black.svg";
import { HistorySquares } from "game/constants";
import { PieceType, PieceOccupied } from "game/piece-type";
import { Piece, Position } from "./piece";

export class Pawn extends Piece {
  private readonly initialPositions: number[][];

  constructor(isBlack = false) {
    super(isBlack);

    this.initialPositions = [
      [8, 9, 10, 11, 12, 13, 14, 15],
      [48, 49, 50, 51, 52, 53, 54, 55],
    ];
  }

  public getPossibleMoves(
    type: PieceType,
    [fromY, fromX]: Position,
    squares: HistorySquares
  ): number[] {
    const signed = this.isBlack ? 1 : -1;
    const toY = fromY + signed;
    const toX = fromX;
    const src = fromY * 8 + fromX;
    const dest = toY * 8 + toX;
    const moves = [];

    // Move forward
    if (super.getOccupiedSquare(type, [toY, toX], squares) === PieceOccupied.None) {
      moves.push(dest);
      if (this.initialPositions[this.isBlack ? 0 : 1].includes(src)) {
        moves.push(dest + signed * 8);
      }
    }

    // Capture Enemies
    [-1, 1].forEach((direction) => {
      if (super.getOccupiedSquare(type, [toY, toX - direction], squares) === PieceOccupied.Enemy) {
        moves.push(dest - direction);
      }
    });

    return moves;
  }

  public getImage(): string {
    return this.isBlack ? BPawn : WPawn;
  }
}

export const whitePawn = new Pawn();
export const blackPawn = new Pawn(true);
