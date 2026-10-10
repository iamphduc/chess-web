import { EngineError, type EngineErrorCode, type MoveEngine } from "./move-engine";

/** A line-based pipe to a UCI engine (a Web Worker, or Stockfish in Node). */
export interface UciTransport {
  send(line: string): void;
  onLine(cb: (line: string) => void): void;
  onError(cb: (err: unknown) => void): void;
  terminate(): void;
}

export interface UciTimers {
  setTimeout?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeout?: (id: ReturnType<typeof setTimeout>) => void;
}

export const ELO_MIN = 1320;
export const ELO_MAX = 3190;
export const DEFAULT_MOVETIME_MS = 1000;
/** Extra time past movetime before a search counts as hung. */
export const TIMEOUT_GRACE_MS = 5000;

interface Search {
  fen: string;
  elo: number;
  movetimeMs: number;
  resolve(move: string | null): void;
  reject(err: Error): void;
  done: boolean;
  cleanup(): void;
}

export function clampElo(elo: number): number {
  return Math.min(ELO_MAX, Math.max(ELO_MIN, Math.round(elo)));
}

/**
 * Speaks UCI over a transport. Searches run one at a time, in call order.
 *
 * The engine is "busy" while it still owes us an answer we will throw away:
 * uciok, a readyok, or the bestmove of a search that was aborted or timed
 * out. No new search starts until it is free again, so a stale bestmove can
 * never resolve the wrong call.
 */
export function createUciEngine(transport: UciTransport, timers: UciTimers = {}): MoveEngine {
  const setTimer = timers.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = timers.clearTimeout ?? ((id) => clearTimeout(id));

  let dead: "failed" | "disposed" | null = null;
  let awaitingUciok = true;
  let readyoksOwed = 0;
  let staleBestmoves = 0;
  let newGamePending = false;
  let lastElo: number | null = null;
  let active: Search | null = null;
  let queue: Search[] = [];

  const busy = () => awaitingUciok || readyoksOwed > 0 || staleBestmoves > 0 || active !== null;

  function settle(search: Search, outcome: { move: string | null } | { error: Error }) {
    if (search.done) return;
    search.done = true;
    search.cleanup();
    if (active === search) active = null;
    queue = queue.filter((s) => s !== search);
    if ("error" in outcome) search.reject(outcome.error);
    else search.resolve(outcome.move);
  }

  // Ends a search early. If the engine is already thinking on it, tell it to
  // stop and wait for (then drop) the bestmove it still owes.
  function cancel(search: Search, code: EngineErrorCode) {
    if (search.done) return;
    if (active === search) {
      transport.send("stop");
      staleBestmoves += 1;
    }
    settle(search, { error: new EngineError(code) });
    pump();
  }

  function pump() {
    if (dead || busy()) return;
    const next = queue[0];
    if (!next) return;
    if (newGamePending) {
      newGamePending = false;
      transport.send("ucinewgame");
      transport.send("isready");
      readyoksOwed += 1;
      return;
    }
    queue.shift();
    active = next;
    if (next.elo !== lastElo) {
      transport.send(`setoption name UCI_Elo value ${next.elo}`);
      lastElo = next.elo;
    }
    transport.send(`position fen ${next.fen}`);
    transport.send(`go movetime ${next.movetimeMs}`);
  }

  function onLine(line: string) {
    if (dead) return;
    if (line === "uciok") {
      if (!awaitingUciok) return;
      awaitingUciok = false;
      transport.send("setoption name UCI_LimitStrength value true");
      transport.send("isready");
      readyoksOwed += 1;
    } else if (line === "readyok") {
      if (awaitingUciok || readyoksOwed === 0) return;
      readyoksOwed -= 1;
      pump();
    } else if (line === "bestmove" || line.startsWith("bestmove ")) {
      if (staleBestmoves > 0) {
        staleBestmoves -= 1;
        pump();
      } else if (active) {
        const move = line.split(/\s+/)[1];
        settle(active, { move: !move || move === "(none)" ? null : move });
        pump();
      }
    }
  }

  function kill(state: "failed" | "disposed") {
    dead = state;
    const pending = [active, ...queue].filter((s): s is Search => s !== null);
    for (const search of pending) settle(search, { error: new EngineError(state) });
  }

  transport.onLine((chunk) => {
    for (const line of String(chunk).split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed) onLine(trimmed);
    }
  });
  transport.onError(() => {
    if (!dead) kill("failed");
  });
  transport.send("uci");

  return {
    bestMove(fen, opts, signal) {
      if (dead) return Promise.reject(new EngineError(dead));
      if (Number.isNaN(opts.elo)) return Promise.reject(new RangeError("elo is NaN"));
      if (signal?.aborted) return Promise.reject(new EngineError("aborted"));

      const movetimeMs = Math.max(1, Math.round(opts.movetimeMs ?? DEFAULT_MOVETIME_MS));
      return new Promise<string | null>((resolve, reject) => {
        const onAbort = () => cancel(search, "aborted");
        // The limit counts from the call, so no call can wait forever, even
        // behind a handshake or a stale answer that never comes.
        const timer = setTimer(() => cancel(search, "timeout"), movetimeMs + TIMEOUT_GRACE_MS);
        const search: Search = {
          fen,
          elo: clampElo(opts.elo),
          movetimeMs,
          resolve,
          reject,
          done: false,
          cleanup: () => {
            clearTimer(timer);
            signal?.removeEventListener("abort", onAbort);
          },
        };
        signal?.addEventListener("abort", onAbort);
        queue.push(search);
        pump();
      });
    },

    newGame() {
      if (!dead) newGamePending = true;
    },

    dispose() {
      if (dead === "disposed") return;
      transport.terminate();
      kill("disposed");
    },
  };
}
