// The public Lichess API for `npm run baseline`: a polite client (one request
// at a time, a gap between requests, no token or cookie), the arena and game
// endpoints, and turning an analysed Lichess game into a `GradedGame`.
// All network access goes through the injected `fetch`, so tests never touch it.
import { Chess } from "chess.js";
import { applyMove } from "../../src/game/engine/engine";
import { GameState, initialGameState } from "../../src/game/engine/game-state";
import { uciToMove } from "../../src/game/opponent/position";
import { terminalEval } from "../../src/game/review/analysis-runner";
import { fetchText, type HttpDeps, type TextCache } from "../book/sources";
import type { GradedGame, Score, Side } from "./rates";

/** Wait at least this long after one request ends before the next starts. */
export const MIN_GAP_MS = 1500;
/** Names the tool only; no account, address or person. */
export const USER_AGENT = "chess-web-baseline/1.0";
/** Lichess gives no eval before the first ply; this stands in for it. */
export const START_EVAL: Score = { cp: 15 };

const LICHESS = "https://lichess.org";
const SPEEDS = ["blitz", "rapid"] as const;
export type Speed = (typeof SPEEDS)[number];

export interface LichessPlayer {
  user?: { name: string; id: string };
  rating?: number;
  analysis?: { accuracy?: number };
}

/** One row of the game export (NDJSON). `moves` is SAN; `analysis[i]` is the eval after ply i, White's view. */
export interface LichessGame {
  id: string;
  rated: boolean;
  variant: string;
  speed: string;
  status: string;
  players: { white: LichessPlayer; black: LichessPlayer };
  moves: string;
  analysis?: { eval?: number; mate?: number }[];
}

/** A Lichess game ready to measure. It keeps no name or id. */
export interface BaselineGame extends GradedGame {
  speed: Speed;
  ratings: Record<Side, number>;
  /** Lichess's own per-player accuracy. */
  accuracy: Record<Side, number | null>;
}

/** `skipped`: not a rated standard blitz or rapid game; `dropped`: an eval is missing or a move doesn't replay. */
export type Converted =
  | { kind: "ok"; game: BaselineGame }
  | { kind: "dropped" }
  | { kind: "skipped" };

/** A candidate game; `game` is null when it was dropped. */
export interface PoolGame {
  ratings: Record<Side, number>;
  speed: Speed;
  game: BaselineGame | null;
}

export interface Selection {
  ratingMin: number;
  ratingMax: number;
  games: BaselineGame[];
  /** Games in the band that were dropped for a missing eval. */
  droppedGames: number;
  speeds: Record<Speed, number>;
  lowSample: boolean;
}

export interface ClientDeps {
  fetch: typeof globalThis.fetch;
  sleep: (ms: number) => Promise<void>;
  /** Milliseconds. */
  now: () => number;
  cache?: TextCache;
}

export interface LichessClient {
  get(url: string, accept: string): Promise<string>;
}

export function parseNdjson<T>(text: string): T[] {
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as T);
}

/** A file name for a URL: its path and query with anything unusual as `_`. */
function cacheKey(url: string): string {
  return url.replace(/^https?:\/\/[^/]+\//, "").replace(/[^A-Za-z0-9._-]+/g, "_") + ".txt";
}

/**
 * GETs through `fetchText` (429 waits and retries), one request at a time and
 * at least `MIN_GAP_MS` after the last one ended. Only `User-Agent` and
 * `Accept` are sent. Cached downloads are read back without a request.
 */
export function createClient(deps: ClientDeps): LichessClient {
  let chain: Promise<unknown> = Promise.resolve();
  let lastEnd: number | null = null;
  const http: HttpDeps = {
    // fetchText names the book importer; this tool sends its own plain name.
    fetch: (input, init) =>
      deps.fetch(input, {
        ...init,
        headers: { ...(init?.headers as Record<string, string>), "User-Agent": USER_AGENT },
      }),
    sleep: deps.sleep,
  };

  async function run(url: string, accept: string): Promise<string> {
    const key = cacheKey(url);
    const cached = (await deps.cache?.read(key)) ?? null;
    if (cached !== null) return cached;
    if (lastEnd !== null) {
      const wait = lastEnd + MIN_GAP_MS - deps.now();
      if (wait > 0) await deps.sleep(wait);
    }
    try {
      const text = await fetchText(url, http, accept);
      await deps.cache?.write(key, text);
      return text;
    } finally {
      lastEnd = deps.now();
    }
  }

  return {
    get(url, accept) {
      const next = chain.then(() => run(url, accept));
      chain = next.catch(() => undefined);
      return next;
    },
  };
}

/** Recent finished standard blitz and rapid arenas, newest first. */
export async function finishedArenas(client: LichessClient): Promise<string[]> {
  const list = JSON.parse(await client.get(`${LICHESS}/api/tournament`, "application/json")) as {
    finished?: { id: string; perf?: { key?: string }; variant?: { key?: string } }[];
  };
  return (list.finished ?? [])
    .filter((t) => SPEEDS.includes(t.perf?.key as Speed) && t.variant?.key === "standard")
    .map((t) => t.id);
}

/** All of an arena's players, with their rating in it. */
export async function arenaPlayers(
  client: LichessClient,
  id: string
): Promise<{ username: string; rating: number }[]> {
  const url = `${LICHESS}/api/tournament/${encodeURIComponent(id)}/results`;
  return parseNdjson<{ username?: string; rating?: number }>(
    await client.get(url, "application/x-ndjson")
  ).flatMap((r) =>
    typeof r.username === "string" && typeof r.rating === "number"
      ? [{ username: r.username, rating: r.rating }]
      : []
  );
}

/** A player's latest rated, analysed blitz and rapid games, with evals and accuracy. */
export function userGamesUrl(user: string, max: number): string {
  const q = new URLSearchParams({
    max: String(max),
    rated: "true",
    perfType: "blitz,rapid",
    analysed: "true",
    evals: "true",
    accuracy: "true",
    moves: "true",
    clocks: "false",
    opening: "false",
  });
  return `${LICHESS}/api/games/user/${encodeURIComponent(user)}?${q}`;
}

export async function userGames(client: LichessClient, user: string, max: number): Promise<LichessGame[]> {
  return parseNdjson<LichessGame>(await client.get(userGamesUrl(user, max), "application/x-ndjson"));
}

const negate = (s: Score): Score => ("mate" in s ? { mate: -s.mate } : { cp: -s.cp || 0 });

/** SAN to UCI with chess.js, checked against our rules engine; `null` if any move fails. */
function replay(sans: string[]): { uci: string[]; states: GameState[] } | null {
  const chess = new Chess();
  const uci: string[] = [];
  const states = [initialGameState()];
  try {
    for (const san of sans) {
      const m = chess.move(san);
      const u = m.from + m.to + (m.promotion ?? "");
      const move = uciToMove(states[states.length - 1], u);
      if (move === null) return null;
      uci.push(u);
      states.push(applyMove(states[states.length - 1], move));
    }
  } catch {
    return null;
  }
  return { uci, states };
}

/**
 * An analysed Lichess game as a `BaselineGame`, graded from ply `skipPlies`.
 * Lichess's eval after ply i (White's view) becomes the side-to-move eval
 * before ply i + 1. A checkmate or stalemate at the end gets its terminal
 * eval. A missing eval before the last ply drops the game; a missing last
 * eval in a live position leaves that ply out.
 */
export function toBaselineGame(raw: LichessGame, skipPlies: number): Converted {
  const white = raw.players?.white;
  const black = raw.players?.black;
  if (
    !raw.rated ||
    raw.variant !== "standard" ||
    !SPEEDS.includes(raw.speed as Speed) ||
    typeof white?.rating !== "number" ||
    typeof black?.rating !== "number"
  ) {
    return { kind: "skipped" };
  }
  const analysis = raw.analysis;
  if (!Array.isArray(analysis)) return { kind: "dropped" };
  const played = replay((raw.moves ?? "").split(" ").filter(Boolean));
  if (played === null) return { kind: "dropped" };
  const { uci, states } = played;

  const evals: Score[] = [START_EVAL];
  for (let i = 0; i < uci.length; i++) {
    const terminal = terminalEval(states[i + 1]);
    if (terminal !== null) {
      evals.push(terminal.score);
      continue;
    }
    const a = analysis[i];
    const score: Score | null =
      typeof a?.eval === "number" ? { cp: a.eval } : typeof a?.mate === "number" ? { mate: a.mate } : null;
    if (score === null) {
      if (i < uci.length - 1) return { kind: "dropped" };
      uci.pop();
      break;
    }
    const whiteToMove = (i + 1) % 2 === 0;
    evals.push(whiteToMove ? score : negate(score));
  }

  const accuracy = (p: LichessPlayer) =>
    typeof p.analysis?.accuracy === "number" ? p.analysis.accuracy : null;
  return {
    kind: "ok",
    game: {
      uci,
      evals,
      graded: uci.map((_, i) => i >= skipPlies),
      sides: ["white", "black"],
      speed: raw.speed as Speed,
      ratings: { white: white.rating, black: black.rating },
      accuracy: { white: accuracy(white), black: accuracy(black) },
    },
  };
}

/** Games kept below this at ±100 widen the band to ±150; below it at ±150 is a low sample. */
export const MIN_GAMES = 30;
export const BAND = 100;
export const WIDE_BAND = 150;

const inBand = (g: PoolGame, level: number, width: number) =>
  Math.abs(g.ratings.white - level) <= width && Math.abs(g.ratings.black - level) <= width;

/**
 * The games for one level: both players within ±100 of it (edges included),
 * widened to ±150 when fewer than 30 are kept. Rapid first, then blitz, up
 * to `max`.
 */
export function selectGames(pool: readonly PoolGame[], level: number, max: number): Selection {
  const keptAt = (width: number) =>
    pool.filter((g) => g.game !== null && inBand(g, level, width)).map((g) => g.game as BaselineGame);
  let width = BAND;
  let kept = keptAt(width);
  if (kept.length < MIN_GAMES) {
    width = WIDE_BAND;
    kept = keptAt(width);
  }
  const ordered = [
    ...kept.filter((g) => g.speed === "rapid"),
    ...kept.filter((g) => g.speed === "blitz"),
  ].slice(0, max);
  return {
    ratingMin: level - width,
    ratingMax: level + width,
    games: ordered,
    droppedGames: pool.filter((g) => g.game === null && inBand(g, level, width)).length,
    speeds: {
      blitz: ordered.filter((g) => g.speed === "blitz").length,
      rapid: ordered.filter((g) => g.speed === "rapid").length,
    },
    lowSample: kept.length < MIN_GAMES,
  };
}
