// Relative imports only, like the rest of src/game/.
import type { GameState } from "../engine/game-state";
import type { Score, SearchLimits } from "../opponent/engine/lines";
import type { Analysis } from "../opponent/engine/move-engine";

/** One position's eval from the side to move's view; `best` is UCI, null for a terminal position. */
export interface PositionEval {
  score: Score;
  best: string | null;
}

export interface ReviewEngine {
  analyse(fen: string, limits: SearchLimits, signal?: AbortSignal): Promise<Analysis>;
}

export interface AnalysisRunner {
  start(
    positions: readonly GameState[],
    from: number,
    onEval: (index: number, e: PositionEval) => void
  ): Promise<"done" | "stopped">;
  check(state: GameState): Promise<PositionEval>;
  stop(): void;
}

export function createAnalysisRunner(_deps: { engine: ReviewEngine; limits: SearchLimits }): AnalysisRunner {
  return {
    start: () => Promise.reject(new Error("not built")),
    check: () => Promise.reject(new Error("not built")),
    stop: () => {},
  };
}
