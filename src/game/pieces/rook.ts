import WRook from "assets/rook-white.svg";
import BRook from "assets/rook-black.svg";
import { HistorySquares } from "game/calculate-attack";
import { PieceOccupied } from "game/piece-type";
import { Piece, Position } from "./piece";

export class Rook extends Piece {
  constructor(isBlack = false) {
    super(isBlack);
    this.image = this.isBlack ? BRook : WRook;
    this.weight = 5;
    this.abbreviation = "R";
  }

  public getPossibleMoves([fromY, fromX]: Position, squares: HistorySquares): Position[] {
    const moves: Position[] = [];

    // Current -> Left
    for (let x = fromX - 1; x >= 0; x--) {
      if (!this.canMoveAdded(moves, [fromY, x], squares)) break;
    }

    // Current -> Right
    for (let x = fromX + 1; x < 8; x++) {
      if (!this.canMoveAdded(moves, [fromY, x], squares)) break;
    }

    // Current -> Top
    for (let y = fromY - 1; y >= 0; y--) {
      if (!this.canMoveAdded(moves, [y, fromX], squares)) break;
    }

    // Current -> Bottom
    for (let y = fromY + 1; y < 8; y++) {
      if (!this.canMoveAdded(moves, [y, fromX], squares)) break;
    }

    return moves;
  }

  protected canMoveAdded(moves: Position[], [y, x]: Position, squares: any[]): boolean {
    const pieceOccupied = super.getOccupiedSquare([y, x], squares);
    if (pieceOccupied === PieceOccupied.Enemy) {
      moves.push([y, x]);
      return false;
    }
    if (pieceOccupied === PieceOccupied.Ours) {
      return false;
    }
    moves.push([y, x]);
    return true;
  }
}

export const whiteRook = new Rook();
export const blackRook = new Rook(true);
