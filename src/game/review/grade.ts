// Relative imports only, no React.
import type { PieceColor } from "../engine/game-state";
import { winPercent } from "../opponent/human-move";
import type { Grade, PositionEval } from "./types";

/** Grade levels, in win % points lost (the Lichess levels). */
export const INACCURACY = 10;
export const MISTAKE = 20;
export const BLUNDER = 30;

/** A score from one side's view: a mate for or against, or centipawns. */
type View = { mate: "for" | "against" } | { cp: number };

/**
 * `e` seen from `viewer`. `e` is from `sideToMove`'s view; the other side
 * negates cp and flips the mate. `{ mate: 0 }` (side to move is checkmated) is
 * a mate against the side to move and a mate for the other side.
 */
function viewOf(e: PositionEval, sideToMove: PieceColor, viewer: PieceColor): View {
  const own = sideToMove === viewer;
  if ("mate" in e.score) {
    const forMover = e.score.mate > 0;
    return { mate: forMover === own ? "for" : "against" };
  }
  return { cp: own ? e.score.cp : -e.score.cp || 0 };
}

function winOfView(v: View): number {
  if ("mate" in v) return v.mate === "for" ? 100 : 0;
  return winPercent({ cp: v.cp });
}

/** `viewer`'s win %, 0 to 100, from an eval made with `sideToMove` to move. */
export function winFor(e: PositionEval, sideToMove: PieceColor, viewer: PieceColor): number {
  return winOfView(viewOf(e, sideToMove, viewer));
}

/** Win % points lost by a move, never below 0. */
export function moveDrop(before: number, after: number): number {
  return Math.max(0, before - after);
}

/** The Lichess per-move accuracy, clamped to 0..100. */
export function moveAccuracy(before: number, after: number): number {
  const raw = 103.1668 * Math.exp(-0.04354 * (before - after)) - 3.1669;
  return Math.min(100, Math.max(0, raw));
}

/** The grade for a win % drop: 30 blunder, 20 mistake, 10 inaccuracy. */
export function gradeForDrop(drop: number): Grade | null {
  if (drop >= BLUNDER) return "blunder";
  if (drop >= MISTAKE) return "mistake";
  if (drop >= INACCURACY) return "inaccuracy";
  return null;
}

/** Lichess's mate judgements; `undefined` when no mate rule applies. */
function mateGrade(before: View, after: View): Grade | null | undefined {
  if ("mate" in before && before.mate === "for") {
    if ("mate" in after) return after.mate === "against" ? "blunder" : null;
    if (after.cp > 999) return "inaccuracy";
    if (after.cp > 700) return "mistake";
    return "blunder";
  }
  if ("mate" in before) {
    // A mate against: staying mated is no grade; getting out is graded by drop.
    return "mate" in after && after.mate === "against" ? null : undefined;
  }
  if ("mate" in after && after.mate === "against") {
    if (before.cp < -999) return "inaccuracy";
    if (before.cp < -700) return "mistake";
    return "blunder";
  }
  return undefined;
}

/**
 * One human move, from the eval before it (the human to move) and the eval
 * after it (the opponent to move): the drop, the accuracy and the grade.
 */
export function gradeMove(
  before: PositionEval,
  after: PositionEval
): { drop: number; accuracy: number; grade: Grade | null } {
  // The views only care whether the eval's side is the viewer's.
  const b = viewOf(before, "white", "white");
  const a = viewOf(after, "black", "white");
  const winBefore = winOfView(b);
  const winAfter = winOfView(a);
  const drop = moveDrop(winBefore, winAfter);
  const mate = mateGrade(b, a);
  return {
    drop,
    accuracy: moveAccuracy(winBefore, winAfter),
    grade: mate === undefined ? gradeForDrop(drop) : mate,
  };
}

/**
 * Whether a tried move counts as found: the best move is; the move played
 * isn't; any other is found when it loses less than `INACCURACY` (`before`
 * and `after` are the human's win % before the move and after `tried`).
 */
export function isFound(input: {
  tried: string;
  best: string | null;
  played: string;
  before: number;
  after: number;
}): boolean {
  if (input.tried === input.best) return true;
  if (input.tried === input.played) return false;
  return input.before - input.after < INACCURACY;
}
