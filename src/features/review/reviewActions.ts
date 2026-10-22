import type { AnyAction, ThunkAction } from "@reduxjs/toolkit";

import type { RootState } from "app/store";
import { GameOverType } from "features/board/gameOverType";
import { applyMove } from "game/engine/engine";
import type { GameState, PieceColor } from "game/engine/game-state";
import { uciToMove } from "game/opponent/position";
import { isFound, winFor } from "game/review/grade";
import { gameMoves } from "game/review/moves";
import { buildReview } from "game/review/build-review";
import type { BuildReviewInput, PositionEval, ReviewModel } from "game/review/types";
import { TOTAL_MS } from "features/board/clock";
import { stepForKey, type StepKey } from "./components/StepButtons";
import {
  checkFailed,
  moveTried,
  reviewClosed,
  reviewOpened,
  type ReviewState,
  sheetOpened,
  stepTo,
  tryChecked,
} from "./reviewSlice";

type ReviewThunk<R = void> = ThunkAction<R, RootState, unknown, AnyAction>;

/** The board fields the review's opening depends on. */
type ReviewBoard = Pick<
  RootState["board"],
  "engineHistory" | "humanColor" | "gameOver" | "pendingPromotion"
>;

/** A finished vs-Liem game with at least one move of yours and no promotion left to pick. */
export function canOpenReview(board: ReviewBoard, match: Pick<RootState["match"], "mode" | "setupOpen">): boolean {
  if (match.mode !== "liem" || match.setupOpen) return false;
  const human = board.humanColor;
  if (human === null) return false;
  // A flag fall sets a win too, so this covers mate, stalemate and time.
  if (board.gameOver === GameOverType.Continue || board.pendingPromotion !== null) return false;
  // Ply i is yours when positions[i] has you to move; the last position has no move.
  return board.engineHistory.slice(0, -1).some((state) => state.turn === human);
}

/** Opens the review of the game that just ended; does nothing when it can't open. */
export const openReview = (): ReviewThunk => (dispatch, getState) => {
  const { board, match } = getState();
  if (!canOpenReview(board, match)) return;
  dispatch(reviewOpened({ gameId: board.gameId, positions: board.engineHistory }));
};

/** Back to the finished game; the review keeps what it found. */
export const backToGame = (): ReviewThunk => (dispatch) => {
  dispatch(reviewClosed());
};

/** Where the pass picks up: the first position with no eval, or `null` when all have one. */
export function passStart(evals: readonly (PositionEval | null)[]): number | null {
  const at = evals.indexOf(null);
  return at === -1 ? null : at;
}

const LOCKED = ["trying", "checking", "wrong", "check-failed"];

/** While the open moment waits for a move, the cursor stays on it. */
export function steppingLocked(review: Pick<ReviewState, "active" | "moments">): boolean {
  if (review.active === null) return false;
  const status = review.moments[review.active];
  return status !== undefined && LOCKED.includes(status);
}

/** The position an arrow key steps to, or `null` when it does nothing (then don't prevent the key). */
export function keyStep(key: StepKey, review: ReviewState): number | null {
  if (steppingLocked(review)) return null;
  return stepForKey(key, review.cursor, Math.max(0, review.evals.length - 1));
}

/**
 * Selects a position from the graph or the move list. Landing on a flagged
 * move reopens the phone's key-moment sheet.
 */
export const selectPosition =
  (n: number, model: Pick<ReviewModel, "moves">): ReviewThunk =>
  (dispatch) => {
    dispatch(stepTo(n));
    if (model.moves[n - 1]?.grade != null) dispatch(sheetOpened());
  };

/** Searches one position (the runner's `check`). */
export type CheckMove = (state: GameState) => Promise<PositionEval>;

/**
 * Whether a tried move counts as found. Stockfish's best and the move played
 * need no search; any other is searched on the position after it.
 */
export async function judgeTry(input: {
  before: GameState;
  beforeEval: PositionEval;
  played: GameState;
  tried: string;
  humanColor: PieceColor;
  check: CheckMove;
}): Promise<boolean> {
  const { before, beforeEval, played, tried, humanColor, check } = input;
  const [playedUci] = gameMoves([before, played]);
  if (tried === beforeEval.best || tried === playedUci) {
    return isFound({ tried, best: beforeEval.best, played: playedUci, before: 0, after: 0 });
  }
  const move = uciToMove(before, tried);
  if (move === null) throw new RangeError(`not a legal move: ${tried}`);
  const after = applyMove(before, move);
  const afterEval = await check(after);
  return isFound({
    tried,
    best: beforeEval.best,
    played: playedUci,
    before: winFor(beforeEval, before.turn, humanColor),
    after: winFor(afterEval, after.turn, humanColor),
  });
}

/**
 * Tries `uci` at the key moment `ply`: found, wrong, or check-failed when the
 * search fails. Does nothing unless that moment is waiting for a move, or for
 * an illegal move.
 */
export const tryMove =
  (ply: number, uci: string, check: CheckMove): ReviewThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const { review, board } = getState();
    if (review.active !== ply || review.moments[ply] !== "trying") return;
    const before = board.engineHistory[ply];
    const played = board.engineHistory[ply + 1];
    const beforeEval = review.evals[ply];
    const humanColor = board.humanColor;
    if (!before || !played || !beforeEval || humanColor === null) return;
    if (uciToMove(before, uci) === null) return;

    dispatch(moveTried(ply));
    let found: boolean;
    try {
      found = await judgeTry({ before, beforeEval, played, tried: uci, humanColor, check });
    } catch {
      dispatch(checkFailed(ply));
      return;
    }
    dispatch(tryChecked({ ply, found }));
  };

/** The game clock his book lookups use, as for his own moves (`liemTurn`). */
const REVIEW_CLOCK = { baseMs: TOTAL_MS, incrementMs: 0 };

/**
 * The review of the game, or `null` when its positions aren't one legal move
 * apart (`buildReview` throws there), so the page never crashes on it.
 */
export function reviewModel(input: Omit<BuildReviewInput, "clock">): ReviewModel | null {
  try {
    return buildReview({ ...input, clock: REVIEW_CLOCK });
  } catch {
    return null;
  }
}
