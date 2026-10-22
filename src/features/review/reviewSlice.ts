import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { newGame, reset } from "features/board/BoardSlice";
import type { GameState } from "game/engine/game-state";
import type { PositionEval } from "game/review/types";

export type MomentStatus = "trying" | "checking" | "wrong" | "check-failed" | "found" | "revealed" | "skipped";
export type ReviewStatus = "idle" | "analysing" | "done" | "failed";

export interface ReviewState {
  open: boolean;
  /** The board's `gameId` this review belongs to; `null` before any review. */
  gameId: number | null;
  status: ReviewStatus;
  /** One per position of the game, `null` until analysed. */
  evals: (PositionEval | null)[];
  /** A position index, `0..evals.length - 1`. */
  cursor: number;
  /** Key moments opened so far, by ply. */
  moments: Record<number, MomentStatus>;
  active: number | null;
  sheetOpen: boolean;
}

const initialState: ReviewState = {
  open: false,
  gameId: null,
  status: "idle",
  evals: [],
  cursor: 0,
  moments: {},
  active: null,
  sheetOpen: false,
};

const DONE: readonly MomentStatus[] = ["found", "revealed", "skipped"];
/** While the active moment is in one of these, the cursor stays on it. */
const LOCKED: readonly MomentStatus[] = ["trying", "checking", "wrong", "check-failed"];
/** Show answer and Skip apply from these. */
const OPEN_FOR_ANSWER: readonly MomentStatus[] = ["trying", "wrong", "check-failed"];

export function isMomentDone(status: MomentStatus): boolean {
  return DONE.includes(status);
}

/** The plies of moments already opened, ascending: `buildReview`'s `locked`. */
export function lockedPlies(state: ReviewState): number[] {
  return Object.keys(state.moments)
    .map(Number)
    .sort((a, b) => a - b);
}

function lastIndex(state: ReviewState): number {
  return Math.max(0, state.evals.length - 1);
}

function isWhole(n: number): boolean {
  return Number.isInteger(n);
}

function cursorLocked(state: ReviewState): boolean {
  if (state.active === null) return false;
  const status = state.moments[state.active];
  return status !== undefined && LOCKED.includes(status);
}

function moveCursor(state: ReviewState, to: number): void {
  if (!isWhole(to) || cursorLocked(state)) return;
  state.cursor = Math.min(lastIndex(state), Math.max(0, to));
}

/** Moves the active moment from `from` to `to`; anything else is ignored. */
function transition(state: ReviewState, ply: number, from: readonly MomentStatus[], to: MomentStatus): void {
  if (state.active !== ply) return;
  const status = state.moments[ply];
  if (status === undefined || !from.includes(status)) return;
  state.moments[ply] = to;
}

function forThisGame(state: ReviewState, gameId: number): boolean {
  return state.gameId !== null && state.gameId === gameId;
}

export const reviewSlice = createSlice({
  name: "review",
  initialState,
  reducers: {
    /**
     * A new game (or the same id with another length) starts fresh with the cursor on the
     * last position. The same game only reopens, resuming a stopped pass.
     */
    reviewOpened: (state, action: PayloadAction<{ gameId: number; positions: readonly GameState[] }>) => {
      const { gameId, positions } = action.payload;
      if (positions.length === 0) return;
      if (state.gameId === gameId && state.evals.length === positions.length) {
        state.open = true;
        if (state.status === "analysing" || state.status === "done") {
          state.status = state.evals.some((e) => e === null) ? "analysing" : "done";
        }
        return;
      }
      return {
        ...initialState,
        open: true,
        gameId,
        status: "analysing",
        evals: positions.map(() => null),
        cursor: positions.length - 1,
        sheetOpen: true,
      };
    },
    reviewClosed: (state) => {
      state.open = false;
    },
    evalReceived: (state, action: PayloadAction<{ gameId: number; index: number; eval: PositionEval }>) => {
      const { gameId, index } = action.payload;
      if (!forThisGame(state, gameId) || !isWhole(index) || index < 0 || index >= state.evals.length) return;
      state.evals[index] = action.payload.eval;
    },
    analysisFinished: (state, action: PayloadAction<{ gameId: number }>) => {
      if (forThisGame(state, action.payload.gameId) && state.status === "analysing") state.status = "done";
    },
    analysisFailed: (state, action: PayloadAction<{ gameId: number }>) => {
      if (forThisGame(state, action.payload.gameId) && state.status === "analysing") state.status = "failed";
    },
    analysisRetried: (state) => {
      if (state.status === "failed") state.status = "analysing";
    },
    stepTo: (state, action: PayloadAction<number>) => {
      moveCursor(state, action.payload);
    },
    stepBy: (state, action: PayloadAction<number>) => {
      moveCursor(state, state.cursor + action.payload);
    },
    /** Opening a moment not yet done (again) puts it in `trying`; a done one keeps its status. */
    momentOpened: (state, action: PayloadAction<number>) => {
      const ply = action.payload;
      // A ply is a move: 0..n-1, where n = evals.length - 1.
      if (!isWhole(ply) || ply < 0 || ply >= state.evals.length - 1) return;
      state.active = ply;
      state.cursor = ply;
      state.sheetOpen = true;
      const status = state.moments[ply];
      if (status === undefined || !isMomentDone(status)) state.moments[ply] = "trying";
    },
    moveTried: (state, action: PayloadAction<number>) => {
      transition(state, action.payload, ["trying"], "checking");
    },
    tryChecked: (state, action: PayloadAction<{ ply: number; found: boolean }>) => {
      transition(state, action.payload.ply, ["checking"], action.payload.found ? "found" : "wrong");
    },
    checkFailed: (state, action: PayloadAction<number>) => {
      transition(state, action.payload, ["checking"], "check-failed");
    },
    answerShown: (state, action: PayloadAction<number>) => {
      transition(state, action.payload, OPEN_FOR_ANSWER, "revealed");
    },
    momentSkipped: (state, action: PayloadAction<number>) => {
      transition(state, action.payload, OPEN_FOR_ANSWER, "skipped");
    },
    sheetClosed: (state) => {
      state.sheetOpen = false;
    },
    sheetOpened: (state) => {
      state.sheetOpen = true;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(reset, () => initialState).addCase(newGame, () => initialState);
  },
});

export const {
  reviewOpened,
  reviewClosed,
  evalReceived,
  analysisFinished,
  analysisFailed,
  analysisRetried,
  stepTo,
  stepBy,
  momentOpened,
  moveTried,
  tryChecked,
  checkFailed,
  answerShown,
  momentSkipped,
  sheetClosed,
  sheetOpened,
} = reviewSlice.actions;
