import WBishop from "assets/bishop-white.svg";
import BBishop from "assets/bishop-black.svg";
import { HistorySquares } from "game/calculate-attack";
import { Position } from "./piece";
import { Rook } from "./rook";

export class Bishop extends Rook {
  constructor(isBlack = false) {
    super(isBlack);
    this.image = this.isBlack ? BBishop : WBishop;
    this.weight = 3;
    this.abbreviation = "B";
  }

  public getPossibleMoves([fromY, fromX]: Position, squares: HistorySquares): Position[] {
    const moves: Position[] = [];
    let toY = fromY - 1;
    let toX = fromX - 1;

    // Top Left
    while (toY >= 0 && toX >= 0) {
      if (!super.canMoveAdded(moves, [toY, toX], squares)) break;
      toY -= 1;
      toX -= 1;
    }

    // Top Right
    toY = fromY - 1;
    toX = fromX + 1;
    while (toY >= 0 && toX < 8) {
      if (!super.canMoveAdded(moves, [toY, toX], squares)) break;
      toY -= 1;
      toX += 1;
    }

    // Bottom Right
    toY = fromY + 1;
    toX = fromX + 1;
    while (toY < 8 && toX < 8) {
      if (!super.canMoveAdded(moves, [toY, toX], squares)) break;
      toY += 1;
      toX += 1;
    }

    // Bottom Left
    toY = fromY + 1;
    toX = fromX - 1;
    while (toY < 8 && toX >= 0) {
      if (!super.canMoveAdded(moves, [toY, toX], squares)) break;
      toY += 1;
      toX -= 1;
    }

    return moves;
  }
}

export const whiteBishop = new Bishop();
export const blackBishop = new Bishop(true);
