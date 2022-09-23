import WRook from "assets/rook-white.svg";
import BRook from "assets/rook-black.svg";
import { HistorySquares } from "game/constants";
import { PieceType, PieceOccupied } from "game/piece-type";
import { Piece, Position } from "./piece";

export class Rook extends Piece {
  constructor(isBlack = false) {
    super(isBlack);
  }

  public getPossibleMoves(
    type: PieceType,
    [fromY, fromX]: Position,
    squares: HistorySquares
  ): number[] {
    const moves: number[] = [];

    // Current -> Left
    for (let x = fromX - 1; x >= 0; x--) {
      if (!this.addPossibleMove(moves, type, [fromY, x], squares)) break;
    }

    // Current -> Right
    for (let x = fromX + 1; x < 8; x++) {
      if (!this.addPossibleMove(moves, type, [fromY, x], squares)) break;
    }

    // Current -> Top
    for (let y = fromY - 1; y >= 0; y--) {
      if (!this.addPossibleMove(moves, type, [y, fromX], squares)) break;
    }

    // Current -> Bottom
    for (let y = fromY + 1; y < 8; y++) {
      if (!this.addPossibleMove(moves, type, [y, fromX], squares)) break;
    }

    return moves;
  }

  protected addPossibleMove(
    moves: number[],
    type: PieceType,
    [y, x]: Position,
    squares: any[]
  ): boolean {
    const pieceOccupied = super.getOccupiedSquare(type, [y, x], squares);
    const dest = y * 8 + x;
    if (pieceOccupied === PieceOccupied.Enemy) {
      moves.push(dest);
      return false;
    }
    if (pieceOccupied === PieceOccupied.Ours) {
      return false;
    }
    moves.push(dest);
    return true;
  }

  public getImage(): string {
    return this.isBlack ? BRook : WRook;
  }
}

export const whiteRook = new Rook();
export const blackRook = new Rook(true);
