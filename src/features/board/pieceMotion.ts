/*
 * How pieces move (plans ui-motion and ui-feel): a 200 ms ease-in-out tween on the game
 * board, and in the review a 150 ms ease-out only for a one-ply step. Pure values and
 * rules; Piece.tsx and ReviewBoard.tsx only pass them to Framer Motion.
 */

/**
 * Every piece move on the game board (a click, a tap, his move, castling's rook, en
 * passant). The CSS `ease-in-out` curve (Framer's "easeInOut"), written as its control
 * points so tests can sample it: a gentle start, no overshoot.
 */
export const GAME_MOVE_TRANSITION = { type: "tween", ease: [0.42, 0, 0.58, 1], duration: 0.2 } as const;

/** A one-ply step on the review board. */
export const REVIEW_STEP_TRANSITION = { type: "tween", ease: "easeOut", duration: 0.15 } as const;

/** No motion: the piece is on its new square at once. */
export const SNAP_TRANSITION = { duration: 0 } as const;

/** What the review board shows: one position of one game, at one flip and square size. */
export interface ReviewStep {
  gameId: number;
  ply: number;
  flipped: boolean;
  size: number;
}

export type ReviewStepMotion = "slide" | "snap";

/**
 * Slide only for a one-ply step (◀, ▶, an arrow key, an adjacent move in the list) of
 * the same game at the same flip and size. Opening the review, a jump, a flip, a resize
 * or another game snaps, so pieces never sweep across the board.
 */
export function reviewStepMotion(prev: ReviewStep | null, next: ReviewStep): ReviewStepMotion {
  if (prev === null) return "snap";
  const same = prev.gameId === next.gameId && prev.flipped === next.flipped && prev.size === next.size;
  return same && Math.abs(next.ply - prev.ply) === 1 ? "slide" : "snap";
}

export function sameReviewStep(a: ReviewStep, b: ReviewStep): boolean {
  return a.gameId === b.gameId && a.ply === b.ply && a.flipped === b.flipped && a.size === b.size;
}

/** The step on screen and how it arrived. */
export interface ReviewStepShown {
  step: ReviewStep;
  motion: ReviewStepMotion;
}

/**
 * The step to show next. The same step again (a re-render, such as an eval arriving)
 * keeps its motion, so a slide in progress isn't cut short.
 */
export function nextReviewStep(shown: ReviewStepShown | null, next: ReviewStep): ReviewStepShown {
  if (shown !== null && sameReviewStep(shown.step, next)) return shown;
  return { step: next, motion: reviewStepMotion(shown?.step ?? null, next) };
}

export function transitionFor(motion: ReviewStepMotion) {
  return motion === "slide" ? REVIEW_STEP_TRANSITION : SNAP_TRANSITION;
}
