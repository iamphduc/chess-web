import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

import { initialSquares, piecePromotedBoard } from "../../constants";
import { calculateAttack, HistorySquares } from "game/calculate-attack";
import { PieceType } from "game/piece-type";
import { pieceFactory } from "game/piece-factory";
import { Piece, Position } from "game/pieces/piece";
import { blackKing, King, whiteKing } from "game/pieces/king";
import { Pawn } from "game/pieces/pawn";
import { calculateCheckmate } from "game/calculate-checkmate";
import { PiecePromoted } from "./components/Promotion";
import { SpecialCase } from "./components/Notation";

interface PieceSelection {
  pieceType: PieceType;
  y: number;
  x: number;
}

interface PawnPromotion {
  y: number;
  x: number;
  piecePromoted: PiecePromoted;
}

interface PieceMove {
  to: Position;
}

interface BoardState {
  history: { squares: HistorySquares }[];
  isWhiteTurn: boolean;
  pieceAttackedKing: PieceType | null;
  selectedPiece: PieceSelection | null;
  possibleMoves: Position[];
  blackKingPosition: Position;
  whiteKingPosition: Position;
  enPassantPosition: Position;
  whiteFallenPieces: { pieceType: PieceType; weight: number }[];
  blackFallenPieces: { pieceType: PieceType; weight: number }[];
  lastMove: [Position, Position];
  promotionPosition: Position;
  piecePromotedCount: number[];
  whiteNotation: { abbreviation: string; position: Position; specialCase: SpecialCase }[];
  blackNotation: { abbreviation: string; position: Position; specialCase: SpecialCase }[];
}

const initialState = {
  history: [{ squares: initialSquares }],
  isWhiteTurn: true,
  pieceAttackedKing: null,
  selectedPiece: null,
  possibleMoves: [],
  blackKingPosition: [0, 4],
  whiteKingPosition: [7, 4],
  enPassantPosition: [-1, -1],
  whiteFallenPieces: [],
  blackFallenPieces: [],
  lastMove: [
    [-1, -1],
    [-1, -1],
  ],
  promotionPosition: [-1, -1],
  piecePromotedCount: [0, 0, 0, 0, 0, 0, 0, 0], // [WQueen, WRook, WBishop, WKnight, BQueen, ...]
  whiteNotation: [],
  blackNotation: [],
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
      const { history, isWhiteTurn } = state;

      const current = history[history.length - 1];
      const piece = pieceFactory.getPiece(pieceType);

      // Get valid moves
      const possibleMoves = piece.getPossibleMoves([y, x], current.squares);
      let validMoves: Position[] = [];
      possibleMoves.forEach(([toY, toX]) => {
        if (toY >= 0 && toY < 8 && toX >= 0 && toY < 8) {
          const newSquares = JSON.parse(JSON.stringify(current.squares));

          updateSquares(newSquares, pieceType, [y, x], [toY, toX]);
          const calculatedSquares = calculateAttack(newSquares, !isWhiteTurn);

          let [kingY, kingX] = isWhiteTurn ? state.whiteKingPosition : state.blackKingPosition;
          if (piece instanceof King) {
            [kingY, kingX] = [toY, toX];
          }

          if (calculatedSquares[kingY][kingX].isEnemyAttacked) return;

          validMoves.push([toY, toX]);
        }
      });

      // Check En Passant
      if (piece instanceof Pawn) {
        const [toY, toX] = state.enPassantPosition;
        const directionYBasedOnColor = isWhiteTurn ? -1 : 1;
        const fromY = toY;

        const directionX = [-1, 1];
        directionX.forEach((direction) => {
          const fromX = toX + direction;
          if (fromX < 0 || fromX >= 8) return;
          if (y !== fromY || x !== fromX) return;
          validMoves.push([toY + directionYBasedOnColor, toX]);
        });
      }

      state.possibleMoves = validMoves;
    },

    movePiece: (state, action: PayloadAction<PieceMove>) => {
      const { history, selectedPiece, isWhiteTurn, whiteFallenPieces, blackFallenPieces } = state;

      if (!selectedPiece) return;

      const {
        to: [toY, toX],
      } = action.payload;
      const { pieceType, y: fromY, x: fromX } = selectedPiece;

      const current = history[history.length - 1];
      const newSquares: HistorySquares = JSON.parse(JSON.stringify(current.squares));
      const piece = pieceFactory.getPiece(selectedPiece.pieceType);

      // Update last move
      state.lastMove = [
        [fromY, fromX],
        [toY, toX],
      ];

      // Update Notation
      const destination: Position = [toY, toX];
      const addedNotation = {
        abbreviation: piece.getAbbreviation(),
        position: destination,
        specialCase: SpecialCase.None,
      };
      let notation = null;
      if (isWhiteTurn) {
        state.whiteNotation.push(addedNotation);
        notation = state.whiteNotation;
      } else {
        state.blackNotation.push(addedNotation);
        notation = state.blackNotation;
      }

      // Update fallen pieces
      const capturedPiece = updateSquares(newSquares, pieceType, [fromY, fromX], [toY, toX]);
      if (capturedPiece) {
        if (isWhiteTurn) {
          addFallenPiece(blackFallenPieces, capturedPiece);
        } else {
          addFallenPiece(whiteFallenPieces, capturedPiece);
        }
        notation[notation.length - 1].specialCase = SpecialCase.Capture;
        if (piece instanceof Pawn) {
          notation[notation.length - 1].abbreviation = String.fromCharCode(fromX + 97);
        }
      }

      // Castling moves
      switch (selectedPiece.pieceType) {
        case PieceType.WhiteKing: {
          // White King side castling
          if (toX - fromX === 2) {
            updateSquares(newSquares, PieceType.WhiteKingRook, [fromY, fromX + 3], [toY, toX - 1]);
            notation[notation.length - 1].specialCase = SpecialCase.KingSideCastling;
          }
          // White Queen side castling
          if (fromX - toX === 2) {
            updateSquares(newSquares, PieceType.WhiteQueenRook, [fromY, fromX - 4], [toY, toX + 1]);
            notation[notation.length - 1].specialCase = SpecialCase.QueenSideCastling;
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
          // Black King side castling
          if (toX - fromX === 2) {
            updateSquares(newSquares, PieceType.BlackKingRook, [fromY, fromX + 3], [toY, toX - 1]);
            notation[notation.length - 1].specialCase = SpecialCase.KingSideCastling;
          }
          // Black Queen side castling
          if (fromX - toX === 2) {
            updateSquares(newSquares, PieceType.BlackQueenRook, [fromY, fromX - 4], [toY, toX + 1]);
            notation[notation.length - 1].specialCase = SpecialCase.QueenSideCastling;
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

      // En Passant
      if (piece instanceof Pawn) {
        // Pawn promotion
        if (toY === 0 || toY === 7) {
          state.promotionPosition = [toY, toX];
        }
        // En Passant capture
        if (Math.abs(fromX - toX) === 1) {
          const [enPassantY, enPassantX] = state.enPassantPosition;
          const directionYBasedOnColor = isWhiteTurn ? -1 : 1;
          if (enPassantY >= 0 && enPassantX >= 0 && toY === enPassantY + directionYBasedOnColor) {
            const capturedEnPassant = newSquares[enPassantY][enPassantX].pieceType;
            if (capturedEnPassant) {
              if (isWhiteTurn) {
                addFallenPiece(blackFallenPieces, capturedEnPassant);
              } else {
                addFallenPiece(whiteFallenPieces, capturedEnPassant);
              }
              notation[notation.length - 1] = {
                abbreviation: String.fromCharCode(fromX + 97),
                position: state.enPassantPosition,
                specialCase: SpecialCase.Capture,
              };
            }
            newSquares[enPassantY][enPassantX] = { pieceType: null, isEnemyAttacked: false };
          }
        }
        // Pawn moves 2 rows forward
        if (Math.abs(fromY - toY) === 2) {
          // En Passant position is updated if we move another Pawn
          state.enPassantPosition = [toY, toX];
          console.log("En Passant:", state.enPassantPosition);
        } else {
          state.enPassantPosition = [-1, -1];
        }
      } else {
        state.enPassantPosition = [-1, -1];
      }

      // Update history
      const calculatedSquares = calculateAttack(newSquares, isWhiteTurn);
      state.history = [...history, { squares: calculatedSquares }];
      console.log(`Moved ${pieceType} from ${[fromY, fromX]} to ${[toY, toX]}`);

      // Check
      const [kingY, kingX] = !isWhiteTurn ? state.whiteKingPosition : state.blackKingPosition;
      if (calculatedSquares[kingY][kingX].isEnemyAttacked) {
        console.log("CHECKED");
        state.pieceAttackedKing = selectedPiece.pieceType;

        const isCheckmate = calculateCheckmate(calculatedSquares, !isWhiteTurn, [kingY, kingX]);
        console.log("CHECKMATE:", isCheckmate);

        notation[notation.length - 1].specialCase = isCheckmate
          ? SpecialCase.Checkmate
          : SpecialCase.Check;
      } else {
        state.pieceAttackedKing = null;
      }

      if (state.promotionPosition[0] === -1) {
        state.isWhiteTurn = !state.isWhiteTurn;
      }
      notation[notation.length - 1].abbreviation += checkIfPieceMoveSameSquare(
        current.squares,
        piece,
        [fromY, fromX],
        [toY, toX],
        isWhiteTurn
      );
      state.possibleMoves = [];
    },

    promotePawn: (state, action: PayloadAction<PawnPromotion>) => {
      const { history, isWhiteTurn, piecePromotedCount } = state;
      const { y, x, piecePromoted } = action.payload;

      const current = history[history.length - 1];
      const selectedPiece: PieceSelection = { pieceType: PieceType.WhiteQueenPromoted1, y, x };

      let piecePromotedIdx = 0;
      switch (piecePromoted) {
        case PiecePromoted.Queen: {
          piecePromotedIdx = isWhiteTurn ? 0 : 4;
          break;
        }
        case PiecePromoted.Rook: {
          piecePromotedIdx = isWhiteTurn ? 1 : 5;
          break;
        }
        case PiecePromoted.Bishop: {
          piecePromotedIdx = isWhiteTurn ? 2 : 6;
          break;
        }
        case PiecePromoted.Knight: {
          piecePromotedIdx = isWhiteTurn ? 3 : 7;
          break;
        }
      }
      // Get the promoted piece from board
      const chosenPiece = piecePromotedBoard[piecePromotedIdx];
      const nthPiece = piecePromotedCount[piecePromotedIdx];
      current.squares[y][x].pieceType = chosenPiece[nthPiece];
      selectedPiece.pieceType = chosenPiece[nthPiece];
      state.piecePromotedCount[piecePromotedIdx] += 1;

      // Update history
      const calculatedSquares = calculateAttack(current.squares, isWhiteTurn);
      state.history[history.length - 1] = { squares: calculatedSquares };

      // Check
      const [kingY, kingX] = !isWhiteTurn ? state.whiteKingPosition : state.blackKingPosition;
      if (calculatedSquares[kingY][kingX].isEnemyAttacked) {
        console.log("CHECKED");
        state.pieceAttackedKing = selectedPiece.pieceType;
        const isCheckmate = calculateCheckmate(calculatedSquares, !isWhiteTurn, [kingY, kingX]);
        console.log("CHECKMATE:", isCheckmate);
      } else {
        state.pieceAttackedKing = null;
      }

      state.promotionPosition = [-1, -1];
      state.isWhiteTurn = !state.isWhiteTurn;
    },
  },
});

export const updateSquares = (
  squares: HistorySquares,
  pieceType: PieceType,
  [fromY, fromX]: Position,
  [toY, toX]: Position
): PieceType | null => {
  const { pieceType: currentPiece } = squares[toY][toX];
  squares[toY][toX] = { pieceType, isEnemyAttacked: false };
  squares[fromY][fromX] = { pieceType: null, isEnemyAttacked: false };
  return currentPiece;
};

const addFallenPiece = (
  fallenPieces: { pieceType: PieceType; weight: number }[],
  pieceType: PieceType
): void => {
  const piece = pieceFactory.getPiece(pieceType);
  const weight = piece.getWeight();
  fallenPieces.push({ pieceType, weight });
  fallenPieces.sort((pieceA, pieceB) => pieceB.weight - pieceA.weight);
};

const checkIfPieceMoveSameSquare = (
  squares: HistorySquares,
  pieceToCheck: Piece,
  [fromY, fromX]: Position,
  [toY, toX]: Position,
  isWhiteTurn: boolean
): string => {
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const pieceType = squares[y][x].pieceType;
      if (pieceType) {
        const piece = pieceFactory.getPiece(pieceType);

        if (
          pieceToCheck.constructor.name === piece.constructor.name &&
          piece.isWhitePiece() === isWhiteTurn &&
          (y !== fromY || x !== fromX)
        ) {
          const possibleMoves = piece.getPossibleMoves([y, x], squares);
          for (const moves of possibleMoves) {
            if (moves[0] === toY && moves[1] === toX) {
              if (fromX === x) return 8 - fromY + "";
              return String.fromCharCode(fromX + 97);
            }
          }
        }
      }
    }
  }
  return "";
};

export const { selectPiece, movePiece, promotePawn } = boardSlice.actions;
