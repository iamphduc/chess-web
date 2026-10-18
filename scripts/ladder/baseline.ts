// Stub: filled in by the feat commit.
import type { LichessClient, Speed } from "./lichess";
import type { LevelRates } from "./rates";

export const SPARRING_LEVELS: readonly number[] = [];

export interface BaselineOptions {
  games: number;
  skipPlies: number;
  levels: number[];
  maxUsers: number;
  perUser: number;
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

export interface BaselineFile {
  format: 1;
  generated: string;
  source: string;
  skipPlies: number;
  levels: Partial<Record<"1400" | "1700" | "1900" | "2100" | "2300" | "2500", LevelBaseline>>;
}

export interface BaselineDeps {
  client: LichessClient;
  today: () => Date;
  log: (line: string) => void;
}

export function parseArgs(_argv: readonly string[]): BaselineOptions {
  return { games: 0, skipPlies: 0, levels: [], maxUsers: 0, perUser: 0, maxArenas: 0 };
}

export async function runBaseline(_opts: BaselineOptions, _deps: BaselineDeps): Promise<BaselineFile> {
  return { format: 1, generated: "", source: "", skipPlies: 0, levels: {} };
}

export function serializeBaseline(_file: BaselineFile): string {
  return "{}";
}

export function summaryLines(_file: BaselineFile): string[] {
  return [];
}
