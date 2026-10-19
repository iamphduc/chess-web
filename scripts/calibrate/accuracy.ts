// The optional accuracy column of `npm run calibrate -- --measure`: the review's
// game accuracy, when `src/game/review/game-accuracy.ts` is on the branch. The
// formula lives only there; this file loads it, never copies it.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Score } from "../../src/game/opponent/engine/lines";
import type { GradedGame, Side } from "../ladder/rates";

/** A game's accuracy for one side, or null. */
export type AccuracyFn = (game: GradedGame, side: Side) => number | null;

/** What the loader expects the module to export. */
interface GameAccuracyModule {
  gameAccuracy(whiteWins: readonly (number | null)[], movers: readonly Side[], color: Side): number | null;
  lichessWinPercent(score: Score, sideToMove: Side): number;
  LICHESS_START_WIN?: number;
}

export interface AccuracyLoaderDeps {
  exists(): boolean;
  load(): Promise<unknown>;
}

const MODULE_URL = new URL("../../src/game/review/game-accuracy.ts", import.meta.url);

/** The real file system check and dynamic import. */
export const realAccuracyLoader: AccuracyLoaderDeps = {
  exists: () => existsSync(fileURLToPath(MODULE_URL)),
  load: () => import(/* @vite-ignore */ pathToFileURL(fileURLToPath(MODULE_URL)).href),
};

function isModule(m: unknown): m is GameAccuracyModule {
  const x = m as Partial<GameAccuracyModule> | null;
  return typeof x?.gameAccuracy === "function" && typeof x.lichessWinPercent === "function";
}

/**
 * The game accuracy as `measureGames` takes it, or null when the file is
 * missing or doesn't export what's needed. White's win % per position comes
 * from the module's own `lichessWinPercent`; the start uses its
 * `LICHESS_START_WIN` when it has one.
 */
export async function loadAccuracy(deps: AccuracyLoaderDeps = realAccuracyLoader): Promise<AccuracyFn | null> {
  if (!deps.exists()) return null;
  const m = await deps.load();
  if (!isModule(m)) return null;
  return (game, side) => {
    const wins = game.evals.map((score, i) => m.lichessWinPercent(score, i % 2 === 0 ? "white" : "black"));
    if (m.LICHESS_START_WIN !== undefined && wins.length > 0) wins[0] = m.LICHESS_START_WIN;
    const movers = game.uci.map((_, i): Side => (i % 2 === 0 ? "white" : "black"));
    return m.gameAccuracy(wins, movers, side);
  };
}
