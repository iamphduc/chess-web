// `npm run baseline`: how often real Lichess players near each sparring level
// make inaccuracies, mistakes and blunders, written to human-baselines.json.
// Dev-only: it calls the public Lichess API by hand, never in tests or CI.
// The file keeps no usernames, game ids, game dates or moves.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { TextCache } from "../book/sources";
import {
  arenaPlayers,
  createClient,
  finishedArenas,
  LichessClient,
  LichessGame,
  PoolGame,
  selectGames,
  Speed,
  toBaselineGame,
  userGames,
  WIDE_BAND,
  BAND,
} from "./lichess";
import { LevelRates, measureGames } from "./rates";

export const SPARRING_LEVELS: readonly number[] = [1400, 1700, 1900, 2100, 2300, 2500];

export interface BaselineOptions {
  /** Games kept per level. */
  games: number;
  /** Plies left ungraded at the start of each game (mostly book). */
  skipPlies: number;
  levels: number[];
  /** Players whose games are read, per level. */
  maxUsers: number;
  /** Games taken from one player, per level. */
  perUser: number;
  /** Arenas whose players are read. */
  maxArenas: number;
}

export interface LevelBaseline {
  ratingMin: number;
  ratingMax: number;
  games: number;
  droppedGames: number;
  speeds: Record<Speed, number>;
  lowSample: boolean;
  rates: LevelRates;
}

export type LevelKey = "1400" | "1700" | "1900" | "2100" | "2300" | "2500";

export interface BaselineFile {
  format: 1;
  generated: string;
  source: string;
  skipPlies: number;
  levels: Partial<Record<LevelKey, LevelBaseline>>;
}

export interface BaselineDeps {
  client: LichessClient;
  today: () => Date;
  log: (line: string) => void;
}

/** Games asked for per player request. */
const USER_GAMES_MAX = 30;

export const SOURCE =
  "Lichess public API, no login: rated standard blitz and rapid games with Lichess computer " +
  "analysis, from players in recent finished arenas; both players inside the rating band; " +
  "graded with the review's gradeMove from skipPlies on.";

const DEFAULTS: BaselineOptions = {
  games: 150,
  skipPlies: 10,
  levels: [...SPARRING_LEVELS],
  maxUsers: 60,
  perUser: 8,
  maxArenas: 25,
};

function wholeNumber(flag: string, raw: string | undefined, min: number): number {
  if (raw === undefined || !/^\d+$/.test(raw) || Number(raw) < min) {
    throw new Error(`${flag} needs a whole number of at least ${min}`);
  }
  return Number(raw);
}

export function parseArgs(argv: readonly string[]): BaselineOptions {
  const o: BaselineOptions = { ...DEFAULTS, levels: [...DEFAULTS.levels] };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    switch (flag) {
      case "--games":
        o.games = wholeNumber(flag, value, 1);
        break;
      case "--skip-plies":
        o.skipPlies = wholeNumber(flag, value, 0);
        break;
      case "--max-users":
        o.maxUsers = wholeNumber(flag, value, 1);
        break;
      case "--per-user":
        o.perUser = wholeNumber(flag, value, 1);
        break;
      case "--max-arenas":
        o.maxArenas = wholeNumber(flag, value, 1);
        break;
      case "--levels": {
        const levels = (value ?? "").split(",").map(Number);
        if (levels.length === 0 || levels.some((l) => !SPARRING_LEVELS.includes(l))) {
          throw new Error(`--levels takes some of ${SPARRING_LEVELS.join(",")}`);
        }
        o.levels = levels;
        break;
      }
      default:
        throw new Error(`unknown flag ${flag}`);
    }
    i++;
  }
  return o;
}

const near = (rating: number, level: number, width: number) => Math.abs(rating - level) <= width;

/** Arena players by name with their rating, read until every level has enough candidates. */
async function collectPlayers(opts: BaselineOptions, deps: BaselineDeps): Promise<Map<string, number>> {
  const arenas = await finishedArenas(deps.client);
  const players = new Map<string, number>();
  const enough = () =>
    opts.levels.every(
      (level) => [...players.values()].filter((r) => near(r, level, WIDE_BAND)).length >= opts.maxUsers
    );
  let read = 0;
  for (const id of arenas.slice(0, opts.maxArenas)) {
    if (enough()) break;
    try {
      for (const p of await arenaPlayers(deps.client, id)) {
        if (!players.has(p.username)) players.set(p.username, p.rating);
      }
      read++;
    } catch (err) {
      deps.log(`arena ${read + 1}: failed (${(err as Error).message.replace(/\/api\/.*/, "")})`);
    }
  }
  deps.log(`players: ${players.size} from ${read} of ${arenas.length} finished blitz and rapid arenas`);
  return players;
}

/**
 * The pool of candidate games for one level, read player by player: first the
 * arena players near the level (closest first), then the opponents met in
 * those players' games who are near it too, until enough games are kept
 * within ±100 or `maxUsers` players are read.
 */
async function collectLevel(
  level: number,
  players: Map<string, number>,
  memo: Map<string, LichessGame[]>,
  opts: BaselineOptions,
  deps: BaselineDeps
): Promise<PoolGame[]> {
  const queue = [...players.entries()]
    .filter(([, r]) => near(r, level, WIDE_BAND))
    .sort((a, b) => Math.abs(a[1] - level) - Math.abs(b[1] - level) || (a[0] < b[0] ? -1 : 1))
    .map(([name]) => name);
  const fromArenas = queue.length;
  const queued = new Set(queue.map((n) => n.toLowerCase()));
  const pool: PoolGame[] = [];
  const seen = new Set<string>();
  let keptAtBand = 0;
  let failed = 0;
  let u = 0;
  for (; u < queue.length && u < opts.maxUsers && keptAtBand < opts.games; u++) {
    const user = queue[u];
    let games = memo.get(user.toLowerCase());
    if (games === undefined) {
      try {
        games = await userGames(deps.client, user, USER_GAMES_MAX);
      } catch {
        games = [];
        failed++;
      }
      memo.set(user.toLowerCase(), games);
    }
    let added = 0;
    for (const raw of games) {
      for (const p of [raw.players?.white, raw.players?.black]) {
        const name = p?.user?.name;
        if (name === undefined || typeof p?.rating !== "number") continue;
        if (!near(p.rating, level, WIDE_BAND) || queued.has(name.toLowerCase())) continue;
        queued.add(name.toLowerCase());
        queue.push(name);
      }
      if (added >= opts.perUser || seen.has(raw.id)) continue;
      const converted = toBaselineGame(raw, opts.skipPlies);
      if (converted.kind === "skipped") continue;
      const ratings = {
        white: raw.players.white.rating as number,
        black: raw.players.black.rating as number,
      };
      if (!near(ratings.white, level, WIDE_BAND) || !near(ratings.black, level, WIDE_BAND)) continue;
      seen.add(raw.id);
      const game = converted.kind === "ok" ? converted.game : null;
      pool.push({ ratings, speed: raw.speed as Speed, game });
      if (game !== null && near(ratings.white, level, BAND) && near(ratings.black, level, BAND)) {
        keptAtBand++;
      }
      added++;
    }
    deps.log(
      `${level}: player ${u + 1} (${queue.length} known), +${added} games, ` +
        `${keptAtBand}/${opts.games} within ±${BAND}` +
        (failed > 0 ? `, ${failed} players failed` : "")
    );
  }
  deps.log(
    `${level}: read ${u} players (${fromArenas} from arenas, ${queue.length - fromArenas} met in games), ` +
      `${pool.length} games in ±${WIDE_BAND}`
  );
  return pool;
}

export async function runBaseline(opts: BaselineOptions, deps: BaselineDeps): Promise<BaselineFile> {
  const players = await collectPlayers(opts, deps);
  const memo = new Map<string, LichessGame[]>();
  const levels: BaselineFile["levels"] = {};
  for (const level of opts.levels) {
    const pool = await collectLevel(level, players, memo, opts, deps);
    const s = selectGames(pool, level, opts.games);
    if (s.games.length === 0) {
      deps.log(`${level}: no games kept, no baseline`);
      continue;
    }
    levels[String(level) as LevelKey] = {
      ratingMin: s.ratingMin,
      ratingMax: s.ratingMax,
      games: s.games.length,
      droppedGames: s.droppedGames,
      speeds: { blitz: s.speeds.blitz, rapid: s.speeds.rapid },
      lowSample: s.lowSample,
      rates: measureGames(s.games, { accuracy: (g, side) => g.accuracy[side] }),
    };
  }
  return {
    format: 1,
    generated: deps.today().toISOString().slice(0, 10),
    source: SOURCE,
    skipPlies: opts.skipPlies,
    levels,
  };
}

/** Byte-stable JSON: fixed key order, rates to 4 decimals, a trailing newline. */
export function serializeBaseline(file: BaselineFile): string {
  const round = (_key: string, v: unknown) =>
    typeof v === "number" && !Number.isInteger(v) ? Math.round(v * 1e4) / 1e4 : v;
  return `${JSON.stringify(file, round, 2)}\n`;
}

/** Reads a saved baseline file; null when missing, unreadable or not format 1. */
export function parseExistingBaseline(text: string | null): BaselineFile | null {
  if (text === null) return null;
  try {
    const f = JSON.parse(text) as Partial<BaselineFile> | null;
    if (f === null || f.format !== 1) return null;
    if (typeof f.levels !== "object" || f.levels === null || Array.isArray(f.levels)) return null;
    return f as BaselineFile;
  } catch {
    return null;
  }
}

/**
 * Puts the levels a run measured over the saved file and keeps the rest.
 * Levels come out in ascending order; the header comes from the new run.
 */
export function mergeBaseline(existing: BaselineFile | null, measured: BaselineFile): BaselineFile {
  const all = { ...existing?.levels, ...measured.levels };
  const levels: BaselineFile["levels"] = {};
  for (const level of SPARRING_LEVELS) {
    const key = String(level) as LevelKey;
    if (all[key] !== undefined) levels[key] = all[key];
  }
  return { ...measured, levels };
}

const fmt = (n: number | null, digits = 2) => (n === null ? "-" : n.toFixed(digits));

/** One line per sparring level, for the console and the PR body. */
export function summaryLines(file: BaselineFile): string[] {
  return SPARRING_LEVELS.map((level) => {
    const l = file.levels[String(level) as LevelKey];
    if (l === undefined) return `${level}: no baseline`;
    const r = l.rates;
    const g = (x: { inaccuracy: number | null; mistake: number | null; blunder: number | null }) =>
      `${fmt(x.inaccuracy)}/${fmt(x.mistake)}/${fmt(x.blunder)}`;
    return (
      `${level}: ${l.games} games (${l.ratingMin}-${l.ratingMax}, rapid ${l.speeds.rapid}, ` +
      `blitz ${l.speeds.blitz}, dropped ${l.droppedGames})${l.lowSample ? " LOW SAMPLE" : ""}, ` +
      `${r.gradedMoves} moves | per 40 ?!/?/?? review ${g(r.per40.review)}, ` +
      `lichess ${g(r.per40.lichess)} | hung ${fmt(r.per40.hung)}, missed capture ` +
      `${fmt(r.per40.missedCapture)} | avg loss ${fmt(r.avgLoss)} | accuracy ${fmt(r.accuracy, 1)}`
    );
  });
}

// --- CLI glue: real network, file system and console. ---

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const CACHE_DIR = join(ROOT, "games/baseline-cache");
const OUT = join(ROOT, "scripts/ladder/human-baselines.json");
/** A request that hangs this long fails (and that player is skipped). */
const REQUEST_TIMEOUT_MS = 180_000;

const fileCache: TextCache = {
  read: (key) => readFile(join(CACHE_DIR, key), "utf8").catch(() => null),
  write: async (key, text) => {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(join(CACHE_DIR, key), text);
  },
};

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const started = Date.now();
  const client = createClient({
    fetch: (input, init) =>
      globalThis.fetch(input, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => Date.now(),
    cache: fileCache,
  });
  const file = await runBaseline(opts, {
    client,
    today: () => new Date(),
    log: (line) => console.log(line),
  });
  // A run of some levels merges into the saved file; a run of all six writes it whole.
  const partial = SPARRING_LEVELS.some((l) => !opts.levels.includes(l));
  const existing = partial
    ? parseExistingBaseline(await readFile(OUT, "utf8").catch(() => null))
    : null;
  await writeFile(OUT, serializeBaseline(partial ? mergeBaseline(existing, file) : file));
  console.log(`\nwrote ${OUT} in ${Math.round((Date.now() - started) / 60_000)} min`);
  for (const line of summaryLines(partial ? mergeBaseline(existing, file) : file)) console.log(line);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
