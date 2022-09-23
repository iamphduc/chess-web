import { convertDragType } from "game/convert-drag-type";
import { PieceDragType, PieceType } from "game/piece-type";
import { king } from "./pieces/king";
import { queen } from "./pieces/queen";
import { bishop } from "./pieces/bishop";
import { knight } from "./pieces/knight";
import { rook } from "./pieces/rook";
import { blackPawn, whitePawn } from "./pieces/pawn";

export class PieceFactory {
  public getPiece(dragType: PieceDragType) {
    const { type, isBlack } = convertDragType(dragType);
    switch (type) {
      case PieceType.Rook:
        return rook;
      case PieceType.Knight:
        return knight;
      case PieceType.Bishop:
        return bishop;
      case PieceType.Queen:
        return queen;
      case PieceType.King:
        return king;
      case PieceType.Pawn:
        return isBlack ? blackPawn : whitePawn;
    }
  }
}

export const pieceFactory = new PieceFactory();
