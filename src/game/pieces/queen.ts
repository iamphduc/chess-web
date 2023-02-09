import WQueen from "assets/queen-white.svg";
import BQueen from "assets/queen-black.svg";
import { HistorySquares } from "game/calculate-attack";
import { Piece, Position } from "./piece";
import { Bishop } from "./bishop";
import { Rook } from "./rook";

export class Queen extends Piece {
  private readonly whiteRook: Rook;
  private readonly blackRook: Rook;
  private readonly whiteBishop: Bishop;
  private readonly blackBishop: Bishop;

  constructor(isBlack = false) {
    super(isBlack);
    this.point = 9;
    this.whiteRook = new Rook();
    this.blackRook = new Rook(true);
    this.whiteBishop = new Bishop();
    this.blackBishop = new Bishop(true);
  }

  public getPossibleMoves(from: Position, squares: HistorySquares): Position[] {
    const rook = this.isBlack ? this.blackRook : this.whiteRook;
    const bishop = this.isBlack ? this.blackBishop : this.whiteBishop;

    const rookMoves = rook.getPossibleMoves(from, squares);
    const bishopMoves = bishop.getPossibleMoves(from, squares);

    return [...rookMoves, ...bishopMoves];
  }

  public getImage(): string {
    return this.isBlack ? BQueen : WQueen;
  }

  public getWeight(): number {
    return 9;
  }
}

export const whiteQueen = new Queen();
export const blackQueen = new Queen(true);
