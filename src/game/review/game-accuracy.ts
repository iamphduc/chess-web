// Relative imports only, no React.
// Lichess's game accuracy: lila modules/analyse/src/main/AccuracyPercent.scala
// and scalachess WinPercent. See pod-docs/decisions.md (2026-10-16).
import type { PieceColor } from "../engine/game-state";
import type { Score } from "../opponent/engine/lines";

/** scalachess `Cp.CEILING`: cp is clamped to this, and a mate counts as it. */
const CP_CEILING = 1000;

/**
 * White's win %, 0 to 100, from a score made with `sideToMove` to move, the
 * way Lichess computes it for game accuracy: cp clamped to ±1000 and a mate
 * as ±1000 cp. `{ mate: 0 }` is a mate against the side to move.
 */
export function lichessWinPercent(score: Score, sideToMove: PieceColor): number {
  const forMover = "mate" in score ? (score.mate > 0 ? CP_CEILING : -CP_CEILING) : score.cp;
  const cp = Math.min(CP_CEILING, Math.max(-CP_CEILING, sideToMove === "white" ? forMover : -forMover));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/**
 * White's win % at the start of every game for game accuracy. Lichess starts
 * its list from scalachess `Score.initial` (+15 cp for White), never from the
 * engine's eval of the start position.
 */
export const LICHESS_START_WIN = lichessWinPercent({ cp: 15 }, "white");

/**
 * Lichess's per-move accuracy from the mover's win % before and after, with
 * its +1 "uncertainty bonus", clamped to 0..100. 100 when the mover's win %
 * holds or rises.
 */
export function lichessMoveAccuracy(before: number, after: number): number {
  if (after >= before) return 100;
  const raw = 103.1668100711649 * Math.exp(-0.04354415386753951 * (before - after)) - 3.166924740191411;
  return Math.min(100, Math.max(0, raw + 1));
}

function populationSd(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / xs.length);
}

/**
 * One weight per ply from the list of White's win % per position (start
 * included): the population standard deviation of the ply's window, clamped
 * to [0.5, 12]. The window is clamp(floor(plies / 10), 2, 8) positions; the
 * first window is repeated (window - 2) times, then every sliding window
 * follows. A missing win % is left out of its windows.
 */
export function volatilityWeights(whiteWins: readonly (number | null)[]): number[] {
  const plies = whiteWins.length - 1;
  if (plies < 1) return [];
  const size = Math.min(8, Math.max(2, Math.floor(plies / 10)));
  const starts = [
    ...Array<number>(Math.min(size, whiteWins.length) - 2).fill(0),
    ...Array.from({ length: whiteWins.length - size + 1 }, (_, i) => i),
  ];
  return starts.map((start) => {
    const known = whiteWins.slice(start, start + size).filter((w): w is number => w !== null);
    return Math.min(12, Math.max(0.5, populationSd(known)));
  });
}

/**
 * `color`'s game accuracy, 0 to 100: the mean of the volatility-weighted mean
 * and the harmonic mean of its per-move accuracies. `movers[i]` is the side
 * that made ply i. `null` when `color` has no plies or one of its plies lacks
 * a win % before or after it.
 */
export function gameAccuracy(
  whiteWins: readonly (number | null)[],
  movers: readonly PieceColor[],
  color: PieceColor
): number | null {
  const weights = volatilityWeights(whiteWins);
  let weightedSum = 0;
  let weightSum = 0;
  let inverseSum = 0;
  let count = 0;
  for (let ply = 0; ply < movers.length; ply++) {
    if (movers[ply] !== color) continue;
    const prev = whiteWins[ply] ?? null;
    const next = whiteWins[ply + 1] ?? null;
    if (prev === null || next === null) return null;
    const accuracy = color === "white" ? lichessMoveAccuracy(prev, next) : lichessMoveAccuracy(next, prev);
    weightedSum += accuracy * weights[ply];
    weightSum += weights[ply];
    inverseSum += 1 / Math.max(1, accuracy);
    count++;
  }
  if (count === 0) return null;
  return (weightedSum / weightSum + count / inverseSum) / 2;
}
