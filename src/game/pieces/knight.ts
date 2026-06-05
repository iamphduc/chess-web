import WKnight from "assets/knight-white.svg";
import BKnight from "assets/knight-black.svg";
import { Piece } from "./piece";

export class Knight extends Piece {
  constructor(isBlack = false) {
    super(isBlack);
    this.image = this.isBlack ? BKnight : WKnight;
    this.weight = 3;
    this.abbreviation = "N";
  }
}

export const whiteKnight = new Knight();
export const blackKnight = new Knight(true);
