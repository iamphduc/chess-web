import WBishop from "assets/bishop-white.svg";
import BBishop from "assets/bishop-black.svg";
import { Rook } from "./rook";

export class Bishop extends Rook {
  constructor(isBlack = false) {
    super(isBlack);
    this.image = this.isBlack ? BBishop : WBishop;
    this.weight = 3.5;
    this.abbreviation = "B";
  }
}

export const whiteBishop = new Bishop();
export const blackBishop = new Bishop(true);
