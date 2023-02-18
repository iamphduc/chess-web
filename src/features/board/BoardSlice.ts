import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

import { initialSquares } from "../../constants";
import { PieceType } from "game/piece-type";
import { pieceFactory } from "game/piece-factory";
import { HistorySquares, pieceMoves } from "game/piece-moves";
import { FallenPiece, MoveNotation, pieceNotation, SpecialCase } from "game/piece-notation";
import { Position } from "game/pieces/piece";
import { blackKing, King, whiteKing } from "game/pieces/king";
import { blackPawn, Pawn, whitePawn } from "game/pieces/pawn";
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
  to: Position;
}

interface BoardState {
  history: { squares: HistorySquares }[];
  pieceAttackedKing: PieceType | null;
  selectedPiece: PieceSelection | null;
  possibleMoves: Position[];
  promotionPosition: Position;
  lastMoves: [Position, Position][];

  fallenPieces: FallenPiece[];
  notation: string[];

  gameOver: GameOverType;
  isPlaying: boolean;
}

const initialState = {
  history: [{ squares: initialSquares }],
  pieceAttackedKing: null,
  selectedPiece: null,
  possibleMoves: [],
  promotionPosition: [-1, -1],
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
} as BoardState;

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

      const { pieceType, y, x } = action.payload;
      const { history } = state;

      const current = history[history.length - 1];
      const isWhiteTurn = history.length % 2 === 1;
      const piece = pieceFactory.getPiece(pieceType);

      // Get valid moves
      const possibleMoves = piece.getPossibleMoves([y, x], current.squares);
      let validMoves: Position[] = [];
      possibleMoves.forEach(([toY, toX]) => {
        if (toY >= 0 && toY < 8 && toX >= 0 && toY < 8) {
          const newSquares = JSON.parse(JSON.stringify(current.squares));

          pieceMoves.updatePiecePosition(newSquares, pieceType, [y, x], [toY, toX]);
          const calculatedSquares = pieceMoves.calculateEnemyAttack(newSquares, !isWhiteTurn);

          let [kingY, kingX] = pieceMoves.getKingPosition(isWhiteTurn);
          if (piece instanceof King) {
            [kingY, kingX] = [toY, toX];
          }

          if (calculatedSquares[kingY][kingX].isEnemyAttacked) return;

          validMoves.push([toY, toX]);
        }
      });

      state.possibleMoves = validMoves;
    },

    movePiece: (state, action: PayloadAction<PieceMove>) => {
      const { history, selectedPiece, fallenPieces } = state;

      if (!selectedPiece) return;

      const {
        to: [toY, toX],
      } = action.payload;
      const { pieceType, y: fromY, x: fromX } = selectedPiece;

      const current = history[history.length - 1];
      const isWhiteTurn = history.length % 2 === 1;
      const newSquares: HistorySquares = JSON.parse(JSON.stringify(current.squares));
      const piece = pieceFactory.getPiece(selectedPiece.pieceType);

      // Update last move
      state.lastMoves = [
        ...state.lastMoves,
        [
          [fromY, fromX],
          [toY, toX],
        ],
      ];

      // Move Notation
      const abbreviationSuffix = pieceNotation.getSuffixAbbreviation(
        newSquares,
        piece,
        [fromY, fromX],
        [toY, toX]
      );
      let newNotation: MoveNotation = {
        abbreviation: piece.getAbbreviation() + abbreviationSuffix,
        position: [toY, toX],
      };

      // Update fallen pieces
      const capturedPiece = newSquares[toY][toX].pieceType;
      pieceMoves.updatePiecePosition(newSquares, pieceType, [fromY, fromX], [toY, toX]);
      if (capturedPiece) {
        pieceNotation.addFallenPiece(fallenPieces, capturedPiece);
        // Write the name of the file (row) when pawn captures a piece
        if (piece instanceof Pawn) {
          newNotation.abbreviation = String.fromCharCode(fromX + 97);
        }
        newNotation.abbreviation += SpecialCase.Capture;
      }

      // Castling moves
      switch (selectedPiece.pieceType) {
        case PieceType.WhiteKing: {
          // White King side castling
          if (toX - fromX === 2) {
            pieceMoves.updatePiecePosition(
              newSquares,
              PieceType.WhiteKingRook,
              [fromY, fromX + 3],
              [toY, toX - 1]
            );
            newNotation.abbreviation = SpecialCase.KingSideCastling;
          }
          // White Queen side castling
          if (fromX - toX === 2) {
            pieceMoves.updatePiecePosition(
              newSquares,
              PieceType.WhiteQueenRook,
              [fromY, fromX - 4],
              [toY, toX + 1]
            );
            newNotation.abbreviation = SpecialCase.QueenSideCastling;
          }
          whiteKing.removePossibleCastling("BOTH");
          pieceMoves.setWhiteKingPosition([toY, toX]);
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
          // Black King side castling
          if (toX - fromX === 2) {
            pieceMoves.updatePiecePosition(
              newSquares,
              PieceType.BlackKingRook,
              [fromY, fromX + 3],
              [toY, toX - 1]
            );
            newNotation.abbreviation = SpecialCase.KingSideCastling;
          }
          // Black Queen side castling
          if (fromX - toX === 2) {
            pieceMoves.updatePiecePosition(
              newSquares,
              PieceType.BlackQueenRook,
              [fromY, fromX - 4],
              [toY, toX + 1]
            );
            newNotation.abbreviation = SpecialCase.QueenSideCastling;
          }
          blackKing.removePossibleCastling("BOTH");
          pieceMoves.setBlackKingPosition([toY, toX]);
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

      // En Passant
      if (piece instanceof Pawn) {
        // Pawn promotion
        if (toY === 0 || toY === 7) {
          state.promotionPosition = [toY, toX];
        }

        // Pawn en passant
        if (Math.abs(fromX - toX) === 1) {
          const oursPawn = isWhiteTurn ? whitePawn : blackPawn;
          const [enPassantY, enPassantX] = oursPawn.getEnPassantPosition();

          if (enPassantY !== -1 && enPassantX !== -1 && toY === enPassantY) {
            const directionYBasedOnColor = !isWhiteTurn ? 1 : -1;
            const capturedEnPassant =
              newSquares[enPassantY - directionYBasedOnColor][enPassantX].pieceType;
            if (capturedEnPassant) {
              newSquares[enPassantY - directionYBasedOnColor][enPassantX] = {
                pieceType: null,
                isEnemyAttacked: false,
              };

              pieceNotation.addFallenPiece(fallenPieces, capturedEnPassant);
              newNotation = {
                abbreviation: String.fromCharCode(fromX + 97) + SpecialCase.Capture,
                position: [enPassantY, enPassantX],
              };
            }
          }
        }

        // Pawn moves 2 rows forward
        const enemyPawn = isWhiteTurn ? blackPawn : whitePawn;
        if (Math.abs(fromY - toY) === 2) {
          enemyPawn.setEnPassantPosition([toY, toX]);
        } else {
          enemyPawn.setEnPassantPosition([-1, -1]);
        }
      } else {
        whitePawn.setEnPassantPosition([-1, -1]);
        blackPawn.setEnPassantPosition([-1, -1]);
      }

      // Update history
      const calculatedSquares = pieceMoves.calculateEnemyAttack(newSquares, isWhiteTurn);
      state.history = [...history, { squares: calculatedSquares }];
      console.log(`Moved ${pieceType} from ${[fromY, fromX]} to ${[toY, toX]}`);

      let newNotationString = pieceNotation.toAlgebraicNotationString(newNotation);

      // Stalemate
      const isStalemate = pieceMoves.isStalemate(calculatedSquares, isWhiteTurn);
      if (isStalemate) {
        state.gameOver = GameOverType.Draw;
      }

      // Check
      const [kingY, kingX] = pieceMoves.getKingPosition(!isWhiteTurn);
      if (calculatedSquares[kingY][kingX].isEnemyAttacked) {
        state.pieceAttackedKing = selectedPiece.pieceType;
        if (isStalemate) {
          newNotationString += SpecialCase.Checkmate;
          state.gameOver = GameOverType.Win;
        } else {
          newNotationString += SpecialCase.Check;
        }
      } else {
        state.pieceAttackedKing = null;
      }

      state.notation = [...state.notation, newNotationString];
      state.possibleMoves = [];
    },

    promotePawn: (state, action: PayloadAction<PawnPromotion>) => {
      const { history, promotionPosition } = state;
      const { piecePromoted } = action.payload;

      const current = history[history.length - 1];
      const isWhiteTurn = history.length % 2 === 1;
      const reversedTurn = !isWhiteTurn; // Turn has been changed after moving piece so reverse it

      const pieceAfter = pieceMoves.promotePawn(
        current.squares,
        piecePromoted,
        promotionPosition,
        reversedTurn
      );

      // Update history
      const calculatedSquares = pieceMoves.calculateEnemyAttack(current.squares, reversedTurn);
      state.history[history.length - 1] = { squares: calculatedSquares };

      // Update notation
      const piece = pieceFactory.getPiece(pieceAfter);
      let lastestNotation = state.notation[state.notation.length - 1];
      lastestNotation += "=" + piece.getAbbreviation();

      // Stalemate
      const isStalemate = pieceMoves.isStalemate(calculatedSquares, reversedTurn);

      // Check
      const [kingY, kingX] = pieceMoves.getKingPosition(!reversedTurn);
      if (calculatedSquares[kingY][kingX].isEnemyAttacked) {
        state.pieceAttackedKing = pieceAfter;
        if (isStalemate) {
          lastestNotation += isStalemate ? SpecialCase.Checkmate : SpecialCase.Check;
          state.gameOver = GameOverType.Win;
        } else {
          lastestNotation += isStalemate ? SpecialCase.Checkmate : SpecialCase.Check;
        }
      } else {
        state.pieceAttackedKing = null;
      }

      state.promotionPosition = [-1, -1];
      state.notation[state.notation.length - 1] = lastestNotation;
    },

    start: (state) => {
      state.isPlaying = true;
    },

    stop: (state) => {
      state.isPlaying = false;
      state.gameOver = GameOverType.Win;
    },

    reset: () => {
      return initialState;
    },
  },
});

export const { selectPiece, movePiece, promotePawn, start, stop, reset } = boardSlice.actions;
