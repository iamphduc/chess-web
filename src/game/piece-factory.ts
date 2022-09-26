import { PieceType } from "game/piece-type";
import { Piece } from "./pieces/piece";
import { blackKing, whiteKing } from "./pieces/king";
import { blackQueen, whiteQueen } from "./pieces/queen";
import { blackBishop, whiteBishop } from "./pieces/bishop";
import { blackKnight, whiteKnight } from "./pieces/knight";
import { blackRook, whiteRook } from "./pieces/rook";
import { blackPawn, whitePawn } from "./pieces/pawn";

export class PieceFactory {
  public getPiece(type: PieceType): Piece {
    switch (type) {
      case PieceType.WhiteQueenRook:
      case PieceType.WhiteKingRook:
        return whiteRook;

      case PieceType.BlackQueenRook:
      case PieceType.BlackKingRook:
        return blackRook;

      case PieceType.WhiteQueenKnight:
      case PieceType.WhiteKingKnight:
        return whiteKnight;

      case PieceType.BlackQueenKnight:
      case PieceType.BlackKingKnight:
        return blackKnight;

      case PieceType.WhiteQueenBishop:
      case PieceType.WhiteKingBishop:
        return whiteBishop;

      case PieceType.BlackQueenBishop:
      case PieceType.BlackKingBishop:
        return blackBishop;

      case PieceType.WhiteQueen:
        return whiteQueen;

      case PieceType.BlackQueen:
        return blackQueen;

      case PieceType.WhiteKing:
        return whiteKing;

      case PieceType.BlackKing:
        return blackKing;

      default:
        return type.includes("BLACK") ? blackPawn : whitePawn;
    }
  }
}

export const pieceFactory = new PieceFactory();
