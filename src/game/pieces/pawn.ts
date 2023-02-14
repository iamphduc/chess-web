import WPawn from "assets/pawn-white.svg";
import BPawn from "assets/pawn-black.svg";
import { PieceOccupied } from "game/piece-type";
import { Piece, Position } from "./piece";
import { HistorySquares } from "game/piece-moves";

export class Pawn extends Piece {
  private enPassantPosition: Position;

  constructor(isBlack = false) {
    super(isBlack);
    this.image = isBlack ? BPawn : WPawn;
    this.weight = 1;
    this.enPassantPosition = [-1, -1];
  }

  public getPossibleMoves([fromY, fromX]: Position, squares: HistorySquares): Position[] {
    const moves: Position[] = [];

    // Pawn promotion
    if ((fromY === 0 && !this.isBlack) || (fromY === 7 && this.isBlack)) {
      return [];
    }

    const directionBasedOnColor = this.isBlack ? 1 : -1;
    const toY = fromY + directionBasedOnColor;
    const toX = fromX;

    // Move a square forward
    if (
      toY >= 0 &&
      toY < 8 &&
      super.getOccupiedSquare([toY, toX], squares) === PieceOccupied.None
    ) {
      moves.push([toY, toX]);

      // Move 2 squares forward
      if ((fromY === 1 && this.isBlack) || (fromY === 6 && !this.isBlack)) {
        const to2Y = fromY + directionBasedOnColor * 2;
        if (
          to2Y >= 0 &&
          to2Y < 8 &&
          super.getOccupiedSquare([to2Y, toX], squares) === PieceOccupied.None
        ) {
          moves.push([to2Y, toX]);
        }
      }
    }

    // Capture enemies
    const capturedMoves = this.getAttackedSquares([fromY, fromX], squares);

    return [...moves, ...capturedMoves];
  }

  public getAttackedSquares([fromY, fromX]: Position, squares: HistorySquares): Position[] {
    const moves: Position[] = [];

    const directionYBasedOnColor = this.isBlack ? 1 : -1;
    const toY = fromY + directionYBasedOnColor;
    const toX = fromX;

    const directionX = [-1, 1];
    directionX.forEach((direction) => {
      const capturedX = toX + direction;
      if (
        capturedX >= 0 &&
        capturedX < 8 &&
        toY >= 0 &&
        toY < 8 &&
        super.getOccupiedSquare([toY, capturedX], squares) === PieceOccupied.Enemy
      ) {
        moves.push([toY, capturedX]);
      }
    });

    const [enPassantY, enPassantX] = this.enPassantPosition;
    if (enPassantY !== -1 && enPassantX !== -1) {
      if (Math.abs(fromX - enPassantX) === 1 && fromY === enPassantY - directionYBasedOnColor) {
        moves.push(this.enPassantPosition);
      }
    }

    return moves;
  }

  public setEnPassantPosition(position: Position): void {
    const [y, x] = position;
    if (y === -1 && x === -1) {
      this.enPassantPosition = [-1, -1];
    } else {
      const directionYBasedOnColor = this.isBlack ? 1 : -1;
      this.enPassantPosition = [y + directionYBasedOnColor, x];
    }
  }

  public getEnPassantPosition(): Position {
    return this.enPassantPosition;
  }
}

export const whitePawn = new Pawn();
export const blackPawn = new Pawn(true);
