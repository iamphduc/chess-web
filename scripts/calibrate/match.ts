// Plays calibration games between two players and scores them. Pure: the
// players are injected, so the tests use fakes and calibrate.ts uses engines.
import { applyMove } from "../../src/game/engine/engine";
import { initialGameState, type GameState } from "../../src/game/engine/game-state";
import { gameStatus } from "../../src/game/engine/game-status";
import type { EngineLine } from "../../src/game/opponent/engine/lines";
import { winPercent } from "../../src/game/opponent/human-move";
import { uciToMove } from "../../src/game/opponent/position";

/** A game is a draw once this many plies (opening moves included) are played. */
export const MAX_PLIES = 200;

/** A fixed start: UCI moves from the initial position, White to move after them. */
export interface Opening {
  name: string;
  moves: readonly string[];
}

/** Short, balanced openings, cycled through the games of a pairing. */
export const OPENINGS: readonly Opening[] = [
  { name: "Italian", moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5"] },
  { name: "Queen's Gambit Declined", moves: ["d2d4", "d7d5", "c2c4", "e7e6", "b1c3", "g8f6"] },
  { name: "Sicilian", moves: ["e2e4", "c7c5", "g1f3", "d7d6", "d2d4", "c5d4"] },
  { name: "King's Indian", moves: ["d2d4", "g8f6", "c2c4", "g7g6", "b1c3", "f8g7"] },
  { name: "English", moves: ["c2c4", "e7e5", "b1c3", "g8f6", "g1f3", "b8c6"] },
  { name: "French", moves: ["e2e4", "e7e6", "d2d4", "d7d5", "b1c3", "g8f6"] },
  { name: "Caro-Kann", moves: ["e2e4", "c7c6", "d2d4", "d7d5", "e4e5", "c8f5"] },
  { name: "Slav", moves: ["d2d4", "d7d5", "c2c4", "c7c6", "g1f3", "g8f6"] },
];

/** One move a player made, with the analysis behind it when it has one. */
export interface MovePlayed {
  uci: string;
  /** The scored lines the move was chosen from; absent or empty = not scored. */
  lines?: readonly EngineLine[];
}

export interface MatchPlayer {
  readonly name: string;
  /** A move whose loss is above this counts as a slip. Absent = no slip rate (anchors). */
  readonly slipAbove?: number;
  /** Called before each game. */
  newGame(): void;
  move(state: GameState): Promise<MovePlayed>;
}

export type GameEnd = "checkmate" | "stalemate" | "ply-cap" | "error";

export interface MoveStat {
  ms: number;
  /** Win % points lost against the move's own best line; null = not scored. */
  loss: number | null;
}

export interface GameRecord {
  white: string;
  black: string;
  opening: string;
  /** Plies played, opening moves included. */
  plies: number;
  end: GameEnd;
  winner: "white" | "black" | null;
  /** Set when `end` is "error". */
  error?: string;
  /** The first three moves of the game, for checking the setup. */
  firstMoves: string[];
  moves: { white: MoveStat[]; black: MoveStat[] };
}

/**
 * The played move's loss in win % points: the best win % among `lines`
 * minus the played line's. Null when the move isn't in `lines` (a book move,
 * or the engine's bestmove fallback).
 */
export function moveLoss(uci: string, lines: readonly EngineLine[] | undefined): number | null {
  if (!lines || lines.length === 0) return null;
  const played = lines.find((l) => l.move === uci);
  if (!played) return null;
  const best = Math.max(...lines.map((l) => winPercent(l.score)));
  return best - winPercent(played.score);
}

/**
 * The Elo gap that `points` out of `games` suggests, `-400·log10(1/s − 1)`,
 * with `s` clamped to [0.5/n, 1 − 0.5/n] so 0 % and 100 % stay finite. Null
 * when no game was scored.
 */
export function eloGap(points: number, games: number): number | null {
  if (games <= 0) return null;
  const s = Math.min(Math.max(points / games, 0.5 / games), 1 - 0.5 / games);
  return -400 * Math.log10(1 / s - 1);
}

export interface PlannedGame {
  game: number;
  /** Index into the openings list. */
  opening: number;
  /** Whether player A has White. */
  aWhite: boolean;
}

/**
 * Which opening and colors each game uses: every opening is played twice,
 * once with each color, then the list starts over.
 */
export function gamePlan(games: number, openings: number): PlannedGame[] {
  if (!Number.isInteger(games) || games < 1) {
    throw new RangeError(`games must be a whole number of 1 or more, got ${games}`);
  }
  if (!Number.isInteger(openings) || openings < 1) {
    throw new RangeError(`need at least one opening, got ${openings}`);
  }
  return Array.from({ length: games }, (_, game) => ({
    game,
    opening: Math.floor(game / 2) % openings,
    aWhite: game % 2 === 0,
  }));
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Plays one game from `opening`. It ends on checkmate or stalemate (our rules
 * engine), or as a draw at `maxPlies`. A player that throws or answers an
 * illegal move ends the game as an error.
 */
export async function playGame(
  white: MatchPlayer,
  black: MatchPlayer,
  opening: Opening,
  options: { maxPlies?: number; now?: () => number } = {}
): Promise<GameRecord> {
  const { maxPlies = MAX_PLIES, now = () => performance.now() } = options;
  let state = initialGameState();
  const firstMoves: string[] = [];
  for (const uci of opening.moves) {
    const move = uciToMove(state, uci);
    if (move === null) throw new Error(`opening ${opening.name}: ${uci} is not legal`);
    state = applyMove(state, move);
    if (firstMoves.length < 3) firstMoves.push(uci);
  }

  const record: GameRecord = {
    white: white.name,
    black: black.name,
    opening: opening.name,
    plies: opening.moves.length,
    end: "ply-cap",
    winner: null,
    firstMoves,
    moves: { white: [], black: [] },
  };
  white.newGame();
  black.newGame();

  for (;;) {
    const status = gameStatus(state);
    if (status === "checkmate") {
      record.end = "checkmate";
      record.winner = state.turn === "white" ? "black" : "white";
      return record;
    }
    if (status === "stalemate") {
      record.end = "stalemate";
      return record;
    }
    if (record.plies >= maxPlies) return record;

    const side = state.turn;
    const player = side === "white" ? white : black;
    let played: MovePlayed;
    const start = now();
    try {
      played = await player.move(state);
    } catch (error) {
      record.end = "error";
      record.error = `${player.name}: ${message(error)}`;
      return record;
    }
    const ms = now() - start;
    const move = uciToMove(state, played.uci);
    if (move === null) {
      record.end = "error";
      record.error = `${player.name}: illegal move ${played.uci}`;
      return record;
    }
    record.moves[side].push({ ms, loss: moveLoss(played.uci, played.lines) });
    if (firstMoves.length < 3) firstMoves.push(played.uci);
    state = applyMove(state, move);
    record.plies += 1;
  }
}

export interface PairingResult {
  a: string;
  b: string;
  /** From A's view. */
  wins: number;
  draws: number;
  losses: number;
  errors: number;
  /** Games scored (errors left out). */
  played: number;
  /** A's points per scored game, 0 to 1; null when none was scored. */
  score: number | null;
  /** A's Elo gap over B; null when none was scored. */
  eloGap: number | null;
  /** A's moves with a loss (moves in their own lines). */
  scoredMoves: number;
  /** Mean of A's loss per scored move, win % points; null when A has no slip limit or no scored move. */
  avgLoss: number | null;
  maxLoss: number | null;
  /** Share of A's scored moves with a loss above `slipAbove`. */
  slipRate: number | null;
  /** A's think time per move, every move (errors' games included). */
  avgMs: number | null;
  maxMs: number | null;
  errorMessages: string[];
  records: GameRecord[];
}

/** Tallies `records` from A's view. `slipAbove` is A's slip limit, if it has one. */
export function summarize(
  a: string,
  b: string,
  records: readonly GameRecord[],
  slipAbove?: number
): PairingResult {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  const errorMessages: string[] = [];
  const losses_: number[] = [];
  const times: number[] = [];
  for (const r of records) {
    const aSide = r.white === a ? "white" : "black";
    for (const m of r.moves[aSide]) {
      times.push(m.ms);
      if (m.loss !== null) losses_.push(m.loss);
    }
    if (r.end === "error") {
      errorMessages.push(r.error ?? "error");
    } else if (r.winner === null) {
      draws += 1;
    } else if (r.winner === aSide) {
      wins += 1;
    } else {
      losses += 1;
    }
  }
  const played = wins + draws + losses;
  const points = wins + draws / 2;
  const mean = (xs: number[]) => (xs.length === 0 ? null : xs.reduce((s, x) => s + x, 0) / xs.length);
  const scored = slipAbove === undefined ? [] : losses_;
  return {
    a,
    b,
    wins,
    draws,
    losses,
    errors: errorMessages.length,
    played,
    score: played === 0 ? null : points / played,
    eloGap: eloGap(points, played),
    scoredMoves: scored.length,
    avgLoss: mean(scored),
    maxLoss: scored.length === 0 ? null : Math.max(...scored),
    slipRate:
      slipAbove === undefined || scored.length === 0
        ? null
        : scored.filter((x) => x > slipAbove).length / scored.length,
    avgMs: mean(times),
    maxMs: times.length === 0 ? null : Math.max(...times),
    errorMessages,
    records: [...records],
  };
}

/** Plays `games` games between A and B in turn (see `gamePlan`) and tallies them. */
export async function playMatch(options: {
  a: MatchPlayer;
  b: MatchPlayer;
  games: number;
  openings?: readonly Opening[];
  maxPlies?: number;
  now?: () => number;
}): Promise<PairingResult> {
  const { a, b, games, openings = OPENINGS, maxPlies, now } = options;
  const plan = gamePlan(games, openings.length);
  const records: GameRecord[] = [];
  for (const g of plan) {
    const [white, black] = g.aWhite ? [a, b] : [b, a];
    records.push(await playGame(white, black, openings[g.opening], { maxPlies, now }));
  }
  return summarize(a.name, b.name, records, a.slipAbove);
}
