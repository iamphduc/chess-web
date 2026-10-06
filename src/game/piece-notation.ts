import { pieceFactory } from "./piece-factory";
import { PieceType } from "./piece-type";
import { Position } from "./pieces/piece";
import { GameState } from "./engine/game-state";
import { legalMoves, Position as EnginePosition } from "./engine/engine";
import { colorOf, pieceKind } from "./engine/moves/classify";

export enum SpecialCase {
  None = "",
  Capture = "x",
  // PGN/SAN writes castling with the capital letter O, not the digit zero.
  QueenSideCastling = "O-O-O",
  KingSideCastling = "O-O",
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

  /**
   * SAN disambiguation: when another piece of the same kind and colour can also
   * LEGALLY move to `to`, return what tells the mover apart — its origin file if
   * no rival shares that file, else its origin rank if no rival shares that
   * rank, else both (e.g. `Qh4e1`). Returns `""` when no rival can reach `to`.
   *
   * Rivals come from the engine's `legalMoves`, so a pinned or blocked piece
   * never forces a suffix. Kings never need one (one per side). Pawn captures
   * are written with their origin file by the caller, which overwrites this.
   *
   * `state` is the PRE-move position with the mover's side to move.
   */
  public getSuffixAbbreviation(
    state: GameState,
    [fromY, fromX]: EnginePosition,
    [toY, toX]: EnginePosition
  ): string {
    const mover = state.squares[fromY]?.[fromX];
    if (!mover) return "";
    const kind = pieceKind(mover);
    const color = colorOf(mover);

    const rivals: EnginePosition[] = [];
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const piece = state.squares[y][x];
        if (
          piece === null ||
          (y === fromY && x === fromX) ||
          pieceKind(piece) !== kind ||
          colorOf(piece) !== color
        ) {
          continue;
        }
        const reaches = legalMoves(state, [y, x]).some(
          ({ to: [y2, x2] }) => y2 === toY && x2 === toX
        );
        if (reaches) rivals.push([y, x]);
      }
    }

    if (rivals.length === 0) return "";
    const file = String.fromCharCode(fromX + 97);
    const rank = String(8 - fromY);
    if (rivals.every(([, x]) => x !== fromX)) return file;
    if (rivals.every(([y]) => y !== fromY)) return rank;
    return file + rank;
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
