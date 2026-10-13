// Relative imports only: the Node scripts (run with tsx) may load this file.
import { Move } from "../engine/engine";
import { GameState } from "../engine/game-state";
import { Score } from "./engine/lines";
import { isHanging, materialNet } from "./material";
import { uciToMove } from "./position";
import type { StepProfile } from "./step-profiles";

/** When the best line's win % is this or more, he is "well ahead". */
export const AHEAD_WIN = 85;

/**
 * A capture whose `materialNet` is this or more (a minor piece) is never
 * skipped for a line that wins less, unless the engine rates that line better.
 */
export const FREE_CAPTURE = 3;

/**
 * A line this many centipawns or more below the best (a minor piece) is
 * outside every loss limit. Win % flattens when one side is far ahead: at
 * -800 cp, falling to -2000 costs only about 5 points.
 */
export const MAX_DROP_CP = 300;

/**
 * The side to move's chance to win, 0 to 100, from an engine score (the
 * Lichess formula). A mate for him is 100; a mate against him is 0.
 */
export function winPercent(score: Score): number {
  if ("mate" in score) return score.mate > 0 ? 100 : 0;
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * score.cp)) - 1);
}

interface Candidate {
  readonly uci: string;
  readonly move: Move;
  readonly score: Score;
  readonly win: number;
  /** What the move wins, one exchange deep (`materialNet`). */
  readonly net: number;
}

function mateOf(score: Score): number | null {
  return "mate" in score ? score.mate : null;
}

/** A mate against him. Mate 0 (already mated) counts too. */
function isMated(score: Score): boolean {
  const mate = mateOf(score);
  return mate !== null && mate <= 0;
}

/** How far `c` falls below `best` in centipawns; 0 when either is a mate. */
function dropCp(best: Score, c: Score): number {
  return "cp" in best && "cp" in c ? best.cp - c.cp : 0;
}

/** The first candidate for which `better(c, best)` never beat it. */
function firstBest(
  candidates: readonly Candidate[],
  better: (a: Candidate, b: Candidate) => boolean
): Candidate {
  return candidates.reduce((best, c) => (better(c, best) ? c : best));
}

/**
 * A weighted pick by `exp(-loss / temperature)`: with `r = random()`, in line
 * order, the first candidate whose running share of the weight passes `r`
 * (the book pick's rule). Weights are taken relative to the smallest loss, so
 * temperature 0 keeps only the lowest-loss candidates, equally weighted. A
 * draw outside [0, 1) falls to the last candidate with weight.
 */
function weightedPick(
  candidates: readonly { c: Candidate; loss: number }[],
  temperature: number,
  random: () => number
): Candidate {
  const least = Math.min(...candidates.map((x) => x.loss));
  const weighted = candidates
    .map(({ c, loss }) => {
      const extra = loss - least;
      const weight =
        temperature > 0 ? Math.exp(-extra / temperature) : extra === 0 ? 1 : 0;
      return { c, weight };
    })
    .filter((x) => x.weight > 0);
  const total = weighted.reduce((sum, x) => sum + x.weight, 0);
  const r = random();
  let running = 0;
  for (const { c, weight } of weighted) {
    running += weight;
    if (running / total > r) return c;
  }
  return weighted[weighted.length - 1].c;
}

/**
 * Picks the move a human of `profile`'s strength would play from the engine's
 * `lines`, or `null` when no line is legal in `state`. In order: drop illegal
 * lines; play the shortest seen mate within `forceMateIn`; avoid lines that
 * get him mated (or, when all do, play the longest mate); drop lines other
 * than the best that hang material; drop lines that skip a free capture
 * (`FREE_CAPTURE`); then, unless well ahead, maybe slip to a line between
 * `maxLoss` and `slipMaxLoss`; else pick a line within the loss limit by
 * `exp(-loss / temperature)`. A line `MAX_DROP_CP` or more below the best is
 * outside both limits.
 */
export function chooseHumanMove(
  lines: readonly { move: string; score: Score }[],
  state: GameState,
  profile: StepProfile,
  random: () => number
): string | null {
  // 1. Legal lines only.
  let candidates: Candidate[] = [];
  for (const line of lines) {
    const move = uciToMove(state, line.move);
    if (move === null) continue;
    candidates.push({
      uci: line.move,
      move,
      score: line.score,
      win: winPercent(line.score),
      net: materialNet(state, move),
    });
  }
  if (candidates.length === 0) return null;

  // 2. A seen mate within reach is always played: the shortest, earliest.
  const forced = candidates.filter((c) => {
    const mate = mateOf(c.score);
    return mate !== null && mate > 0 && mate <= profile.forceMateIn;
  });
  if (forced.length > 0) {
    return firstBest(forced, (a, b) => mateOf(a.score)! < mateOf(b.score)!).uci;
  }

  // 3. Never walk into a mate he can avoid; when he can't, delay it longest.
  const safe = candidates.filter((c) => !isMated(c.score));
  if (safe.length === 0) {
    return firstBest(candidates, (a, b) => -mateOf(a.score)! > -mateOf(b.score)!).uci;
  }
  candidates = safe;

  // 4. Keep the best line; drop any other that hangs material.
  const best = firstBest(candidates, (a, b) => a.win > b.win);
  candidates = candidates.filter((c) => c === best || !isHanging(c.net));

  // 5. Never skip free material: drop a line that wins less than a capture
  // netting FREE_CAPTURE or more, unless the engine rates it better. The
  // biggest such capture always stays, and so does a line at the best win %.
  // Losses and drops are measured from the top line that stays: it has the
  // best win %, and its own drop is 0, so the pick is never empty.
  const free = candidates.filter((c) => c.net >= FREE_CAPTURE);
  candidates = candidates.filter((c) => !free.some((g) => g.net > c.net && g.win >= c.win));
  const top = firstBest(candidates, (a, b) => a.win > b.win);
  const withLoss = candidates
    .filter((c) => dropCp(top.score, c.score) < MAX_DROP_CP)
    .map((c) => ({ c, loss: top.win - c.win }));

  // 6. Well ahead: a tighter limit and no slips.
  const ahead = top.win >= AHEAD_WIN;
  const limit = ahead ? profile.aheadMaxLoss : profile.maxLoss;

  // 7. A rare slip, only when there is a line to slip to.
  if (!ahead && profile.slipChance > 0) {
    const band = withLoss.filter(
      (x) => x.loss > profile.maxLoss && x.loss <= profile.slipMaxLoss
    );
    if (band.length > 0 && random() < profile.slipChance) {
      return weightedPick(band, profile.temperature, random).uci;
    }
  }

  // 8. The normal pick, within the limit (a line at the best win % always is).
  const within = withLoss.filter((x) => x.loss <= limit);
  return weightedPick(within, profile.temperature, random).uci;
}
