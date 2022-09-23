import WKnight from "assets/knight-white.svg";
import BKnight from "assets/knight-black.svg";
import { King } from "./king";

export class Knight extends King {
  constructor(isBlack = false) {
    super(isBlack);

    this.directions = [
      // Top - Left
      [-2, -1],
      [-1, -2],
      // Top - Right
      [1, -2],
      [2, -1],
      // Bottom - Right
      [2, 1],
      [1, 2],
      // Bottom - Left
      [-1, 2],
      [-2, 1],
    ];
  }

  public getImage(): string {
    return this.isBlack ? BKnight : WKnight;
  }
}

export const whiteKnight = new Knight();
export const blackKnight = new Knight(true);
