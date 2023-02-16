import { PromotionBoard } from "../constants";
import { PiecePromoted } from "features/board/components/Promotion";
import { pieceFactory } from "./piece-factory";
import { PieceType } from "./piece-type";
import { King } from "./pieces/king";
import { Pawn } from "./pieces/pawn";
import { Position } from "./pieces/piece";

export interface Square {
  pieceType: PieceType | null;
  isEnemyAttacked: boolean;
}

export type HistorySquares = Square[][];

export class PieceMoves {
  private blackKingPosition: Position;
  private whiteKingPosition: Position;
  private promotionBoardCount: number[];

  constructor() {
    this.blackKingPosition = [0, 4];
    this.whiteKingPosition = [7, 4];
    this.promotionBoardCount = [0, 0, 0, 0, 0, 0, 0, 0];
  }

  public setBlackKingPosition(position: Position) {
    this.blackKingPosition = position;
  }

  public setWhiteKingPosition(position: Position) {
    this.whiteKingPosition = position;
  }

  public getKingPosition(isWhiteTurn: boolean) {
    return isWhiteTurn ? this.whiteKingPosition : this.blackKingPosition;
  }

  public calculateEnemyAttack(squares: HistorySquares, isWhiteTurn: boolean): HistorySquares {
    // Complexity:
    // - Time: O(64 * N), N is the number of moves that enemy pieces can make
    // - Space: O(64)

    const dummySquares: Square[][] = [...new Array(8)].map(() =>
      [...new Array(8)].map(() => ({
        pieceType: null,
        isEnemyAttacked: false,
      }))
    );

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const { pieceType } = squares[y][x];
        if (!pieceType) continue;

        dummySquares[y][x].pieceType = pieceType;

        const piece = pieceFactory.getPiece(pieceType);
        if (isWhiteTurn !== piece.isWhitePiece()) continue;

        let attackedSquares: Position[] = [];
        if (piece instanceof Pawn) {
          attackedSquares = piece.getAttackedSquares([y, x], squares);
        } else {
          attackedSquares = piece.getPossibleMoves([y, x], squares);
        }

        for (const [toY, toX] of attackedSquares) {
          if (toY >= 0 && toY < 8 && toX >= 0 && toY < 8) {
            dummySquares[toY][toX].isEnemyAttacked = true;
          }
        }
      }
    }

    return dummySquares;
  }

  public isStalemate(squares: HistorySquares, isWhiteTurn: boolean): boolean {
    // Complexity:
    // - Time: O(64 * N), N is the number of moves that ours pieces can make
    // - Space: O(1)

    const isOpponentTurn = !isWhiteTurn;
    const kingPosition = isOpponentTurn ? this.whiteKingPosition : this.blackKingPosition;

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const { pieceType } = squares[y][x];
        if (!pieceType) continue;

        const piece = pieceFactory.getPiece(pieceType);
        if (isOpponentTurn !== piece.isWhitePiece()) continue;

        let [currentKingY, currentKingX] = kingPosition;
        const possibleMoves = piece.getPossibleMoves([y, x], squares);
        for (const [toY, toX] of possibleMoves) {
          if (toY >= 0 && toY < 8 && toX >= 0 && toY < 8) {
            const newSquares = JSON.parse(JSON.stringify(squares));

            this.updatePiecePosition(newSquares, pieceType, [y, x], [toY, toX]);
            const calculatedSquares = this.calculateEnemyAttack(newSquares, isWhiteTurn);

            if (piece instanceof King) {
              [currentKingY, currentKingX] = [toY, toX];
            }

            if (!calculatedSquares[currentKingY][currentKingX].isEnemyAttacked) {
              return false;
            }
          }
        }
      }
    }

    return true;
  }

  public updatePiecePosition(
    squares: HistorySquares,
    pieceType: PieceType,
    [fromY, fromX]: Position,
    [toY, toX]: Position
  ): void {
    squares[fromY][fromX] = { pieceType: null, isEnemyAttacked: false };
    squares[toY][toX] = { pieceType, isEnemyAttacked: false };
  }

  public promotePawn(
    squares: HistorySquares,
    piecePromoted: PiecePromoted,
    promotionPosition: Position,
    isWhiteTurn: boolean
  ): PieceType {
    const [y, x] = promotionPosition;

    const getPromotedIdx = () => {
      switch (piecePromoted) {
        case PiecePromoted.Queen:
          return 0;
        case PiecePromoted.Rook:
          return 1;
        case PiecePromoted.Bishop:
          return 2;
        case PiecePromoted.Knight:
          return 3;
      }
    };

    const offset = isWhiteTurn ? 0 : 4;
    const promotedIdx = getPromotedIdx() + offset;
    const chosenPieceType = PromotionBoard[promotedIdx];
    const nthChosen = this.promotionBoardCount[promotedIdx];
    const pieceAfter = chosenPieceType[nthChosen];

    squares[y][x].pieceType = pieceAfter;
    this.promotionBoardCount[promotedIdx] += 1;

    return pieceAfter;
  }
}

export const pieceMoves = new PieceMoves();
