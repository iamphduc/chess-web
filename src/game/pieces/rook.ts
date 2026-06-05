import WRook from "assets/rook-white.svg";
import BRook from "assets/rook-black.svg";
import { Piece } from "./piece";

export class Rook extends Piece {
  constructor(isBlack = false) {
    super(isBlack);
    this.image = this.isBlack ? BRook : WRook;
    this.weight = 5;
    this.abbreviation = "R";
  }
}

export const whiteRook = new Rook();
export const blackRook = new Rook(true);
