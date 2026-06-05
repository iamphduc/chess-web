import WQueen from "assets/queen-white.svg";
import BQueen from "assets/queen-black.svg";
import { Piece } from "./piece";

export class Queen extends Piece {
  constructor(isBlack = false) {
    super(isBlack);
    this.image = this.isBlack ? BQueen : WQueen;
    this.weight = 9;
    this.abbreviation = "Q";
  }
}

export const whiteQueen = new Queen();
export const blackQueen = new Queen(true);
