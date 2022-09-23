import WQueen from "assets/queen-white.svg";
import BQueen from "assets/queen-black.svg";
import { HistorySquares } from "game/constants";
import { PieceType } from "game/piece-type";
import { Piece, Position } from "./piece";
import { Bishop } from "./bishop";
import { Rook } from "./rook";

export class Queen extends Piece {
  private readonly rook: Rook;
  private readonly bishop: Bishop;

  constructor(isBlack = false) {
    super(isBlack);

    this.rook = new Rook();
    this.bishop = new Bishop();
  }

  public getPossibleMoves(type: PieceType, from: Position, squares: HistorySquares): number[] {
    const rookMoves = this.rook.getPossibleMoves(type, from, squares);
    const bishopMoves = this.bishop.getPossibleMoves(type, from, squares);

    return [...rookMoves, ...bishopMoves];
  }

  public getImage(): string {
    return this.isBlack ? BQueen : WQueen;
  }
}

export const whiteQueen = new Queen();
export const blackQueen = new Queen(true);
