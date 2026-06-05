import WKing from "assets/king-white.svg";
import BKing from "assets/king-black.svg";
import { Knight } from "./knight";

export class King extends Knight {
  constructor(isBlack = false) {
    super(isBlack);
    this.image = this.isBlack ? BKing : WKing;
    this.abbreviation = "K";
  }
}

export const whiteKing = new King();
export const blackKing = new King(true);
