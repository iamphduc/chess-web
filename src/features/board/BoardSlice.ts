import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

import { initialSquares, HistorySquares } from "game/constants";
import { PieceType } from "game/piece-type";
import { pieceFactory } from "game/piece-factory";
import { Position } from "game/pieces/piece";

export interface SelectedPiece {
  type: PieceType;
  y: number;
  x: number;
}

interface Move {
  from: Position;
  to: Position;
  isACheck: boolean;
  capture?: PieceType;
  castling?: "KING_SIDE" | "QUEEN_SIDE";
}

interface BoardState {
  history: { squares: HistorySquares }[];
  isWhiteTurn: boolean;
  selectedPiece: SelectedPiece | null;
  possibleMoves: number[];
  moves: Move[];
}

interface MovePiecePayload {
  to: Position;
}

const initialState = {
  history: [{ squares: initialSquares }],
  isWhiteTurn: true,
  selectedPiece: null,
  possibleMoves: [-1],
} as BoardState;

export const boardSlice = createSlice({
  name: "board",
  initialState,
  reducers: {
    selectPiece: (state, action: PayloadAction<SelectedPiece>) => {
      state.selectedPiece = action.payload;
      console.log(`Selected ${state.selectedPiece.type}`);

      const { type, y, x } = action.payload;
      const { history } = state;

      const current = history[history.length - 1];
      const possibleMoves = pieceFactory
        .getPiece(type)
        .getPossibleMoves(type, [y, x], current.squares);

      state.possibleMoves = possibleMoves;
    },

    movePiece: (state, action: PayloadAction<MovePiecePayload>) => {
      const { history, selectedPiece } = state;

      if (!selectedPiece) return;

      const {
        to: [toY, toX],
      } = action.payload;

      const current = history[history.length - 1];
      const newSquares = JSON.parse(JSON.stringify(current.squares));
      newSquares[toY][toX] = selectedPiece.type;
      newSquares[selectedPiece.y][selectedPiece.x] = null;

      console.log(`${selectedPiece.type} moved to ${[toY, toX]}`);

      state.history = [...history, { squares: newSquares }];
      state.possibleMoves = [-1];
      state.isWhiteTurn = !state.isWhiteTurn;
    },
  },
});

export const { selectPiece, movePiece } = boardSlice.actions;
