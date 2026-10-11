import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

import { PieceType } from "game/piece-type";
import { pieceFactory } from "game/piece-factory";
import { HistorySquares } from "game/board-types";
import { FallenPiece, MoveNotation, pieceNotation, SpecialCase } from "game/piece-notation";
import { Position as PiecePosition } from "game/pieces/piece";
import { Pawn } from "game/pieces/pawn";
import { GameState, initialGameState, PieceColor } from "../../game/engine/game-state";
import { applyMove, legalMoves, Move, Position } from "../../game/engine/engine";
import { PromotionKind } from "../../game/engine/moves/promotion";
import { colorOf } from "../../game/engine/moves/classify";
import {
  buildMove,
  checkedKingPieceType,
  gameOverFromStatus,
  projectSquares,
  toPromotionKind,
} from "./engineAdapter";
import { PiecePromoted } from "./components/Promotion";
import { GameOverType } from "./components/GameOver";
import { isWhiteClockTurn } from "./clock";
import { MoveSound, pickSound } from "./sound";

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

/** A board square, in board coordinates (White's view). */
interface SquareClick {
  y: number;
  x: number;
}

/** Endpoints of a pending pawn move awaiting the promotion picker's choice. */
interface PendingPromotion {
  from: [number, number];
  to: [number, number];
}

/** His move for one ply of one game. Stale or illegal ones are ignored. */
export interface OpponentMove {
  gameId: number;
  /** Plies played when he chose: `engineHistory.length - 1`. */
  ply: number;
  move: Move;
}

interface NewGame {
  /** The side the human plays, or `null` for two players. */
  humanColor: PieceColor | null;
}

interface BoardState {
  /** 0 at load, +1 on every `reset` and `newGame`. The clocks restart when it changes. */
  gameId: number;
  /** The side the human plays against Liem; `null` is a two-player game. */
  humanColor: PieceColor | null;

  /**
   * Engine state per ply — `engineHistory[last]` is the current position. Grows
   * one entry per move and is replaced-in-place on promotion, so it stays in
   * lockstep with the UI-facing `history` array (and thus the components'
   * `history.length % 2` turn derivation matches `engine.turn`). The clocks
   * also read `pendingPromotion`: the mover's clock runs until the piece is picked.
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
  /** Set when a flag falls; kept if a pending promotion is finished afterwards. */
  flagFallWinner: "White" | "Black" | null;
  isPlaying: boolean;
  /** The last completed ply's sound: a new object per ply, `null` before the first. */
  moveSound: MoveSound | null;
}

function createInitialState(): BoardState {
  const engine = initialGameState();
  return {
    gameId: 0,
    humanColor: null,
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
    flagFallWinner: null,
    isPlaying: false,
    moveSound: null,
  };
}

const initialState = createInitialState();

/**
 * Play the selected piece to `dest`, as `movePiece` and a click on a legal square
 * both do: notation, fallen pieces, the last-move highlight and the promotion step.
 */
function playMove(state: BoardState, dest: PiecePosition): void {
  const { selectedPiece } = state;
  if (!selectedPiece || inputLocked(state)) return;
  playPly(state, [selectedPiece.y, selectedPiece.x], [dest[0], dest[1]]);
}

/**
 * Play `from` → `to` for the side to move: notation, fallen pieces, the last-move
 * highlight, check, game over and the sound. A pawn reaching the last rank with
 * no `promotion` stops for the picker (a human move). With one, the ply completes.
 */
function playPly(state: BoardState, from: Position, to: Position, promotion?: PromotionKind): void {
  const { fallenPieces } = state;
  const [fromY, fromX] = from;
  const [toY, toX] = to;

  const engine = state.engineHistory[state.engineHistory.length - 1];
  const projected = state.history[state.history.length - 1].squares;
  const pieceType = engine.squares[fromY][fromX] as PieceType;
  const piece = pieceFactory.getPiece(pieceType);

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
  const abbreviationSuffix = pieceNotation.getSuffixAbbreviation(engine, from, to);
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
  const next = applyMove(engine, buildMove(from, to, promotion));
  state.engineHistory = [
    ...(state.engineHistory as GameState[]),
    next,
  ] as typeof state.engineHistory;
  state.history = [...state.history, { squares: projectSquares(next) }];
  console.log(`Moved ${pieceType} from ${[fromY, fromX]} to ${[toY, toX]}`);

  let newNotationString = pieceNotation.toAlgebraicNotationString(newNotation);

  if (isPromotion && promotion === undefined) {
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

  if (isPromotion) {
    // The kind is already chosen, so the ply completes now (=Q, then +/#).
    const promotedId = next.squares[toY][toX];
    if (promotedId) {
      newNotationString += "=" + pieceFactory.getPiece(promotedId).getAbbreviation();
    }
  }
  newNotationString = appendCheckSuffix(next, newNotationString, state);
  state.notation = [...state.notation, newNotationString];
  state.selectedPiece = null;
  state.possibleMoves = [];
  // A promotion sounds the same as a human's pick in promotePawn.
  state.moveSound = isPromotion
    ? plySound(next, { promotion: true, castle: false, capture: false })
    : plySound(next, { promotion: false, castle: isCastle, capture: isCapture });
}

/** A new sound object for a completed ply, from the position it leaves. */
function plySound(
  next: GameState,
  move: { promotion: boolean; castle: boolean; capture: boolean }
): MoveSound {
  const kind = pickSound({
    ...move,
    gameEnd: gameOverFromStatus(next) !== GameOverType.Continue,
    check: checkedKingPieceType(next) !== null,
  });
  return { kind };
}

/** True when `[y, x]` holds a piece of the side to move. */
function isMoversPiece(state: BoardState, y: number, x: number): boolean {
  const piece = currentEngine(state).squares[y]?.[x] ?? null;
  return piece !== null && colorOf(piece) === currentEngine(state).turn;
}

function currentEngine(state: BoardState): GameState {
  return state.engineHistory[state.engineHistory.length - 1];
}

/** Make the piece on `[y, x]` the selection, with its legal moves from the engine. */
function select(state: BoardState, y: number, x: number): void {
  const pieceType = currentEngine(state).squares[y][x] as PieceType;
  state.selectedPiece = { pieceType, y, x };
  console.log(`Selected ${pieceType}`);
  state.possibleMoves = legalMoves(currentEngine(state), [y, x]).map((move) => [
    move.to[0],
    move.to[1],
  ]);
}

function clearSelection(state: BoardState): void {
  if (state.selectedPiece === null && state.possibleMoves.length === 0) return;
  state.selectedPiece = null;
  state.possibleMoves = [];
}

/** True when the human plays Liem and the side to move is his. */
function isHisTurn(state: BoardState): boolean {
  return state.humanColor !== null && currentEngine(state).turn !== state.humanColor;
}

/**
 * No human input once the game is over, while the promotion picker is open, or on
 * his turn in a vs-Liem game. `promotePawn` doesn't check it: the human's own pick
 * comes after the turn has flipped.
 */
function inputLocked(state: BoardState): boolean {
  return (
    state.gameOver !== GameOverType.Continue || state.pendingPromotion !== null || isHisTurn(state)
  );
}

/** His move is played only for the current game and ply, on his turn, when it's legal. */
function acceptsOpponentMove(state: BoardState, { gameId, ply, move }: OpponentMove): boolean {
  if (gameId !== state.gameId || ply !== state.engineHistory.length - 1) return false;
  if (!isHisTurn(state)) return false;
  if (state.gameOver !== GameOverType.Continue || state.pendingPromotion !== null) return false;
  const [toY, toX] = move.to;
  return legalMoves(currentEngine(state), move.from).some(
    (m) => m.to[0] === toY && m.to[1] === toX && m.promotion === move.promotion
  );
}


export const boardSlice = createSlice({
  name: "board",
  initialState,
  reducers: {
    selectPiece: (state, action: PayloadAction<PieceSelection>) => {
      // No piece moves once the game is over (checkmate, stalemate, flag fall),
      // while the mover is still choosing a promotion piece, or on his turn.
      if (inputLocked(state)) return;

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
      playMove(state, action.payload.to);
    },

    /** A click (or tap) on board square `[y, x]`: select, deselect, reselect or move. */
    clickSquare: (state, action: PayloadAction<SquareClick>) => {
      if (inputLocked(state)) return;
      const { y, x } = action.payload;

      const { selectedPiece } = state;
      if (selectedPiece && state.possibleMoves.some(([py, px]) => py === y && px === x)) {
        playMove(state, [y, x]);
        return;
      }

      if (isMoversPiece(state, y, x)) {
        if (selectedPiece && selectedPiece.y === y && selectedPiece.x === x) {
          console.log(`Deselected ${selectedPiece.pieceType}`);
          clearSelection(state);
        } else {
          select(state, y, x);
        }
        return;
      }

      clearSelection(state);
    },

    /** Drag start on `[y, x]`: select a piece of the side to move, never toggle. */
    pickUp: (state, action: PayloadAction<SquareClick>) => {
      if (inputLocked(state)) return;
      const { y, x } = action.payload;
      if (isMoversPiece(state, y, x)) {
        const { selectedPiece } = state;
        if (!selectedPiece || selectedPiece.y !== y || selectedPiece.x !== x) select(state, y, x);
        return;
      }
      clearSelection(state);
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
      // A flag that fell while the picker was open keeps its result: the pawn
      // still becomes the chosen piece, but the game stays over.
      const resultBefore = state.gameOver;
      latest = appendCheckSuffix(next, latest, state);
      if (resultBefore !== GameOverType.Continue) {
        state.gameOver = resultBefore;
      }
      state.notation[state.notation.length - 1] = latest;
      // The ply is complete only now, so its sound comes from the picked piece's position.
      state.moveSound = plySound(next, { promotion: true, castle: false, capture: false });

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
      // A flag fall ends a game still in progress as a win for the other side;
      // a checkmate or stalemate result already set by the move is kept.
      if (state.gameOver === GameOverType.Continue) {
        state.gameOver = GameOverType.Win;
        // The side whose clock was running lost on time.
        const whiteFlagged = isWhiteClockTurn(state.history.length, state.pendingPromotion !== null);
        state.flagFallWinner = whiteFlagged ? "Black" : "White";
      }
      // Drop a piece still held, so no move hints stay on the board.
      state.selectedPiece = null;
      state.possibleMoves = [];
    },

    /** His move, as one complete ply (a promotion included). */
    playOpponentMove: (state, action: PayloadAction<OpponentMove>) => {
      if (!acceptsOpponentMove(state, action.payload)) return;
      const { from, to, promotion } = action.payload.move;
      playPly(state, from, to, promotion);
    },

    reset: (state) => {
      return { ...createInitialState(), gameId: state.gameId + 1 };
    },

    /** A fresh game whose clocks start at once. The human plays `humanColor`. */
    newGame: (state, action: PayloadAction<NewGame>) => {
      return {
        ...createInitialState(),
        gameId: state.gameId + 1,
        humanColor: action.payload.humanColor,
        isPlaying: true,
      };
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

export const {
  selectPiece,
  movePiece,
  clickSquare,
  pickUp,
  promotePawn,
  start,
  stop,
  reset,
  newGame,
  playOpponentMove,
} = boardSlice.actions;
