import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

import { PieceDragType } from "game/piece-type";
import { piecesInitPosition } from "game/constants";

interface BoardState {
  selectedPiece: { dragType: PieceDragType; x: number; y: number };
  history: { squares: (PieceDragType | null)[] }[];
}

interface MovePiecePayload {
  selectedPiece: { dragType: PieceDragType; x: number; y: number };
  toX: number;
  toY: number;
}

const initialState = {
  history: [{ squares: piecesInitPosition }],
} as BoardState;

export const boardSlice = createSlice({
  name: "board",
  initialState,
  reducers: {
    selectPiece: (
      state,
      action: PayloadAction<{ dragType: PieceDragType; x: number; y: number }>
    ) => {
      state.selectedPiece = action.payload;
      console.log(`Selected ${state.selectedPiece.dragType}`);
    },

    movePiece: (state, action: PayloadAction<MovePiecePayload>) => {
      const { selectedPiece, toX, toY } = action.payload;
      const { history } = state;

      const current = history[history.length - 1];
      const src = selectedPiece.x * 8 + selectedPiece.y;
      const dest = toX * 8 + toY;

      const occupiedSquare = current.squares[dest];
      if (occupiedSquare) {
        const isSelectedPieceWhite = selectedPiece.dragType.includes("WHITE");
        const isOccupiedPieceWhite = occupiedSquare.includes("WHITE");
        if (isSelectedPieceWhite === isOccupiedPieceWhite) {
          return;
        }
        console.log(`${selectedPiece.dragType} captured ${occupiedSquare} at ${[toX, toY]}`);
      }

      const newSquares = JSON.parse(JSON.stringify(current.squares));
      newSquares[dest] = selectedPiece.dragType;
      newSquares[src] = null;

      console.log(`${selectedPiece.dragType} moved to ${[toX, toY]}`);

      state.history = [...history, { squares: newSquares }];
    },
  },
});

export const { selectPiece, movePiece } = boardSlice.actions;
