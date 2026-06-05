import WPawn from "assets/pawn-white.svg";
import BPawn from "assets/pawn-black.svg";
import { Piece } from "./piece";

export class Pawn extends Piece {
  constructor(isBlack = false) {
    super(isBlack);
    this.image = isBlack ? BPawn : WPawn;
    this.weight = 1;
  }
}

export const whitePawn = new Pawn();
export const blackPawn = new Pawn(true);
