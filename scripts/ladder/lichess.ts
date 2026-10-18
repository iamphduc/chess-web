// Stub: filled in by the feat commit.
import type { TextCache } from "../book/sources";
import type { GradedGame, Score, Side } from "./rates";

export const MIN_GAP_MS = 0;
export const START_EVAL: Score = { cp: 0 };

export type Speed = "blitz" | "rapid";

export interface LichessPlayer {
  user?: { name: string; id: string };
  rating?: number;
  analysis?: { accuracy?: number };
}

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

export interface BaselineGame extends GradedGame {
  speed: Speed;
  ratings: Record<Side, number>;
  accuracy: Record<Side, number | null>;
}

export type Converted = { kind: "ok"; game: BaselineGame } | { kind: "dropped" } | { kind: "skipped" };

export interface PoolGame {
  ratings: Record<Side, number>;
  speed: Speed;
  game: BaselineGame | null;
}

export interface Selection {
  ratingMin: number;
  ratingMax: number;
  games: BaselineGame[];
  droppedGames: number;
  speeds: Record<Speed, number>;
  lowSample: boolean;
}

export interface ClientDeps {
  fetch: typeof globalThis.fetch;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  cache?: TextCache;
}

export interface LichessClient {
  get(url: string, accept: string): Promise<string>;
}

export function parseNdjson<T>(_text: string): T[] {
  return [];
}

export function createClient(_deps: ClientDeps): LichessClient {
  return { get: async () => "" };
}

export function userGamesUrl(_user: string, _max: number): string {
  return "https://example.com/";
}

export function toBaselineGame(_raw: LichessGame, _skipPlies: number): Converted {
  return { kind: "skipped" };
}

export function selectGames(_pool: readonly PoolGame[], _level: number, _max: number): Selection {
  return {
    ratingMin: 0,
    ratingMax: 0,
    games: [],
    droppedGames: -1,
    speeds: { blitz: 0, rapid: 0 },
    lowSample: false,
  };
}
