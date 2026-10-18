// `npm run calibrate -- --measure`: each step plays itself from his book, a
// full-strength grader grades every position, and the engine plies' mistake
// rates are compared with the human baselines. Pure: players, grader and files
// are injected, so the tests use fakes and calibrate.ts uses engines.
import { applyMove } from "../../src/game/engine/engine";
import { initialGameState, type GameState } from "../../src/game/engine/game-state";
import { gameStatus } from "../../src/game/engine/game-status";
import type { GameClock } from "../../src/game/opponent/book";
import type { EngineLine, Score } from "../../src/game/opponent/engine/lines";
import { LIEM } from "../../src/game/opponent/players";
import { toFen, uciToMove } from "../../src/game/opponent/position";
import { STEP_PROFILES } from "../../src/game/opponent/step-profiles";
import { STRENGTH_STEPS, strengthElo, type StrengthStep } from "../../src/game/opponent/strength";
import { createAnalysisRunner, type ReviewEngine } from "../../src/game/review/analysis-runner";
import { gradeMove } from "../../src/game/review/grade";
import { REVIEW_LIMITS } from "../../src/features/review/reviewLimits";
import { measureGames, targetFor, withinTarget, type GradedGame, type LevelRates, type Side } from "../ladder/rates";
import type { AccuracyFn } from "./accuracy";
import { MAX_PLIES } from "./match";

/** The steps measured by default: every step but Liem's. */
export const SPARRING_STEPS: readonly StrengthStep[] = STRENGTH_STEPS.filter((s) => s !== "full");
export const DEFAULT_MEASURE_GAMES = 20;

/** The app's clock, 10 minutes and no increment; it picks his book. */
export const MEASURE_CLOCK: GameClock = { baseMs: 10 * 60_000, incrementMs: 0 };

/** A side resigns after this many of its own engine moves in a row with a top line at or below `RESIGN_CP` (or mated). */
export const RESIGN_AFTER = 3;
export const RESIGN_CP = -1000;

export interface MeasureArgs {
  mode: "measure";
  steps: StrengthStep[];
  games: number;
  seed: number;
  jobs: number;
}

/** One move, where it came from, and the lines behind an engine move. */
export interface MeasureMove {
  uci: string;
  source: "book" | "engine";
  lines?: readonly EngineLine[];
}

export interface MeasurePlayer {
  /** Called before the game. */
  newGame(): void;
  move(state: GameState): Promise<MeasureMove>;
  /** Called once the game is played, before grading. */
  dispose?(): void;
}

export type Grader = ReviewEngine & { dispose(): void };

export type SelfPlayEnd = "checkmate" | "stalemate" | "ply-cap" | "resign" | "error";

export interface SelfPlayRecord {
  uci: string[];
  sources: ("book" | "engine")[];
  end: SelfPlayEnd;
  winner: Side | null;
  /** Set when `end` is "error". */
  error?: string;
  /** Think time of each engine move. */
  engineMs: number[];
}

export type MeasuredGame =
  | { ok: true; record: SelfPlayRecord; game: GradedGame; bookPlies: number }
  | { ok: false; record: SelfPlayRecord; error: string };

const other = (side: Side): Side => (side === "white" ? "black" : "white");

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Whether a top line is lost enough to count toward resigning: ≤ -1000 cp or a mate against. */
function isLost(score: Score | undefined): boolean {
  if (score === undefined) return false;
  return "cp" in score ? score.cp <= RESIGN_CP : score.mate <= 0;
}

/**
 * Plays one game from the start position. It ends on checkmate or stalemate
 * (our rules engine), as a draw at `maxPlies`, or when a side resigns after
 * its `RESIGN_AFTER`-th engine move in a row with a lost top line (that move
 * is played). A book move, or a better top line, starts the count again. A
 * player that throws or answers an illegal move ends the game as an error.
 */
export async function playSelfGame(
  white: MeasurePlayer,
  black: MeasurePlayer,
  options: { maxPlies?: number; now?: () => number } = {}
): Promise<SelfPlayRecord> {
  const { maxPlies = MAX_PLIES, now = () => performance.now() } = options;
  const record: SelfPlayRecord = { uci: [], sources: [], end: "ply-cap", winner: null, engineMs: [] };
  const lostRun: Record<Side, number> = { white: 0, black: 0 };
  let resigned: Side | null = null;
  let state = initialGameState();
  white.newGame();
  black.newGame();

  for (;;) {
    const status = gameStatus(state);
    if (status === "checkmate") {
      record.end = "checkmate";
      record.winner = other(state.turn);
      return record;
    }
    if (status === "stalemate") {
      record.end = "stalemate";
      return record;
    }
    if (resigned !== null) {
      record.end = "resign";
      record.winner = other(resigned);
      return record;
    }
    if (record.uci.length >= maxPlies) return record;

    const side = state.turn;
    let played: MeasureMove;
    const start = now();
    try {
      played = await (side === "white" ? white : black).move(state);
    } catch (error) {
      record.end = "error";
      record.error = `${side}: ${message(error)}`;
      return record;
    }
    const ms = now() - start;
    const move = uciToMove(state, played.uci);
    if (move === null) {
      record.end = "error";
      record.error = `${side}: illegal move ${played.uci}`;
      return record;
    }
    record.uci.push(played.uci);
    record.sources.push(played.source);
    if (played.source === "engine") {
      record.engineMs.push(ms);
      lostRun[side] = isLost(played.lines?.[0]?.score) ? lostRun[side] + 1 : 0;
    } else {
      lostRun[side] = 0;
    }
    if (lostRun[side] >= RESIGN_AFTER) resigned = side;
    state = applyMove(state, move);
  }
}

function positionsOf(uci: readonly string[]): GameState[] {
  let state = initialGameState();
  const positions = [state];
  for (const m of uci) {
    const move = uciToMove(state, m);
    if (move === null) throw new Error(`${m} is not legal`);
    state = applyMove(state, move);
    positions.push(state);
  }
  return positions;
}

/** Every position's eval at the review's limits; terminal positions aren't searched. */
async function gradePositions(uci: readonly string[], grader: ReviewEngine): Promise<Score[]> {
  const positions = positionsOf(uci);
  const evals: Score[] = [];
  const runner = createAnalysisRunner({ engine: grader, limits: REVIEW_LIMITS });
  const done = await runner.start(positions, 0, (i, e) => {
    evals[i] = e.score;
  });
  if (done !== "done") throw new Error("grading stopped");
  return evals;
}

/**
 * Plays one game, disposes both players, then grades it on a grader of its
 * own. Only engine plies count, for both sides. A player or grader failure
 * makes the game an error.
 */
export async function measureOneGame(
  white: MeasurePlayer,
  black: MeasurePlayer,
  startGrader: () => Grader,
  options: { maxPlies?: number; now?: () => number } = {}
): Promise<MeasuredGame> {
  let record: SelfPlayRecord;
  try {
    record = await playSelfGame(white, black, options);
  } finally {
    white.dispose?.();
    black.dispose?.();
  }
  if (record.end === "error") return { ok: false, record, error: record.error ?? "error" };

  let grader: Grader | null = null;
  try {
    grader = startGrader();
    const evals = await gradePositions(record.uci, grader);
    const game: GradedGame = {
      uci: record.uci,
      evals,
      graded: record.sources.map((s) => s === "engine"),
      sides: ["white", "black"],
    };
    const bookPlies = record.sources.filter((s) => s === "book").length;
    return { ok: true, record, game, bookPlies };
  } catch (error) {
    return { ok: false, record, error: `grader: ${message(error)}` };
  } finally {
    grader?.dispose();
  }
}

// ---- The report ----

export interface MeasureDeps {
  log(line: string): void;
  error(line: string): void;
  now(): number;
  /** A player that moves like the app at `step`, his books included. */
  makePlayer(step: StrengthStep, random: () => number): MeasurePlayer;
  /** A full-strength engine, one per game. */
  makeGrader(): Grader;
  /** The parsed `human-baselines.json`, or null when there is none. */
  readBaselines(): unknown;
  /** The game accuracy, or null to leave the row out. */
  loadAccuracy(): Promise<AccuracyFn | null>;
}

const BASELINE_FILE = "scripts/ladder/human-baselines.json";

type Baselines = { levels: Map<string, LevelRates> } | { note: string };

function readBaselineLevels(read: () => unknown): Baselines {
  let raw: unknown;
  try {
    raw = read();
  } catch (error) {
    return { note: `could not read ${BASELINE_FILE} (${message(error)}); run \`npm run baseline\` to write it` };
  }
  if (raw === null || raw === undefined) {
    return { note: `no ${BASELINE_FILE}: human columns show "-"; run \`npm run baseline\` to write it` };
  }
  const file = raw as { format?: unknown; levels?: unknown };
  if (file.format !== 1 || typeof file.levels !== "object" || file.levels === null) {
    return { note: `${BASELINE_FILE} is not a format 1 file; run \`npm run baseline\` to write it again` };
  }
  const levels = new Map<string, LevelRates>();
  for (const [key, entry] of Object.entries(file.levels as Record<string, unknown>)) {
    const rates = (entry as { rates?: LevelRates } | null)?.rates;
    if (rates && typeof rates === "object" && rates.per40) levels.set(key, rates);
  }
  return { levels };
}

interface Row {
  label: string;
  get(r: LevelRates): number | null;
  /** Shows the ok column (the success criteria). */
  judged?: true;
  /** No 75 % target (higher is better). */
  noTarget?: true;
}

const ROWS: readonly Row[] = [
  { label: "review.inaccuracy", get: (r) => r.per40.review.inaccuracy },
  { label: "review.mistake", get: (r) => r.per40.review.mistake, judged: true },
  { label: "review.blunder", get: (r) => r.per40.review.blunder, judged: true },
  { label: "lichess.inaccuracy", get: (r) => r.per40.lichess.inaccuracy },
  { label: "lichess.mistake", get: (r) => r.per40.lichess.mistake },
  { label: "lichess.blunder", get: (r) => r.per40.lichess.blunder },
  { label: "hung", get: (r) => r.per40.hung },
  { label: "missed capture", get: (r) => r.per40.missedCapture },
  { label: "avg loss", get: (r) => r.avgLoss },
];
const ACCURACY_ROW: Row = { label: "accuracy", get: (r) => r.accuracy, noTarget: true };

const num = (x: number | null, digits = 2) => (x === null ? "-" : x.toFixed(digits));

function table(head: string[], body: string[][]): string[] {
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((row) => row[i].length)));
  const row = (cells: string[]) =>
    cells
      .map((c, i) => (i === 0 ? c.padEnd(widths[i]) : c.padStart(widths[i])))
      .join("  ")
      .trimEnd();
  return [row(head), ...body.map(row)];
}

/** The step's search and pick settings, the new band fields included (missing = 0). */
export function profileLine(step: StrengthStep, rating: number): string {
  const p = STEP_PROFILES[step];
  return (
    `Step ${step} (about ${strengthElo(step, rating)}): depth ${p.search.depth}, multiPv ${p.search.multiPv}, ` +
    `${p.search.movetimeMs} ms; maxLoss ${p.maxLoss}, temperature ${p.temperature}, ` +
    `slip ${p.slipChance} up to ${p.slipMaxLoss}, ahead ${p.aheadMaxLoss}, mate in ${p.forceMateIn}; ` +
    `mistake ${p.mistakeChance ?? 0}, blunder ${p.blunderChance ?? 0} up to ${p.blunderMaxCp ?? 0} cp, ` +
    `hang weight ${p.hangWeight ?? 0}`
  );
}

/** The `count` biggest graded drops, biggest first. */
function biggestDrops(games: readonly GradedGame[], count: number): { fen: string; uci: string; drop: number }[] {
  const drops: { fen: string; uci: string; drop: number }[] = [];
  for (const game of games) {
    const positions = positionsOf(game.uci);
    game.uci.forEach((uci, i) => {
      if (!game.graded[i]) return;
      const { drop } = gradeMove({ score: game.evals[i], best: null }, { score: game.evals[i + 1], best: null });
      drops.push({ fen: toFen(positions[i]), uci, drop });
    });
  }
  return drops.sort((a, b) => b.drop - a.drop).slice(0, count);
}

const mean = (xs: readonly number[]) => (xs.length === 0 ? null : xs.reduce((s, x) => s + x, 0) / xs.length);

function levelReport(
  step: StrengthStep,
  results: readonly MeasuredGame[],
  baselines: Baselines,
  accuracy: AccuracyFn | null,
  rating: number
): string[] {
  const ok = results.filter((r): r is Extract<MeasuredGame, { ok: true }> => r.ok);
  const games = ok.map((r) => r.game);
  const bot = measureGames(games, accuracy ? { accuracy } : {});
  const ms = results.flatMap((r) => r.record.engineMs);
  const lines = [
    "",
    profileLine(step, rating),
    `games ${ok.length}, errors ${results.length - ok.length}, ` +
      `avg book plies ${num(mean(ok.map((r) => r.bookPlies)), 1)}, graded moves ${bot.gradedMoves}, ` +
      `ms per engine move avg ${num(mean(ms), 0)}, max ${ms.length === 0 ? "-" : Math.round(Math.max(...ms))}`,
  ];
  results.forEach((r, i) => {
    if (!r.ok) lines.push(`  error in game ${i + 1}: ${r.error}`);
  });

  const human = "levels" in baselines ? baselines.levels.get(String(step)) ?? null : null;
  const rows = accuracy ? [...ROWS, ACCURACY_ROW] : ROWS;
  const body = rows.map((row) => {
    const b = row.get(bot);
    const h = human === null ? null : row.get(human);
    const t = row.noTarget ? null : targetFor(h);
    const judged = row.judged ? (b === null || h === null ? "-" : withinTarget(b, h) ? "yes" : "no") : "";
    return [row.label, num(b), num(h), num(t), judged];
  });
  lines.push(...table(["rate", "bot", "human", "target", "ok"], body).map((l) => `  ${l}`));
  if (step === "full") lines.push("  Liem has no human baseline and no target.");
  else if ("levels" in baselines && human === null) {
    lines.push(`  no human baseline for ${step}; run \`npm run baseline\` to measure it`);
  }

  const drops = biggestDrops(games, 3);
  if (drops.length > 0) {
    lines.push("  biggest drops (FEN, move, win % lost):");
    for (const d of drops) lines.push(`    ${d.fen}  ${d.uci}  ${d.drop.toFixed(1)}`);
  }
  return lines;
}

/** mulberry32: a small seeded random in [0, 1). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a, for seeding from a text key. */
export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Runs the measure mode; returns the exit code. */
export async function runMeasure(args: MeasureArgs, deps: MeasureDeps): Promise<number> {
  const rating = LIEM.entry.rating;
  const accuracy = await deps.loadAccuracy();
  const baselines = readBaselineLevels(() => deps.readBaselines());
  const jobs = args.steps.flatMap((step) => Array.from({ length: args.games }, (_, game) => ({ step, game })));
  deps.log(
    `Measuring steps ${args.steps.join(", ")}: ${args.games} self-play games each from his book ` +
      `= ${jobs.length} games, ${args.jobs} at a time, seed ${args.seed}; graded at depth ${REVIEW_LIMITS.depth} ` +
      `or ${REVIEW_LIMITS.movetimeMs} ms a position`
  );
  if ("note" in baselines) deps.log(baselines.note);
  if (accuracy === null) deps.log("No game accuracy on this branch: the accuracy row is left out.");

  const results = new Map<StrengthStep, MeasuredGame[]>(args.steps.map((s) => [s, []]));
  const started = deps.now();
  let next = 0;
  let finished = 0;

  async function playOne({ step, game }: (typeof jobs)[number]): Promise<void> {
    const key = `${args.seed}|${step}|${game}`;
    const white = deps.makePlayer(step, seeded(hash(`${key}|white`)));
    const black = deps.makePlayer(step, seeded(hash(`${key}|black`)));
    const result = await measureOneGame(white, black, () => deps.makeGrader(), { now: deps.now });
    results.get(step)![game] = result;
    finished += 1;
    const r = result.record;
    const outcome = result.ok ? `${r.winner ?? "draw"} by ${r.end}` : `error (${result.error})`;
    deps.log(`[${finished}/${jobs.length}] step ${step}, game ${game + 1}: ${outcome} at ply ${r.uci.length}`);
  }

  async function worker(): Promise<void> {
    while (next < jobs.length) await playOne(jobs[next++]);
  }
  await Promise.all(Array.from({ length: Math.min(args.jobs, jobs.length) }, worker));

  for (const step of args.steps) {
    levelReport(step, results.get(step)!, baselines, accuracy, rating).forEach((line) => deps.log(line));
  }
  deps.log("");
  deps.log(`Done in ${((deps.now() - started) / 60000).toFixed(1)} min.`);
  return 0;
}
