import WPawn from "assets/pawn-white.svg";
import BPawn from "assets/pawn-black.svg";
import { HistorySquares } from "game/calculate-attack";
import { PieceOccupied } from "game/piece-type";
import { Piece, Position } from "./piece";

export class Pawn extends Piece {
  constructor(isBlack = false) {
    super(isBlack);
    this.image = isBlack ? BPawn : WPawn;
    this.weight = 1;
  }

  public getPossibleMoves([fromY, fromX]: Position, squares: HistorySquares): Position[] {
    const moves: Position[] = [];

    if ((fromY === 0 && !this.isBlack) || (fromY === 7 && this.isBlack)) {
      // TODO: Promotion
      return [];
    }

    const directionBasedOnColor = this.isBlack ? 1 : -1;
    const toY = fromY + directionBasedOnColor;
    const toX = fromX;

    // Move a square forward
    if (super.getOccupiedSquare([toY, toX], squares) === PieceOccupied.None) {
      moves.push([toY, toX]);
    }

    // Move 2 squares forward
    if ((fromY === 1 && this.isBlack) || (fromY === 6 && !this.isBlack)) {
      const to2Y = fromY + directionBasedOnColor * 2;
      if (
        super.getOccupiedSquare([toY, toX], squares) === PieceOccupied.None &&
        super.getOccupiedSquare([to2Y, toX], squares) === PieceOccupied.None
      ) {
        moves.push([to2Y, toX]);
      }
    }

    // Capture enemies
    const capturedMoves = this.getAttackedSquares([fromY, fromX]);
    if (toX - 1 >= 0 && super.getOccupiedSquare([toY, toX - 1], squares) === PieceOccupied.Enemy) {
      moves.push(capturedMoves[0]);
    }
    if (toX + 1 < 8 && super.getOccupiedSquare([toY, toX + 1], squares) === PieceOccupied.Enemy) {
      moves.push(capturedMoves[1]);
    }

    return moves;
  }

  public getAttackedSquares([fromY, fromX]: Position): Position[] {
    const moves: Position[] = [];

    const directionYBasedOnColor = this.isBlack ? 1 : -1;
    const toY = fromY + directionYBasedOnColor;
    const toX = fromX;

    const directionX = [-1, 1];
    directionX.forEach((direction) => {
      const capturedX = toX + direction;
      if (capturedX < 0 || capturedX >= 8) return;
      moves.push([toY, capturedX]);
    });

    return moves;
  }
}

export const whitePawn = new Pawn();
export const blackPawn = new Pawn(true);
