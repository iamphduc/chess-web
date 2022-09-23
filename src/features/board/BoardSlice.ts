import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

import { initialSquares, HistorySquares } from "game/constants";
import { PieceDragType } from "game/piece-type";
import { pieceFactory } from "game/piece-factory";
import { Position } from "game/pieces/piece";

export interface SelectedPiece {
  dragType: PieceDragType;
  y: number;
  x: number;
}

interface Move {
  from: Position;
  to: Position;
  isACheck: boolean;
  capture?: PieceDragType;
  castling?: "KING_SIDE" | "QUEEN_SIDE";
}

interface BoardState {
  history: { squares: HistorySquares }[];
  selectedPiece: SelectedPiece | null;
  possibleMoves: number[];
  moves: Move[];
}

interface MovePiecePayload {
  toY: number;
  toX: number;
}

const initialState = {
  history: [{ squares: initialSquares }],
  selectedPiece: null,
  possibleMoves: [-1],
} as BoardState;

export const boardSlice = createSlice({
  name: "board",
  initialState,
  reducers: {
    selectPiece: (state, action: PayloadAction<SelectedPiece>) => {
      state.selectedPiece = action.payload;
      console.log(`Selected ${state.selectedPiece.dragType}`);

      const { dragType, y, x } = action.payload;
      const { history } = state;

      const current = history[history.length - 1];
      const possibleMoves = pieceFactory
        .getPiece(dragType)
        .getPossibleMoves(dragType, [y, x], current.squares);

      state.possibleMoves = possibleMoves;
    },

    movePiece: (state, action: PayloadAction<MovePiecePayload>) => {
      const { history, selectedPiece } = state;

      if (!selectedPiece) return;

      const { toY, toX } = action.payload;

      const current = history[history.length - 1];
      const newSquares = JSON.parse(JSON.stringify(current.squares));
      newSquares[toY][toX] = selectedPiece.dragType;
      newSquares[selectedPiece.y][selectedPiece.x] = null;

      console.log(`${selectedPiece.dragType} moved to ${[toY, toX]}`);

      state.history = [...history, { squares: newSquares }];
      state.possibleMoves = [-1];
    },
  },
});

export const { selectPiece, movePiece } = boardSlice.actions;
