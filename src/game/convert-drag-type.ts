import { PieceDragType, PieceType } from "game/piece-type";

export const convertDragType = (dragType: PieceDragType | null) => {
  const isBlack = dragType?.includes("BLACK");

  switch (dragType) {
    case PieceDragType.WhiteQueenRook:
    case PieceDragType.WhiteKingRook:
    case PieceDragType.BlackQueenRook:
    case PieceDragType.BlackKingRook:
      return { isBlack, type: PieceType.Rook };

    case PieceDragType.WhiteQueenKnight:
    case PieceDragType.WhiteKingKnight:
    case PieceDragType.BlackQueenKnight:
    case PieceDragType.BlackKingKnight:
      return { isBlack, type: PieceType.Knight };

    case PieceDragType.WhiteQueenBishop:
    case PieceDragType.WhiteKingBishop:
    case PieceDragType.BlackQueenBishop:
    case PieceDragType.BlackKingBishop:
      return { isBlack, type: PieceType.Bishop };

    case PieceDragType.WhiteQueen:
    case PieceDragType.BlackQueen:
      return { isBlack, type: PieceType.Queen };

    case PieceDragType.WhiteKing:
    case PieceDragType.BlackKing:
      return { isBlack, type: PieceType.King };

    default:
      return { isBlack, type: PieceType.Pawn };
  }
};
