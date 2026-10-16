// Relative imports only, like the rest of src/game/.
import type { GameState } from "../engine/game-state";
import { gameStatus } from "../engine/game-status";
import type { Score, SearchLimits } from "../opponent/engine/lines";
import { EngineError, type Analysis } from "../opponent/engine/move-engine";
import { toFen } from "../opponent/position";

/** One position's eval from the side to move's view; `best` is UCI, null for a terminal position. */
export interface PositionEval {
  score: Score;
  best: string | null;
}

/** What the runner searches with (his controller's `analyse` in the app). */
export interface ReviewEngine {
  analyse(fen: string, limits: SearchLimits, signal?: AbortSignal): Promise<Analysis>;
}

export interface AnalysisRunner {
  /**
   * Evaluates `positions[from..]` in index order, one search at a time,
   * sending each eval to `onEval`. Resolves `"done"`, or `"stopped"` after
   * `stop()` or a newer `start`. An engine error rejects it; evals already
   * sent stay. A negative or fractional `from` rejects with a RangeError.
   */
  start(
    positions: readonly GameState[],
    from: number,
    onEval: (index: number, e: PositionEval) => void
  ): Promise<"done" | "stopped">;
  /** One position's eval, searched next, before the pass's next search. */
  check(state: GameState): Promise<PositionEval>;
  /** Aborts the search in flight and the pass; pending checks reject `EngineError("aborted")`. */
  stop(): void;
}

/** A checkmate or stalemate's eval, or null when the side to move has a move. */
export function terminalEval(state: GameState): PositionEval | null {
  const status = gameStatus(state);
  if (status === "checkmate") return { score: { mate: 0 }, best: null };
  if (status === "stalemate") return { score: { cp: 0 }, best: null };
  return null;
}

/** The analysis's top line as an eval; no lines for a live position is a failed search. */
function evalOf(analysis: Analysis): PositionEval {
  const top = analysis.lines[0];
  if (top === undefined) throw new EngineError("failed", "the search returned no lines");
  return { score: top.score, best: top.move };
}

/**
 * Runs the review's searches on one engine, one at a time: the pass over the
 * game in index order, with checks of tried moves jumping ahead of its next
 * search. Terminal positions are filled in with no search.
 */
export function createAnalysisRunner(deps: { engine: ReviewEngine; limits: SearchLimits }): AnalysisRunner {
  const { engine, limits } = deps;

  /** Whether a search is in flight; at most one ever is. */
  let busy = false;
  /** Checks waiting for the engine, in the order asked; they go before the pass. */
  const checks: (() => void)[] = [];
  /** The pass waiting for the engine, if any. */
  let passWaiting: (() => void) | null = null;
  /** Aborts everything started since the last stop. */
  let epoch = new AbortController();
  /** The running pass's own abort, so a newer start can stop it alone. */
  let pass: AbortController | null = null;

  /** Waits for the engine; checks before the pass. Resolves false when `signal` aborts first. */
  function acquire(signal: AbortSignal, isCheck: boolean): Promise<boolean> {
    if (signal.aborted) return Promise.resolve(false);
    if (!busy) {
      busy = true;
      return Promise.resolve(true);
    }
    return new Promise<boolean>((resolve) => {
      const go = () => {
        signal.removeEventListener("abort", onAbort);
        resolve(true);
      };
      const onAbort = () => {
        if (isCheck) {
          const at = checks.indexOf(go);
          if (at >= 0) checks.splice(at, 1);
        } else if (passWaiting === go) {
          passWaiting = null;
        }
        resolve(false);
      };
      signal.addEventListener("abort", onAbort);
      if (isCheck) checks.push(go);
      else passWaiting = go;
    });
  }

  function release(): void {
    const next = checks.shift() ?? passWaiting;
    if (next === passWaiting) passWaiting = null;
    if (next) next();
    else busy = false;
  }

  /** One search of `state` under `signal`; resolves null when aborted before or during it. */
  async function search(state: GameState, signal: AbortSignal, isCheck: boolean): Promise<PositionEval | null> {
    if (!(await acquire(signal, isCheck))) return null;
    try {
      let analysis: Analysis;
      try {
        analysis = await engine.analyse(toFen(state), limits, signal);
      } catch (error) {
        if (signal.aborted) return null;
        throw error;
      }
      if (signal.aborted) return null;
      return evalOf(analysis);
    } finally {
      release();
    }
  }

  /** A signal that aborts when any of `signals` does. */
  function either(...signals: AbortSignal[]): AbortController {
    const both = new AbortController();
    for (const s of signals) {
      if (s.aborted) both.abort();
      else s.addEventListener("abort", () => both.abort(), { once: true });
    }
    return both;
  }

  return {
    async start(positions, from, onEval) {
      if (!Number.isInteger(from) || from < 0) {
        throw new RangeError(`from must be a whole number from 0, got ${from}`);
      }
      pass?.abort();
      const own = new AbortController();
      pass = own;
      const signal = either(epoch.signal, own.signal).signal;
      try {
        for (let i = from; i < positions.length; i++) {
          if (signal.aborted) return "stopped";
          const state = positions[i];
          const e = terminalEval(state) ?? (await search(state, signal, false));
          if (e === null || signal.aborted) return "stopped";
          onEval(i, e);
        }
        return signal.aborted ? "stopped" : "done";
      } finally {
        if (pass === own) pass = null;
      }
    },

    async check(state) {
      const terminal = terminalEval(state);
      if (terminal !== null) return terminal;
      const signal = epoch.signal;
      const e = await search(state, signal, true);
      if (e === null) throw new EngineError("aborted");
      return e;
    },

    stop() {
      epoch.abort();
      epoch = new AbortController();
      pass = null;
    },
  };
}
