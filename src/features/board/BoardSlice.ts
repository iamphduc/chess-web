import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

import { PieceType } from "game/piece-type";
import { pieceFactory } from "game/piece-factory";
import { HistorySquares } from "game/board-types";
import { FallenPiece, MoveNotation, pieceNotation, SpecialCase } from "game/piece-notation";
import { Position as PiecePosition } from "game/pieces/piece";
import { Pawn } from "game/pieces/pawn";
import { GameState, initialGameState } from "../../game/engine/game-state";
import { applyMove, legalMoves, Position } from "../../game/engine/engine";
import {
  buildMove,
  checkedKingPieceType,
  gameOverFromStatus,
  projectSquares,
  toPromotionKind,
} from "./engineAdapter";
import { PiecePromoted } from "./components/Promotion";
import { GameOverType } from "./components/GameOver";

interface PieceSelection {
  pieceType: PieceType;
  y: number;
  x: number;
}

interface PawnPromotion {
  piecePromoted: PiecePromoted;
}

interface PieceMove {
  to: PiecePosition;
}

/** Endpoints of a pending pawn move awaiting the promotion picker's choice. */
interface PendingPromotion {
  from: [number, number];
  to: [number, number];
}

interface BoardState {
  /**
   * Engine state per ply — `engineHistory[last]` is the current position. Grows
   * one entry per move and is replaced-in-place on promotion, so it stays in
   * lockstep with the UI-facing `history` array (and thus the components'
   * `history.length % 2` turn derivation matches `engine.turn`).
   */
  engineHistory: GameState[];

  history: { squares: HistorySquares }[];
  pieceAttackedKing: PieceType | null;
  selectedPiece: PieceSelection | null;
  possibleMoves: PiecePosition[];
  promotionPosition: PiecePosition;
  pendingPromotion: PendingPromotion | null;
  lastMoves: [PiecePosition, PiecePosition][];

  fallenPieces: FallenPiece[];
  notation: string[];

  gameOver: GameOverType;
  isPlaying: boolean;
}

function createInitialState(): BoardState {
  const engine = initialGameState();
  return {
    engineHistory: [engine],
    history: [{ squares: projectSquares(engine) }],
    pieceAttackedKing: null,
    selectedPiece: null,
    possibleMoves: [],
    promotionPosition: [-1, -1],
    pendingPromotion: null,
    lastMoves: [
      [
        [-1, -1],
        [-1, -1],
      ],
    ], // Fallback for case En Passent
    fallenPieces: [],
    notation: [],
    gameOver: GameOverType.Continue,
    isPlaying: false,
  };
}

const initialState = createInitialState();

export const boardSlice = createSlice({
  name: "board",
  initialState,
  reducers: {
    selectPiece: (state, action: PayloadAction<PieceSelection>) => {
      // Deselect Piece
      if (state.selectedPiece && state.selectedPiece.pieceType === action.payload.pieceType) {
        console.log(`Deselected ${state.selectedPiece.pieceType}`);
        state.selectedPiece = null;
        state.possibleMoves = [];
        return;
      }

      // Select Piece
      state.selectedPiece = action.payload;
      console.log(`Selected ${state.selectedPiece.pieceType}`);

      const { y, x } = action.payload;
      const engine = state.engineHistory[state.engineHistory.length - 1];

      // Legal destinations come straight from the engine (king-safety filtered).
      const moves = legalMoves(engine, [y, x]);
      state.possibleMoves = moves.map((move) => [move.to[0], move.to[1]]);
    },

    movePiece: (state, action: PayloadAction<PieceMove>) => {
      const { selectedPiece, fallenPieces } = state;
      if (!selectedPiece) return;

      const {
        to: [toY, toX],
      } = action.payload;
      const { pieceType, y: fromY, x: fromX } = selectedPiece;

      const engine = state.engineHistory[state.engineHistory.length - 1];
      const projected = state.history[state.history.length - 1].squares;
      const piece = pieceFactory.getPiece(pieceType);

      const from: Position = [fromY, fromX];
      const to: Position = [toY, toX];

      // --- Geometry classification (mirrors the engine's applyMove inference) ---
      const isPawn = piece instanceof Pawn;
      const isCastle = pieceType === PieceType.WhiteKing || pieceType === PieceType.BlackKing
        ? Math.abs(toX - fromX) === 2
        : false;
      const destOccupied = engine.squares[toY][toX] !== null;
      const isEnPassant = isPawn && toX !== fromX && !destOccupied;
      const isCapture = destOccupied || isEnPassant;
      const isPromotion = isPawn && (toY === 0 || toY === 7);

      // --- lastMoves highlight (reducer-side presentation, unchanged source) ---
      state.lastMoves = [
        ...state.lastMoves,
        [
          [fromY, fromX],
          [toY, toX],
        ],
      ];

      // --- Notation (reducer-side presentation, unchanged source) ---
      // Disambiguation + fallen pieces are computed from the PRE-move board.
      const abbreviationSuffix = pieceNotation.getSuffixAbbreviation(
        projected,
        piece,
        [fromY, fromX],
        [toY, toX]
      );
      let newNotation: MoveNotation = {
        abbreviation: piece.getAbbreviation() + abbreviationSuffix,
        position: [toY, toX],
      };

      if (isCastle) {
        newNotation.abbreviation =
          toX - fromX === 2 ? SpecialCase.KingSideCastling : SpecialCase.QueenSideCastling;
      } else if (isEnPassant) {
        // The captured pawn sits beside the destination, on the mover's rank.
        const capturedPieceType = projected[fromY][toX].pieceType;
        if (capturedPieceType) {
          pieceNotation.addFallenPiece(fallenPieces, capturedPieceType);
        }
        newNotation = {
          abbreviation: String.fromCharCode(fromX + 97) + SpecialCase.Capture,
          position: [toY, toX],
        };
      } else if (isCapture) {
        const capturedPieceType = projected[toY][toX].pieceType;
        if (capturedPieceType) {
          pieceNotation.addFallenPiece(fallenPieces, capturedPieceType);
        }
        // Pawn captures are written with the origin file letter.
        if (isPawn) {
          newNotation.abbreviation = String.fromCharCode(fromX + 97);
        }
        newNotation.abbreviation += SpecialCase.Capture;
      }

      // --- Apply on the engine and refresh the projected position ---
      // A promotion is applied here too (the pawn visibly lands on the last rank,
      // as a pawn), so `history` grows one entry per ply and the picker overlays
      // the moved pawn. `promotePawn` then replaces this ply IN PLACE (re-issuing
      // the move from the pre-move engine state with the chosen kind), mirroring
      // the legacy in-place history replacement and keeping turn parity intact.
      const next = applyMove(engine, buildMove(from, to));
      state.engineHistory = [
        ...(state.engineHistory as GameState[]),
        next,
      ] as typeof state.engineHistory;
      state.history = [...state.history, { squares: projectSquares(next) }];
      console.log(`Moved ${pieceType} from ${[fromY, fromX]} to ${[toY, toX]}`);

      let newNotationString = pieceNotation.toAlgebraicNotationString(newNotation);

      if (isPromotion) {
        // Stop: wait for the picker. The check/game-over suffix and the engine's
        // promoted id are resolved in promotePawn once the kind is chosen.
        state.promotionPosition = [toY, toX];
        state.pendingPromotion = {
          from: [fromY, fromX],
          to: [toY, toX],
        };
        state.notation = [...state.notation, newNotationString];
        state.selectedPiece = null;
        state.possibleMoves = [];
        return;
      }

      newNotationString = appendCheckSuffix(next, newNotationString, state);
      state.notation = [...state.notation, newNotationString];
      state.selectedPiece = null;
      state.possibleMoves = [];
    },

    promotePawn: (state, action: PayloadAction<PawnPromotion>) => {
      const { pendingPromotion } = state;
      if (!pendingPromotion) return;

      const { piecePromoted } = action.payload;
      const { from, to } = pendingPromotion;

      // Re-issue the pawn move WITH the chosen promotion kind from the PRE-move
      // engine state (the entry before the deferred-promotion ply pushed in
      // movePiece), then replace that ply in place — no new push, turn unchanged.
      const last = state.engineHistory.length - 1;
      const preEngine = state.engineHistory[last - 1] as GameState;
      const next = applyMove(preEngine, buildMove(from, to, toPromotionKind(piecePromoted)));

      (state.engineHistory as GameState[])[last] = next;
      state.history[state.history.length - 1] = { squares: projectSquares(next) };

      // The promoted id now sits on `to`.
      const promotedId = next.squares[to[0]][to[1]];

      // --- Notation: finish the move started in movePiece (=Q, then +/#). ---
      let latest = state.notation[state.notation.length - 1];
      if (promotedId) {
        latest += "=" + pieceFactory.getPiece(promotedId).getAbbreviation();
      }
      latest = appendCheckSuffix(next, latest, state);
      state.notation[state.notation.length - 1] = latest;

      state.promotionPosition = [-1, -1];
      state.pendingPromotion = null;
      state.selectedPiece = null;
      state.possibleMoves = [];
    },

    start: (state) => {
      state.isPlaying = true;
    },

    stop: (state) => {
      state.isPlaying = false;
      state.gameOver = GameOverType.Win;
    },

    reset: () => {
      return createInitialState();
    },
  },
});

/**
 * Refresh `pieceAttackedKing` / `gameOver` from the engine and append the
 * check/checkmate suffix to a notation string. Mutates `state` (the check
 * highlight + game-over verdict) and returns the suffixed notation.
 */
function appendCheckSuffix(
  next: GameState,
  notationString: string,
  state: BoardState
): string {
  const checkedKing = checkedKingPieceType(next);
  const gameOver = gameOverFromStatus(next);
  state.gameOver = gameOver;
  state.pieceAttackedKing = checkedKing;

  if (gameOver === GameOverType.Win) {
    return notationString + SpecialCase.Checkmate;
  }
  if (checkedKing !== null) {
    return notationString + SpecialCase.Check;
  }
  return notationString;
}

export const { selectPiece, movePiece, promotePawn, start, stop, reset } = boardSlice.actions;
