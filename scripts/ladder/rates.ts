// Per-40-move error rates for a set of graded games: the human baselines
// (`npm run baseline`) and the bots' self-play (`npm run calibrate -- --measure`)
// are measured by this one module, so the two sides are always comparable.
// Grading comes from the review's `gradeMove`; nothing here computes win %.
import { applyMove } from "../../src/game/engine/engine";
import { GameState, initialGameState } from "../../src/game/engine/game-state";
import { allLegalMoves } from "../../src/game/engine/game-status";
import { pieceKind } from "../../src/game/engine/moves/classify";
import type { Score } from "../../src/game/opponent/engine/lines";
import { isHanging, materialNet } from "../../src/game/opponent/material";
import { uciToMove } from "../../src/game/opponent/position";
import { gradeMove, GradeLevels, LICHESS_LEVELS, REVIEW_LEVELS } from "../../src/game/review/grade";
import type { Grade } from "../../src/game/review/types";

export type { Score };
export type Side = "white" | "black";

/** One game from the start position, with an eval before every ply. */
export interface GradedGame {
  uci: string[];
  /** Length `uci.length + 1`; `evals[i]` is before ply `i`, from the side to move's view. */
  evals: Score[];
  /** Per ply: whether it counts. */
  graded: boolean[];
  /** The colors whose graded plies count. */
  sides: Side[];
}

export interface GradeRates {
  inaccuracy: number | null;
  mistake: number | null;
  blunder: number | null;
}

export interface LevelRates {
  games: number;
  /** Game × measured side pairs. */
  sides: number;
  gradedMoves: number;
  per40: {
    /** At the review's 10/20/30. */
    review: GradeRates;
    /** At Lichess's 5/10/15. */
    lichess: GradeRates;
    hung: number | null;
    missedCapture: number | null;
  };
  /** Mean win % points lost per graded move. */
  avgLoss: number | null;
  /** Mean accuracy per side, from `opts.accuracy`. */
  accuracy: number | null;
}

export interface MeasureOptions<G> {
  accuracy?: (game: G, side: Side) => number | null;
}

/** A hung piece needs at least this cp loss. */
export const HUNG_CP_LOSS = 150;
/** A missed capture needs at least this cp loss. */
export const MISSED_CAPTURE_CP_LOSS = 100;
/** The best capture must net at least this, and the played move this much less. */
export const MISSED_CAPTURE_NET = 2;
/** cp is clamped to ±this, and a mate counts as this. */
export const CP_CAP = 1000;

/** The bots aim at this share of the human rate. */
export const TARGET_SHARE = 0.75;
/** A bot rate within this share of its target is on target. */
export const TOLERANCE = 0.25;

/** A score as clamped cp from its own side's view: a mate is ±1000. */
function clampedCp(s: Score): number {
  // mate 0 is the side to move being mated.
  const raw = "mate" in s ? (s.mate > 0 ? CP_CAP : -CP_CAP) : s.cp;
  return Math.max(-CP_CAP, Math.min(CP_CAP, raw));
}

/**
 * The cp a move loses from the mover's view: `before` is from the mover's
 * view, `after` from the opponent's (the side to move after the move).
 * Never below 0.
 */
export function cpLoss(before: Score, after: Score): number {
  return Math.max(0, clampedCp(before) + clampedCp(after));
}

function isCapture(state: GameState, from: readonly [number, number], to: readonly [number, number]): boolean {
  if (state.squares[to[0]][to[1]] !== null) return true;
  const mover = state.squares[from[0]][from[1]];
  // En passant: a pawn moving sideways onto an empty square.
  return mover !== null && pieceKind(mover) === "pawn" && to[1] !== from[1];
}

/** The best `materialNet` among the legal captures, or `null` when there are none. */
function bestCaptureNet(state: GameState): number | null {
  let best: number | null = null;
  for (const m of allLegalMoves(state)) {
    if (!isCapture(state, m.from, m.to)) continue;
    const net = materialNet(state, m);
    if (best === null || net > best) best = net;
  }
  return best;
}

const per40 = (count: number, moves: number): number | null =>
  moves === 0 ? null : (count / moves) * 40;

const zeroCounts = (): Record<Grade, number> => ({ inaccuracy: 0, mistake: 0, blunder: 0 });

function ratesOf(counts: Record<Grade, number>, moves: number): GradeRates {
  return {
    inaccuracy: per40(counts.inaccuracy, moves),
    mistake: per40(counts.mistake, moves),
    blunder: per40(counts.blunder, moves),
  };
}

function gradeAt(before: Score, after: Score, levels: GradeLevels) {
  return gradeMove({ score: before, best: null }, { score: after, best: null }, levels);
}

/** Measures the graded plies of the measured sides over all `games`. */
export function measureGames<G extends GradedGame>(
  games: readonly G[],
  opts: MeasureOptions<G> = {}
): LevelRates {
  const review = zeroCounts();
  const lichess = zeroCounts();
  let sides = 0;
  let moves = 0;
  let lossSum = 0;
  let hung = 0;
  let missed = 0;
  const accuracies: number[] = [];

  for (const game of games) {
    if (game.evals.length !== game.uci.length + 1 || game.graded.length !== game.uci.length) {
      throw new Error("a graded game needs one eval per position and one graded flag per ply");
    }
    sides += game.sides.length;
    let state = initialGameState();
    for (let i = 0; i < game.uci.length; i++) {
      const move = uciToMove(state, game.uci[i]);
      if (move === null) throw new Error(`ply ${i}: ${game.uci[i]} is not legal`);
      const mover: Side = i % 2 === 0 ? "white" : "black";
      if (game.graded[i] && game.sides.includes(mover)) {
        const before = game.evals[i];
        const after = game.evals[i + 1];
        const atReview = gradeAt(before, after, REVIEW_LEVELS);
        const atLichess = gradeAt(before, after, LICHESS_LEVELS);
        moves++;
        lossSum += atReview.drop;
        if (atReview.grade !== null) review[atReview.grade]++;
        if (atLichess.grade !== null) lichess[atLichess.grade]++;
        const loss = cpLoss(before, after);
        const net = materialNet(state, move);
        if (isHanging(net) && loss >= HUNG_CP_LOSS) hung++;
        if (loss >= MISSED_CAPTURE_CP_LOSS) {
          const best = bestCaptureNet(state);
          if (best !== null && best >= MISSED_CAPTURE_NET && net <= best - MISSED_CAPTURE_NET) {
            missed++;
          }
        }
      }
      state = applyMove(state, move);
    }
    if (opts.accuracy) {
      for (const side of game.sides) {
        const a = opts.accuracy(game, side);
        if (a !== null) accuracies.push(a);
      }
    }
  }

  const none = moves === 0;
  return {
    games: games.length,
    sides,
    gradedMoves: moves,
    per40: {
      review: ratesOf(review, moves),
      lichess: ratesOf(lichess, moves),
      hung: per40(hung, moves),
      missedCapture: per40(missed, moves),
    },
    avgLoss: none ? null : lossSum / moves,
    accuracy:
      none || accuracies.length === 0
        ? null
        : accuracies.reduce((a, b) => a + b, 0) / accuracies.length,
  };
}

/** The bot's target for a human rate: 75 % of it. */
export function targetFor(human: number | null): number | null {
  return human === null ? null : human * TARGET_SHARE;
}

/**
 * Whether a bot rate is within 25 % of its target, bounds included (with a
 * hair of slack for binary rounding). A target of 0 holds only 0.
 */
export function withinTarget(bot: number | null, human: number | null): boolean {
  const t = targetFor(human);
  if (bot === null || t === null) return false;
  if (t === 0) return bot === 0;
  return Math.abs(bot - t) <= TOLERANCE * t + 1e-9 * t;
}
