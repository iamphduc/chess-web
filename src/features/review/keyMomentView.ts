/**
 * What the key-moment card shows, from the review model and state. Pure, so
 * every card state is tested without rendering.
 */
import type { PieceColor } from "game/engine/game-state";
import type { Grade, KeyMoment, MoveRef, ReviewModel } from "game/review/types";
import { isMomentDone, type MomentStatus, type ReviewState } from "./reviewSlice";

export type CardState = "failed" | "none" | "waiting" | "intro" | MomentStatus | "summary";
export type CardEdge = "red" | "gold" | "olive";

export interface CardInput {
  model: ReviewModel;
  review: Pick<ReviewState, "status" | "moments" | "active">;
  humanColor: PieceColor;
  /** Next moment was pressed with no moment left: show the summary once all are done. */
  summary: boolean;
}

export interface MomentDetail {
  ply: number;
  moveNumber: number;
  side: "White" | "Black";
  grade: Grade;
  /** Win % points the played move cost. */
  drop: number;
  played: MoveRef;
  best: MoveRef | null;
  liem: MoveRef | null;
}

export interface KeyMomentView {
  state: CardState;
  edge: CardEdge;
  /** The small line above the title: "Key moment 2 of 3", or what the card is about. */
  step: string;
  title: string;
  /** One per key moment in game order, `true` once found. */
  stars: boolean[];
  /** "1 of 3 found"; the stars' text for screen readers. */
  foundLabel: string;
  /** While analysing (waiting, or the intro before the pass ends). */
  progress: { label: string; analysed: number; total: number } | null;
  /** The intro's Start button: the first moment not done. */
  startPly: number | null;
  startLabel: string | null;
  /** The active moment, when the card is on one. */
  moment: MomentDetail | null;
  /** The moment Next moment opens; `null` means the summary. */
  nextPly: number | null;
  /** The phone sheet sits low, so the board stays usable while trying a move. */
  low: boolean;
}

const moveNumberOf = (ply: number) => Math.floor(ply / 2) + 1;

/** "Analysing move M of N": M = min(N, floor(analysed / 2) + 1), N = the last move number. */
export function progressLabel(analysed: number, total: number): string {
  const plies = Math.max(1, total - 1);
  const last = moveNumberOf(plies - 1);
  const at = Math.min(last, moveNumberOf(Math.max(0, analysed)));
  return `Analysing move ${at} of ${last}`;
}

/**
 * The next key moment not done, in game order after `active`, wrapping to earlier
 * ones; `null` when every other moment is done (the summary).
 */
export function nextMomentPly(
  keyMoments: readonly KeyMoment[],
  moments: Readonly<Record<number, MomentStatus>>,
  active: number | null
): number | null {
  const open = keyMoments
    .map((m) => m.ply)
    .filter((ply) => ply !== active && !isDone(moments[ply]));
  if (open.length === 0) return null;
  return open.find((ply) => active === null || ply > active) ?? open[0];
}

function isDone(status: MomentStatus | undefined): boolean {
  return status !== undefined && isMomentDone(status);
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const TITLES: Record<MomentStatus, string> = {
  trying: "Find the better move",
  checking: "Find the better move",
  wrong: "Find the better move",
  "check-failed": "Find the better move",
  found: "You found it",
  revealed: "The better move",
  skipped: "Skipped",
};

export function keyMomentView({ model, review, humanColor, summary }: CardInput): KeyMomentView {
  const { keyMoments } = model;
  const { status, moments } = review;
  const stars = keyMoments.map((m) => moments[m.ply] === "found");
  const found = stars.filter(Boolean).length;
  const foundLabel = `${found} of ${keyMoments.length} found`;
  const analysing = status === "analysing" || status === "idle";
  const progress = analysing
    ? { label: progressLabel(model.analysed, model.total), analysed: model.analysed, total: model.total }
    : null;
  const activeIndex = keyMoments.findIndex((m) => m.ply === review.active);
  const active = activeIndex === -1 ? null : keyMoments[activeIndex];
  const activeStatus = active === null ? undefined : moments[active.ply];
  const nextPly = nextMomentPly(keyMoments, moments, active?.ply ?? null);

  const base: KeyMomentView = {
    state: "waiting",
    edge: "red",
    step: "",
    title: "",
    stars,
    foundLabel,
    progress: null,
    startPly: null,
    startLabel: null,
    moment: null,
    nextPly,
    low: false,
  };

  if (status === "failed") {
    return { ...base, state: "failed", step: "Game review", title: "Analysis stopped" };
  }
  if (status === "done" && keyMoments.length === 0) {
    return { ...base, state: "none", edge: "gold", step: "Game review", title: "No mistakes found" };
  }
  if (keyMoments.length === 0) {
    return { ...base, state: "waiting", edge: "olive", step: "Reading your game", title: progress!.label, progress };
  }
  const allDone = keyMoments.every((m) => isDone(moments[m.ply]));
  if (summary && allDone) {
    return {
      ...base,
      state: "summary",
      edge: found > 0 ? "gold" : "red",
      step: "Review done",
      title: foundLabel,
      progress,
    };
  }
  if (active === null || activeStatus === undefined) {
    const start = nextPly ?? keyMoments[0].ply;
    return {
      ...base,
      state: "intro",
      edge: analysing ? "olive" : "red",
      step: `${plural(keyMoments.length, "key moment", "key moments")} ready`,
      title: analysing ? progress!.label : plural(keyMoments.length, "key moment", "key moments"),
      progress,
      startPly: start,
      startLabel: `Start with move ${moveNumberOf(start)}`,
    };
  }
  return {
    ...base,
    state: activeStatus,
    edge: activeStatus === "found" ? "gold" : "red",
    step: `Key moment ${activeIndex + 1} of ${keyMoments.length}`,
    title: TITLES[activeStatus],
    moment: {
      ply: active.ply,
      moveNumber: moveNumberOf(active.ply),
      side: humanColor === "white" ? "White" : "Black",
      grade: active.grade,
      drop: active.drop,
      played: active.played,
      best: active.best,
      liem: active.liem,
    },
    low: activeStatus === "trying",
  };
}
