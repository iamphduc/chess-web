import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

import { calculateControlledSquares, HistorySquares } from "game/piece-controllers";
import { PieceType } from "game/piece-type";
import { pieceFactory } from "game/piece-factory";
import { Position } from "game/pieces/piece";
import { blackKing, King, whiteKing } from "game/pieces/king";
import { initialSquares } from "game/constants";

export interface SelectedPiece {
  pieceType: PieceType;
  y: number;
  x: number;
}

interface BoardState {
  history: { squares: HistorySquares }[];
  isWhiteTurn: boolean;
  selectedPiece: SelectedPiece | null;
  possibleMoves: Position[];
  blackKingPosition: Position;
  whiteKingPosition: Position;
}

interface MovePiecePayload {
  to: Position;
}

const initialState = {
  history: [{ squares: initialSquares }],
  isWhiteTurn: true,
  selectedPiece: null,
  possibleMoves: [],
  blackKingPosition: [0, 4],
  whiteKingPosition: [7, 4],
} as BoardState;

export const boardSlice = createSlice({
  name: "board",
  initialState,
  reducers: {
    selectPiece: (state, action: PayloadAction<SelectedPiece>) => {
      state.selectedPiece = action.payload;
      console.log(`Selected ${state.selectedPiece.pieceType}`);

      const { pieceType, y, x } = action.payload;
      const { history, isWhiteTurn, whiteKingPosition, blackKingPosition } = state;

      const current = history[history.length - 1];
      const piece = pieceFactory.getPiece(pieceType);

      const possibleMoves = piece.getPossibleMoves([y, x], current.squares);

      let validMoves: Position[] = [];
      for (const [toY, toX] of possibleMoves) {
        const newSquares = JSON.parse(JSON.stringify(current.squares));

        movePieceToSquare(newSquares, pieceType, [y, x], [toY, toX]);
        const calculatedSquares = calculateControlledSquares(newSquares);

        let [kingY, kingX] = isWhiteTurn ? whiteKingPosition : blackKingPosition;
        if (piece instanceof King) {
          [kingY, kingX] = [toY, toX];
        }

        const { controllers } = calculatedSquares[kingY][kingX];
        const enemyColor = isWhiteTurn ? "BLACK" : "WHITE";
        if (controllers.some((pieceType: PieceType) => pieceType.includes(enemyColor))) continue;

        validMoves.push([toY, toX]);
      }

      state.possibleMoves = validMoves;
    },

    movePiece: (state, action: PayloadAction<MovePiecePayload>) => {
      const { history, selectedPiece } = state;

      if (!selectedPiece) return;

      const {
        to: [toY, toX],
      } = action.payload;
      const { pieceType, y: fromY, x: fromX } = selectedPiece;

      // Appends new squares to history
      const current = history[history.length - 1];
      const newSquares = JSON.parse(JSON.stringify(current.squares));

      movePieceToSquare(newSquares, pieceType, [fromY, fromX], [toY, toX]);

      // Castling Moves
      switch (selectedPiece.pieceType) {
        case PieceType.WhiteKing: {
          if (toX - fromX === 2) {
            movePieceToSquare(
              newSquares,
              PieceType.WhiteKingRook,
              [fromY, fromX + 3],
              [toY, toX - 1]
            );
          }
          if (fromX - toX === 2) {
            movePieceToSquare(
              newSquares,
              PieceType.WhiteQueenRook,
              [fromY, fromX - 4],
              [toY, toX + 1]
            );
          }
          whiteKing.removePossibleCastling("BOTH");
          state.whiteKingPosition = [toY, toX];
          break;
        }
        case PieceType.WhiteKingRook: {
          whiteKing.removePossibleCastling("KING_SIDE");
          break;
        }
        case PieceType.WhiteQueenRook: {
          whiteKing.removePossibleCastling("QUEEN_SIDE");
          break;
        }

        case PieceType.BlackKing: {
          if (toX - fromX === 2) {
            movePieceToSquare(
              newSquares,
              PieceType.BlackKingRook,
              [fromY, fromX + 3],
              [toY, toX - 1]
            );
          }
          if (fromX - toX === 2) {
            movePieceToSquare(
              newSquares,
              PieceType.BlackQueenRook,
              [fromY, fromX - 4],
              [toY, toX + 1]
            );
          }
          blackKing.removePossibleCastling("BOTH");
          state.blackKingPosition = [toY, toX];
          break;
        }
        case PieceType.BlackKingRook: {
          blackKing.removePossibleCastling("KING_SIDE");
          break;
        }
        case PieceType.BlackQueenRook: {
          blackKing.removePossibleCastling("QUEEN_SIDE");
          break;
        }
      }

      console.log(`Moved ${pieceType} from ${[fromY, fromX]} to ${[toY, toX]}`);

      state.history = [...history, { squares: calculateControlledSquares(newSquares) }];
      state.possibleMoves = [];
      state.isWhiteTurn = !state.isWhiteTurn;
    },
  },
});

const movePieceToSquare = (
  squares: HistorySquares,
  pieceType: PieceType,
  [fromY, fromX]: Position,
  [toY, toX]: Position
): void => {
  squares[toY][toX] = { pieceType, controllers: [] };
  squares[fromY][fromX] = { pieceType: null, controllers: [] };
};

export const { selectPiece, movePiece } = boardSlice.actions;
