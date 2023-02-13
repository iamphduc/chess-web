import WKing from "assets/king-white.svg";
import BKing from "assets/king-black.svg";
import { HistorySquares } from "game/calculate-attack";
import { PieceType } from "game/piece-type";
import { Position } from "./piece";
import { Knight } from "./knight";

export class King extends Knight {
  private isQueenSideCastlingPossible = true;
  private isKingSideCastlingPossible = true;

  constructor(isBlack = false) {
    super(isBlack);
    this.image = this.isBlack ? BKing : WKing;
    this.directions = [
      // Above row
      [-1, -1],
      [0, -1],
      [1, -1],
      // Current row
      [-1, 0],
      [1, 0],
      // Below row
      [-1, 1],
      [0, 1],
      [1, 1],
    ];
    this.abbreviation = "K";
  }

  public getPossibleMoves([fromY, fromX]: Position, squares: HistorySquares): Position[] {
    const moves: Position[] = super.getPossibleMoves([fromY, fromX], squares);
    const castlingMoves = this.getCastlingMoves([fromY, fromX], squares);

    return [...moves, ...castlingMoves];
  }

  private getCastlingMoves([fromY, fromX]: Position, squares: HistorySquares): Position[] {
    const moves: Position[] = [];

    if (
      this.isQueenSideCastlingPossible &&
      squares[fromY][fromX - 1].pieceType === null &&
      squares[fromY][fromX - 2].pieceType === null &&
      squares[fromY][fromX - 3].pieceType === null &&
      squares[fromY][fromX - 4].pieceType ===
        (this.isBlack ? PieceType.BlackQueenRook : PieceType.WhiteQueenRook) &&
      !squares[fromY][fromX].isEnemyAttacked
    ) {
      if (!squares[fromY][fromX - 1].isEnemyAttacked) {
        moves.push([fromY, fromX - 2]);
      }
    }

    if (
      this.isKingSideCastlingPossible &&
      squares[fromY][fromX + 1].pieceType === null &&
      squares[fromY][fromX + 2].pieceType === null &&
      squares[fromY][fromX + 3].pieceType ===
        (this.isBlack ? PieceType.BlackKingRook : PieceType.WhiteKingRook) &&
      !squares[fromY][fromX].isEnemyAttacked
    ) {
      if (!squares[fromY][fromX + 1].isEnemyAttacked) {
        moves.push([fromY, fromX + 2]);
      }
    }

    return moves;
  }

  public removePossibleCastling(castling: "QUEEN_SIDE" | "KING_SIDE" | "BOTH"): void {
    if (castling === "QUEEN_SIDE" || castling === "BOTH") {
      this.isQueenSideCastlingPossible = false;
    }
    if (castling === "KING_SIDE" || castling === "BOTH") {
      this.isKingSideCastlingPossible = false;
    }
  }
}

export const whiteKing = new King();
export const blackKing = new King(true);
