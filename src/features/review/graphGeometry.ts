/*
 * Pure geometry for the review's win % graph: where each position sits, which
 * stretches of the line can be drawn, the move ticks, and the position nearest
 * to a click. No React, no DOM.
 */
import type { PieceColor } from "game/engine/game-state";
import type { GraphSide } from "./reviewSlice";

export interface GraphPoint {
  /** Position index, 0 is the start. */
  index: number;
  x: number;
  y: number;
  /** Win % from the graph's side. */
  win: number;
}

export interface GraphFrame {
  side: GraphSide;
  humanColor: PieceColor;
  width: number;
  height: number;
}

/** White's win % seen from the graph's side; `null` stays `null`. */
export function sideWin(
  whiteWin: number | null,
  side: GraphSide,
  humanColor: PieceColor
): number | null {
  if (whiteWin === null) return null;
  return side === "you" && humanColor === "black" ? 100 - whiteWin : whiteWin;
}

/** The x of position `index` of `0..last`: the start at 0, the last position at the width. */
export function positionX(index: number, last: number, width: number): number {
  return last <= 0 ? 0 : (index * width) / last;
}

/** One point per position (100 % at the top), `null` where the position isn't analysed. */
export function graphPoints(
  whiteWin: readonly (number | null)[],
  frame: GraphFrame
): (GraphPoint | null)[] {
  const last = whiteWin.length - 1;
  return whiteWin.map((w, index) => {
    const win = sideWin(w, frame.side, frame.humanColor);
    if (win === null) return null;
    return {
      index,
      x: positionX(index, last, frame.width),
      y: frame.height * (1 - win / 100),
      win,
    };
  });
}

/** The runs of analysed neighbours the line joins; a point on its own draws no line. */
export function lineRuns(points: readonly (GraphPoint | null)[]): GraphPoint[][] {
  const runs: GraphPoint[][] = [];
  let run: GraphPoint[] = [];
  for (const p of [...points, null]) {
    if (p !== null) {
      run.push(p);
      continue;
    }
    if (run.length >= 2) runs.push(run);
    run = [];
  }
  return runs;
}

/** A tick closer than this many moves to the last one is left out. */
const TICK_GAP = 4;

/**
 * The move numbers under the graph: move 1, every 10th (20th past 60 moves) and
 * the last, each at the position after White's move.
 */
export function moveTicks(plies: number): { move: number; index: number }[] {
  if (plies < 1) return [];
  const lastMove = Math.floor((plies - 1) / 2) + 1;
  const every = lastMove > 60 ? 20 : 10;
  const moves = [1];
  for (let m = every; m < lastMove; m += every) {
    if (lastMove - m >= TICK_GAP) moves.push(m);
  }
  if (lastMove > 1) moves.push(lastMove);
  return moves.map((move) => ({ move, index: 2 * move - 1 }));
}

/** The position nearest to `x`, clamped to `0..last`. */
export function nearestPosition(x: number, last: number, width: number): number {
  if (last <= 0 || width <= 0) return 0;
  return Math.min(last, Math.max(0, Math.round((x / width) * last)));
}
