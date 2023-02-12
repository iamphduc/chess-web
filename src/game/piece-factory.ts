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
      case PieceType.WhiteRookPromoted1:
      case PieceType.WhiteRookPromoted2:
      case PieceType.WhiteRookPromoted3:
      case PieceType.WhiteRookPromoted4:
        return whiteRook;

      case PieceType.BlackQueenRook:
      case PieceType.BlackKingRook:
      case PieceType.BlackRookPromoted1:
      case PieceType.BlackRookPromoted2:
      case PieceType.BlackRookPromoted3:
      case PieceType.BlackRookPromoted4:
        return blackRook;

      case PieceType.WhiteQueenKnight:
      case PieceType.WhiteKingKnight:
      case PieceType.WhiteKnightPromoted1:
      case PieceType.WhiteKnightPromoted2:
      case PieceType.WhiteKnightPromoted3:
      case PieceType.WhiteKnightPromoted4:
        return whiteKnight;

      case PieceType.BlackQueenKnight:
      case PieceType.BlackKingKnight:
      case PieceType.BlackKnightPromoted1:
      case PieceType.BlackKnightPromoted2:
      case PieceType.BlackKnightPromoted3:
      case PieceType.BlackKnightPromoted4:
        return blackKnight;

      case PieceType.WhiteQueenBishop:
      case PieceType.WhiteKingBishop:
      case PieceType.WhiteBishopPromoted1:
      case PieceType.WhiteBishopPromoted2:
      case PieceType.WhiteBishopPromoted3:
      case PieceType.WhiteBishopPromoted4:
        return whiteBishop;

      case PieceType.BlackQueenBishop:
      case PieceType.BlackKingBishop:
      case PieceType.BlackBishopPromoted1:
      case PieceType.BlackBishopPromoted2:
      case PieceType.BlackBishopPromoted3:
      case PieceType.BlackBishopPromoted4:
        return blackBishop;

      case PieceType.WhiteQueen:
      case PieceType.WhiteQueenPromoted1:
      case PieceType.WhiteQueenPromoted2:
      case PieceType.WhiteQueenPromoted3:
      case PieceType.WhiteQueenPromoted4:
        return whiteQueen;

      case PieceType.BlackQueen:
      case PieceType.BlackQueenPromoted1:
      case PieceType.BlackQueenPromoted2:
      case PieceType.BlackQueenPromoted3:
      case PieceType.BlackQueenPromoted4:
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
