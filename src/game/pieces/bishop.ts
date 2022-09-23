import WBishop from "assets/bishop-white.svg";
import BBishop from "assets/bishop-black.svg";
import { HistorySquares } from "game/constants";
import { PieceType } from "game/piece-type";
import { Position } from "./piece";
import { Rook } from "./rook";

export class Bishop extends Rook {
  constructor(isBlack = false) {
    super(isBlack);
  }

  public getPossibleMoves(
    type: PieceType,
    [fromY, fromX]: Position,
    squares: HistorySquares
  ): number[] {
    const moves: number[] = [];
    let y = fromY - 1;
    let x = fromX - 1;

    // Top Left
    while (y >= 0 && x >= 0) {
      if (!super.addPossibleMove(moves, type, [y, x], squares)) break;
      y -= 1;
      x -= 1;
    }

    // Top Right
    y = fromY - 1;
    x = fromX + 1;
    while (y >= 0 && x < 8) {
      if (!super.addPossibleMove(moves, type, [y, x], squares)) break;
      y -= 1;
      x += 1;
    }

    // Bottom Right
    y = fromY + 1;
    x = fromX + 1;
    while (y < 8 && x < 8) {
      if (!super.addPossibleMove(moves, type, [y, x], squares)) break;
      y += 1;
      x += 1;
    }

    // Bottom Left
    y = fromY + 1;
    x = fromX - 1;
    while (y < 8 && x >= 0) {
      if (!super.addPossibleMove(moves, type, [y, x], squares)) break;
      y += 1;
      x -= 1;
    }

    return moves;
  }

  public getImage(): string {
    return this.isBlack ? BBishop : WBishop;
  }
}

export const whiteBishop = new Bishop();
export const blackBishop = new Bishop(true);
