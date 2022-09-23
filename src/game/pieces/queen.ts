import { HistorySquares } from "game/constants";
import { PieceDragType } from "game/piece-type";
import { Piece, Position } from "./piece";
import { bishop, Bishop } from "./bishop";
import { rook, Rook } from "./rook";

export class Queen extends Piece {
  private readonly rook: Rook;
  private readonly bishop: Bishop;

  constructor() {
    super();
    this.rook = rook;
    this.bishop = bishop;
  }

  public getPossibleMoves(
    dragType: PieceDragType,
    from: Position,
    squares: HistorySquares
  ): number[] {
    const rookMoves = this.rook.getPossibleMoves(dragType, from, squares);
    const bishopMoves = this.bishop.getPossibleMoves(dragType, from, squares);

    return [...rookMoves, ...bishopMoves];
  }
}

export const queen = new Queen();
