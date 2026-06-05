import { pieceFactory } from "./piece-factory";
import { HistorySquares } from "./board-types";
import { PieceType } from "./piece-type";
import { Pawn } from "./pieces/pawn";
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
            // Not a Pawn
            piece instanceof Pawn &&
            // Same color
            piece.isWhitePiece() === isWhite &&
            // Different position
            (y !== fromY || x !== fromX)
          ) {
            // Pawn capture-disambiguation: the other same-colour pawn at [y, x]
            // could also capture onto [toY, toX] when that square is one rank
            // ahead (colour-relative) and one file to the side. Computed inline
            // now that the legacy `Pawn.getPossibleMoves` move generator is gone
            // (the engine owns legality; this is presentation-only notation).
            const dir = piece.isWhitePiece() ? -1 : 1;
            const canCaptureTarget = toY === y + dir && Math.abs(toX - x) === 1;
            if (canCaptureTarget) {
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

    return "";
  }

  public toAlgebraicNotationString(moveNotation: MoveNotation): string {
    const {
      abbreviation,
      position: [y, x],
    } = moveNotation;
    if (
      abbreviation === SpecialCase.KingSideCastling ||
      abbreviation === SpecialCase.QueenSideCastling
    ) {
      return abbreviation;
    }
    return abbreviation + String.fromCharCode(x + 97) + (8 - y);
  }
}

export const pieceNotation = new PieceNotation();
