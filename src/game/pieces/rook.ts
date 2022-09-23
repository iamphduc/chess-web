import { HistorySquares } from "game/constants";
import { PieceDragType, PieceOccupied } from "game/piece-type";
import { Piece, Position } from "./piece";

export class Rook extends Piece {
  public getPossibleMoves(
    dragType: PieceDragType,
    [fromY, fromX]: Position,
    squares: HistorySquares
  ): number[] {
    const moves: number[] = [];

    // Current -> Left
    for (let x = fromX - 1; x >= 0; x--) {
      if (!this.addPossibleMove(moves, dragType, [fromY, x], squares)) break;
    }

    // Current -> Right
    for (let x = fromX + 1; x < 8; x++) {
      if (!this.addPossibleMove(moves, dragType, [fromY, x], squares)) break;
    }

    // Current -> Top
    for (let y = fromY - 1; y >= 0; y--) {
      if (!this.addPossibleMove(moves, dragType, [y, fromX], squares)) break;
    }

    // Current -> Bottom
    for (let y = fromY + 1; y < 8; y++) {
      if (!this.addPossibleMove(moves, dragType, [y, fromX], squares)) break;
    }

    return moves;
  }

  protected addPossibleMove(
    moves: number[],
    dragType: PieceDragType,
    [y, x]: Position,
    squares: any[]
  ): boolean {
    const pieceOccupied = super.getOccupiedSquare(dragType, [y, x], squares);
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
}

export const rook = new Rook();
