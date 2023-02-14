import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

import { initialSquares } from "../../constants";
import { PieceType } from "game/piece-type";
import { pieceFactory } from "game/piece-factory";
import { HistorySquares, pieceMoves } from "game/piece-moves";
import { Piece, Position } from "game/pieces/piece";
import { blackKing, King, whiteKing } from "game/pieces/king";
import { blackPawn, Pawn, whitePawn } from "game/pieces/pawn";
import { PiecePromoted } from "./components/Promotion";
import { SpecialCase } from "./components/Notation";

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
  isWhiteTurn: boolean;
  pieceAttackedKing: PieceType | null;
  selectedPiece: PieceSelection | null;
  possibleMoves: Position[];

  whiteFallenPieces: { pieceType: PieceType; weight: number }[];
  blackFallenPieces: { pieceType: PieceType; weight: number }[];
  lastMove: [Position, Position];
  promotionPosition: Position;
  whiteNotation: { abbreviation: string; position: Position; specialCase: SpecialCase }[];
  blackNotation: { abbreviation: string; position: Position; specialCase: SpecialCase }[];
}

const initialState = {
  history: [{ squares: initialSquares }],
  isWhiteTurn: true,
  pieceAttackedKing: null,
  selectedPiece: null,
  possibleMoves: [],

  whiteFallenPieces: [],
  blackFallenPieces: [],
  lastMove: [
    [-1, -1],
    [-1, -1],
  ],
  promotionPosition: [-1, -1],
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
      const notation = isWhiteTurn ? state.whiteNotation : state.blackNotation;
      notation.push({
        abbreviation: piece.getAbbreviation(),
        position: [toY, toX],
        specialCase: SpecialCase.None,
      });

      // Update fallen pieces
      const capturedPiece = newSquares[toY][toX].pieceType;
      pieceMoves.updatePiecePosition(newSquares, pieceType, [fromY, fromX], [toY, toX]);
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
            pieceMoves.updatePiecePosition(
              newSquares,
              PieceType.WhiteKingRook,
              [fromY, fromX + 3],
              [toY, toX - 1]
            );
            notation[notation.length - 1].specialCase = SpecialCase.KingSideCastling;
          }
          // White Queen side castling
          if (fromX - toX === 2) {
            pieceMoves.updatePiecePosition(
              newSquares,
              PieceType.WhiteQueenRook,
              [fromY, fromX - 4],
              [toY, toX + 1]
            );
            notation[notation.length - 1].specialCase = SpecialCase.QueenSideCastling;
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
            notation[notation.length - 1].specialCase = SpecialCase.KingSideCastling;
          }
          // Black Queen side castling
          if (fromX - toX === 2) {
            pieceMoves.updatePiecePosition(
              newSquares,
              PieceType.BlackQueenRook,
              [fromY, fromX - 4],
              [toY, toX + 1]
            );
            notation[notation.length - 1].specialCase = SpecialCase.QueenSideCastling;
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
              if (isWhiteTurn) {
                addFallenPiece(blackFallenPieces, capturedEnPassant);
              } else {
                addFallenPiece(whiteFallenPieces, capturedEnPassant);
              }
              notation[notation.length - 1] = {
                abbreviation: String.fromCharCode(fromX + 97),
                position: [enPassantY, enPassantX],
                specialCase: SpecialCase.Capture,
              };
              newSquares[enPassantY - directionYBasedOnColor][enPassantX] = {
                pieceType: null,
                isEnemyAttacked: false,
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

      // Check
      const [kingY, kingX] = pieceMoves.getKingPosition(!isWhiteTurn);
      if (calculatedSquares[kingY][kingX].isEnemyAttacked) {
        console.log("CHECKED");
        state.pieceAttackedKing = selectedPiece.pieceType;

        const isCheckmate = pieceMoves.isCheckmate(calculatedSquares, !isWhiteTurn);
        console.log("CHECKMATE:", isCheckmate);

        notation[notation.length - 1].specialCase = isCheckmate
          ? SpecialCase.Checkmate
          : SpecialCase.Check;
      } else {
        state.pieceAttackedKing = null;
      }

      if (state.promotionPosition[0] === -1 && state.promotionPosition[1] === -1) {
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
      const { history, isWhiteTurn, promotionPosition } = state;
      const { piecePromoted } = action.payload;

      const current = history[history.length - 1];

      const pieceAfter = pieceMoves.promotePawn(
        current.squares,
        piecePromoted,
        promotionPosition,
        isWhiteTurn
      );

      // Update history
      const calculatedSquares = pieceMoves.calculateEnemyAttack(current.squares, isWhiteTurn);
      state.history[history.length - 1] = { squares: calculatedSquares };

      // Check
      const [kingY, kingX] = pieceMoves.getKingPosition(!isWhiteTurn);
      if (calculatedSquares[kingY][kingX].isEnemyAttacked) {
        console.log("CHECKED");
        state.pieceAttackedKing = pieceAfter;
        const isCheckmate = pieceMoves.isCheckmate(calculatedSquares, !isWhiteTurn);
        console.log("CHECKMATE:", isCheckmate);
      } else {
        state.pieceAttackedKing = null;
      }

      state.promotionPosition = [-1, -1];
      state.isWhiteTurn = !state.isWhiteTurn;
    },
  },
});

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
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const pieceType = squares[y][x].pieceType;
      if (pieceType) {
        const piece = pieceFactory.getPiece(pieceType);
        if (
          // Same type
          pieceToCheck.constructor.name === piece.constructor.name &&
          // Same color
          piece.isWhitePiece() === isWhiteTurn &&
          // Different postion
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
