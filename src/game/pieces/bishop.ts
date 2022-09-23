import { PieceDragType } from "game/piece-type";
import { Position } from "./piece";
import { Rook } from "./rook";

export class Bishop extends Rook {
  public getPossibleMoves(
    dragType: PieceDragType,
    [fromY, fromX]: Position,
    squares: any[]
  ): number[] {
    const moves: number[] = [];
    let y = fromY - 1;
    let x = fromX - 1;

    // Top Left
    while (y >= 0 && x >= 0) {
      if (!super.addPossibleMove(moves, dragType, [y, x], squares)) break;
      y -= 1;
      x -= 1;
    }

    // Top Right
    y = fromY - 1;
    x = fromX + 1;
    while (y >= 0 && x < 8) {
      if (!super.addPossibleMove(moves, dragType, [y, x], squares)) break;
      y -= 1;
      x += 1;
    }

    // Bottom Right
    y = fromY + 1;
    x = fromX + 1;
    while (y < 8 && x < 8) {
      if (!super.addPossibleMove(moves, dragType, [y, x], squares)) break;
      y += 1;
      x += 1;
    }

    // Bottom Left
    y = fromY + 1;
    x = fromX - 1;
    while (y < 8 && x >= 0) {
      if (!super.addPossibleMove(moves, dragType, [y, x], squares)) break;
      y += 1;
      x -= 1;
    }

    return moves;
  }
}

export const bishop = new Bishop();
