import { pieceFactory } from "./piece-factory";
import { HistorySquares } from "./piece-moves";
import { PieceType } from "./piece-type";
import { Piece, Position } from "./pieces/piece";

export enum SpecialCase {
  None = "",
  Capture = "x",
  QueenSideCastling = "0-0-0",
  KingSideCastling = "0-0",
  Check = "+",
  Checkmate = "#",
}

export interface FallenPiece {
  pieceType: PieceType;
  weight: number;
  isWhite: boolean;
}

export interface MoveNotation {
  abbreviation: string;
  position: Position;
  specialCase: SpecialCase;
}

export class PieceNotation {
  public addFallenPiece(fallenPieces: FallenPiece[], pieceType: PieceType): void {
    const piece = pieceFactory.getPiece(pieceType);
    const weight = piece.getWeight();
    const isWhite = piece.isWhitePiece();
    fallenPieces.push({ pieceType, weight, isWhite });
    fallenPieces.sort((pieceA, pieceB) => pieceB.weight - pieceA.weight);
  }

  public getSuffixAbbreviation(
    squares: HistorySquares,
    pieceToCheck: Piece,
    [fromY, fromX]: Position,
    [toY, toX]: Position
  ): string {
    // Finally, a few special cases for algebraic notation: In some positions, two of the same
    // piece (such as two knights) can be moved to the same square. In this case, you still write
    // the piece abbreviation, but you then add the file (row) that the piece is on before you
    // write the square.
    // - chess.com

    // Complexity:
    // - Time: O(64 * N), N is the number of moves of the same piece type
    // - Space: O(1)

    const isWhite = pieceToCheck.isWhitePiece();

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const pieceType = squares[y][x].pieceType;
        if (pieceType) {
          const piece = pieceFactory.getPiece(pieceType);
          if (
            // Same type
            pieceToCheck.constructor.name === piece.constructor.name &&
            // Same color
            piece.isWhitePiece() === isWhite &&
            // Different position
            (y !== fromY || x !== fromX)
          ) {
            const possibleMoves = piece.getPossibleMoves([y, x], squares);
            for (const moves of possibleMoves) {
              if (moves[0] === toY && moves[1] === toX) {
                // If two pieces can move to the same file (row)
                if (fromX === x) {
                  return 8 - fromY + "";
                }
                return String.fromCharCode(fromX + 97);
              }
            }
          }
        }
      }
    }

    return "";
  }

  public toAlgebraicNotationString(moveNotation: MoveNotation): string {
    const {
      abbreviation,
      position: [y, x],
      specialCase,
    } = moveNotation;

    const position = String.fromCharCode(x + 97) + (8 - y);

    switch (specialCase) {
      case SpecialCase.QueenSideCastling:
      case SpecialCase.KingSideCastling:
        return specialCase;

      case SpecialCase.None:
      case SpecialCase.Check:
      case SpecialCase.Checkmate:
        return abbreviation + position + specialCase;

      default:
        return abbreviation + specialCase + position;
    }
  }
}

export const pieceNotation = new PieceNotation();
