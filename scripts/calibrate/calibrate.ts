// `npm run calibrate`: plays each strength step against Stockfish anchors at a
// set UCI_Elo and against the next step up, and prints a table per step. Dev
// only, run by hand; never in tests or CI. See docs/codebase-structure.md.
import { availableParallelism } from "node:os";
import { pathToFileURL } from "node:url";
import { createUciEngine, type UciTransport } from "../../src/game/opponent/engine/uci-engine";
import { createOpponent } from "../../src/game/opponent/opponent";
import { LIEM } from "../../src/game/opponent/players";
import { STEP_PROFILES } from "../../src/game/opponent/step-profiles";
import { STRENGTH_STEPS, strengthElo, type StrengthStep } from "../../src/game/opponent/strength";
import type { Book, BookName } from "../../src/game/opponent/types";
import { createAnchor, defaultAnchors, DEFAULT_ANCHOR_OFFSETS, spawnStockfish } from "./anchor";
import {
  gamePlan,
  OPENINGS,
  playGame,
  summarize,
  type GameRecord,
  type MatchPlayer,
  type PairingResult,
} from "./match";

/**
 * How long an anchor thinks per move. Stockfish's UCI_Elo scale was set at
 * about 60 s + 0.6 s a game; at 500 ms its anchors played far below their
 * number (first run, docs/decisions.md 2026-10-12).
 */
export const ANCHOR_MOVETIME_MS = 1000;

export interface CalibrateArgs {
  steps: StrengthStep[];
  /** Anchor offsets from each step's Elo. */
  anchors: number[];
  games: number;
  seed: number;
  /** Games played at once. */
  jobs: number;
}

export interface CalibrateDeps {
  log(line: string): void;
  error(line: string): void;
  /** Starts one Stockfish and returns its UCI pipe. */
  startEngine(): UciTransport;
  now(): number;
}

const USAGE =
  "usage: npm run calibrate -- [--steps 1400,1700,...,full] [--anchors -200,0,200|none] " +
  "[--games N (even)] [--seed N] [--jobs N]";

const defaultJobs = () => Math.max(1, Math.min(6, availableParallelism() - 2));

function wholeList(text: string): number[] | null {
  const parts = text.split(",").map((p) => p.trim());
  if (parts.some((p) => !/^[+-]?\d+$/.test(p))) return null;
  return parts.map(Number);
}

/** The flags, or an error message. */
export function parseArgs(argv: readonly string[]): CalibrateArgs | { error: string } {
  const out: CalibrateArgs = {
    steps: [...STRENGTH_STEPS],
    anchors: [...DEFAULT_ANCHOR_OFFSETS],
    games: 4,
    seed: 1,
    jobs: defaultJobs(),
  };
  for (let i = 0; i < argv.length; i++) {
    let flag = argv[i];
    let value: string | undefined;
    const eq = flag.indexOf("=");
    if (flag.startsWith("--") && eq > 0) {
      value = flag.slice(eq + 1);
      flag = flag.slice(0, eq);
    }
    if (!["--steps", "--anchors", "--games", "--seed", "--jobs"].includes(flag)) {
      return { error: `unknown flag "${flag}"` };
    }
    if (value === undefined) {
      value = argv[++i];
      if (value === undefined) return { error: `${flag} needs a value` };
    }
    switch (flag) {
      case "--steps": {
        const names = value.split(",").map((s) => s.trim());
        if (names.length === 0 || names.some((s) => s === "")) {
          return { error: "--steps needs a comma list of steps" };
        }
        const picked = new Set<StrengthStep>();
        for (const name of names) {
          const step = STRENGTH_STEPS.find((s) => String(s) === name);
          if (step === undefined) {
            return { error: `unknown step "${name}"; steps are ${STRENGTH_STEPS.join(", ")}` };
          }
          picked.add(step);
        }
        out.steps = STRENGTH_STEPS.filter((s) => picked.has(s));
        break;
      }
      case "--anchors": {
        if (value === "none") {
          out.anchors = [];
          break;
        }
        const list = wholeList(value);
        if (list === null) return { error: `--anchors needs whole-number offsets like -200,0,200, got "${value}"` };
        out.anchors = [...new Set(list)].sort((a, b) => a - b);
        break;
      }
      case "--games": {
        const n = /^\d+$/.test(value) ? Number(value) : NaN;
        if (!(n >= 2) || n % 2 !== 0) {
          return { error: `--games must be an even number of 2 or more (each opening once per color), got "${value}"` };
        }
        out.games = n;
        break;
      }
      case "--seed": {
        if (!/^\d+$/.test(value)) return { error: `--seed must be a whole number, got "${value}"` };
        out.seed = Number(value);
        break;
      }
      case "--jobs": {
        const n = /^\d+$/.test(value) ? Number(value) : NaN;
        if (!(n >= 1)) return { error: `--jobs must be 1 or more, got "${value}"` };
        out.jobs = n;
        break;
      }
    }
  }
  return out;
}

/** mulberry32: a small seeded random in [0, 1). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

const emptyBook = (book: BookName): Book => ({
  format: 1,
  player: "calibration",
  book,
  minGames: 1,
  games: 0,
  gamesBySource: { otb: 0, lichess: 0, chesscom: 0 },
  positions: {},
});

/** A player that moves like `createOpponent` at `step`, with no book. */
function stepPlayer(step: StrengthStep, transport: UciTransport, random: () => number) {
  const profile = STEP_PROFILES[step];
  const opponent = createOpponent({
    books: { slow: emptyBook("slow"), online: emptyBook("online") },
    engine: createUciEngine(transport),
  });
  const player: MatchPlayer & { dispose(): void } = {
    name: `step ${step}`,
    slipAbove: profile.maxLoss,
    newGame: () => opponent.newGame(),
    move: async (state) => {
      const choice = await opponent.chooseMove(state, { profile, clock: null, random });
      return { uci: choice.uci, lines: choice.lines };
    },
    dispose: () => opponent.dispose(),
  };
  return player;
}

type Rival = { kind: "anchor"; elo: number } | { kind: "step"; step: StrengthStep };

interface Pairing {
  step: StrengthStep;
  rival: Rival;
  label: string;
}

function pairingsFor(args: CalibrateArgs, rating: number): Pairing[] {
  const pairings: Pairing[] = [];
  for (const step of args.steps) {
    for (const elo of defaultAnchors(step, rating, args.anchors)) {
      pairings.push({ step, rival: { kind: "anchor", elo }, label: `SF ${elo}` });
    }
    const next = STRENGTH_STEPS[STRENGTH_STEPS.indexOf(step) + 1];
    if (next !== undefined) pairings.push({ step, rival: { kind: "step", step: next }, label: `step ${next}` });
  }
  return pairings;
}

const fmt = (x: number | null, digits = 1) => (x === null ? "-" : x.toFixed(digits));
const signed = (x: number | null) => (x === null ? "-" : `${x >= 0 ? "+" : ""}${Math.round(x)}`);
const pct = (x: number | null) => (x === null ? "-" : `${(x * 100).toFixed(1)}%`);

function stepTable(step: StrengthStep, rows: { pairing: Pairing; result: PairingResult }[], rating: number): string[] {
  const p = STEP_PROFILES[step];
  const lines = [
    "",
    `Step ${step} (about ${strengthElo(step, rating)}): depth ${p.search.depth}, multiPv ${p.search.multiPv}, ` +
      `${p.search.movetimeMs} ms; maxLoss ${p.maxLoss}, temperature ${p.temperature}, ` +
      `slip ${p.slipChance} up to ${p.slipMaxLoss}, ahead ${p.aheadMaxLoss}, mate in ${p.forceMateIn}`,
  ];
  const head = ["vs", "W", "D", "L", "err", "score", "Elo gap", "≈ Elo", "avg loss", "max loss", "slips", "avg ms", "max ms"];
  const body = rows.map(({ pairing, result: r }) => [
    pairing.label,
    String(r.wins),
    String(r.draws),
    String(r.losses),
    String(r.errors),
    pct(r.score),
    signed(r.eloGap),
    pairing.rival.kind === "anchor" && r.eloGap !== null ? String(Math.round(pairing.rival.elo + r.eloGap)) : "-",
    fmt(r.avgLoss),
    fmt(r.maxLoss),
    pct(r.slipRate),
    fmt(r.avgMs, 0),
    fmt(r.maxMs, 0),
  ]);
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((row) => row[i].length)));
  const row = (cells: string[]) => cells.map((c, i) => (i === 0 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join("  ");
  lines.push(row(head), ...body.map(row));
  for (const { pairing, result } of rows) {
    for (const message of result.errorMessages) lines.push(`  error vs ${pairing.label}: ${message}`);
  }
  return lines;
}

/** Runs the calibration; returns the exit code. */
export async function runCalibrate(argv: readonly string[], deps: CalibrateDeps): Promise<number> {
  const args = parseArgs(argv);
  if ("error" in args) {
    deps.error(args.error);
    deps.log(USAGE);
    return 1;
  }
  const rating = LIEM.entry.rating;
  const pairings = pairingsFor(args, rating);
  const plan = gamePlan(args.games, OPENINGS.length);
  const jobs = pairings.flatMap((pairing, p) => plan.map((g) => ({ pairing, p, g })));
  deps.log(
    `Calibrating steps ${args.steps.join(", ")}: ${pairings.length} pairings x ${args.games} games ` +
      `= ${jobs.length} games, ${args.jobs} at a time, seed ${args.seed}, anchors ${args.anchors.join(",") || "none"} ` +
      `at ${ANCHOR_MOVETIME_MS} ms a move`
  );

  const records: GameRecord[][] = pairings.map(() => []);
  const started = deps.now();
  let next = 0;
  let finished = 0;

  async function playOne(job: (typeof jobs)[number]): Promise<void> {
    const { pairing, p, g } = job;
    const key = `${args.seed}|${p}|${pairing.label}|${g.game}`;
    const ours = stepPlayer(pairing.step, deps.startEngine(), seeded(hash(`${key}|a`)));
    const rival =
      pairing.rival.kind === "anchor"
        ? createAnchor(deps.startEngine(), { elo: pairing.rival.elo, movetimeMs: ANCHOR_MOVETIME_MS })
        : stepPlayer(pairing.rival.step, deps.startEngine(), seeded(hash(`${key}|b`)));
    try {
      const [white, black] = g.aWhite ? [ours, rival] : [rival, ours];
      const record = await playGame(white, black, OPENINGS[g.opening], { now: deps.now });
      records[p][g.game] = record;
      finished += 1;
      const outcome = record.end === "error" ? `error (${record.error})` : record.winner ?? "draw";
      deps.log(
        `[${finished}/${jobs.length}] step ${pairing.step} vs ${pairing.label}, game ${g.game + 1}: ` +
          `${record.white} - ${record.black}, ${record.opening}, ${outcome} by ${record.end} at ply ${record.plies}`
      );
    } finally {
      ours.dispose();
      rival.dispose();
    }
  }

  async function worker(): Promise<void> {
    while (next < jobs.length) await playOne(jobs[next++]);
  }
  await Promise.all(Array.from({ length: Math.min(args.jobs, jobs.length) }, worker));

  for (const step of args.steps) {
    const rows = pairings
      .map((pairing, p) => ({ pairing, p }))
      .filter(({ pairing }) => pairing.step === step)
      .map(({ pairing, p }) => ({
        pairing,
        result: summarize(`step ${step}`, pairing.label, records[p], STEP_PROFILES[step].maxLoss),
      }));
    stepTable(step, rows, rating).forEach((line) => deps.log(line));
  }
  deps.log("");
  deps.log(`Done in ${((deps.now() - started) / 60000).toFixed(1)} min.`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runCalibrate(process.argv.slice(2), {
    log: (line) => console.log(line),
    error: (line) => console.error(line),
    startEngine: spawnStockfish,
    now: () => performance.now(),
  }).then((code) => {
    process.exitCode = code;
  });
}
