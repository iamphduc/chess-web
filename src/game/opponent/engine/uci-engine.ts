import type { EngineLine, Score, SearchLimits } from "./lines";
import { EngineError, type Analysis, type EngineErrorCode, type MoveEngine } from "./move-engine";

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

/** Extra time past movetime before a search counts as hung. */
export const TIMEOUT_GRACE_MS = 5000;
export const MAX_DEPTH = 30;
export const MAX_MULTIPV = 6;

interface Search {
  fen: string;
  limits: SearchLimits;
  /** The latest scored line per multipv index, from this search's info lines. */
  lines: Map<number, EngineLine>;
  resolve(analysis: Analysis): void;
  reject(err: Error): void;
  done: boolean;
  cleanup(): void;
}

/** The limits as sent (movetime rounded, at least 1), or a RangeError naming the first bad one. */
function checkLimits(limits: SearchLimits): SearchLimits | RangeError {
  const { depth, multiPv, movetimeMs } = limits;
  if (!Number.isInteger(depth) || depth < 1 || depth > MAX_DEPTH) {
    return new RangeError(`depth must be a whole number from 1 to ${MAX_DEPTH}, got ${depth}`);
  }
  if (!Number.isInteger(multiPv) || multiPv < 1 || multiPv > MAX_MULTIPV) {
    return new RangeError(`multiPv must be a whole number from 1 to ${MAX_MULTIPV}, got ${multiPv}`);
  }
  if (!Number.isFinite(movetimeMs) || movetimeMs <= 0) {
    return new RangeError(`movetimeMs must be a positive number, got ${movetimeMs}`);
  }
  return { depth, multiPv, movetimeMs: Math.max(1, Math.round(movetimeMs)) };
}

/** A whole number from UCI text, or NaN. */
function wholeNumber(text: string | undefined): number {
  return text !== undefined && /^-?\d+$/.test(text) ? Number(text) : NaN;
}

/**
 * One `info` line's scored line and its multipv index (missing = 1), or null
 * when it has no usable depth, exact cp/mate score or pv: `info string`,
 * `currmove` updates and `lowerbound`/`upperbound` scores are all skipped.
 */
export function parseInfoLine(text: string): { index: number; line: EngineLine } | null {
  const t = text.split(/\s+/);
  if (t[0] !== "info") return null;
  let depth = NaN;
  let index = 1;
  let score: Score | null = null;
  let move: string | undefined;
  for (let i = 1; i < t.length; i++) {
    switch (t[i]) {
      case "string":
      case "lowerbound":
      case "upperbound":
        return null;
      case "depth":
        depth = wholeNumber(t[++i]);
        break;
      case "multipv":
        index = wholeNumber(t[++i]);
        break;
      case "score": {
        const kind = t[++i];
        const value = wholeNumber(t[++i]);
        if (Number.isNaN(value)) return null;
        if (kind === "cp") score = { cp: value };
        else if (kind === "mate") score = { mate: value };
        else return null;
        break;
      }
      case "pv":
        move = t[i + 1];
        i = t.length;
        break;
    }
  }
  if (!(depth >= 1) || !(index >= 1) || score === null || !move) return null;
  return { index, line: { move, score, depth } };
}

/** The collected lines in multipv order, each first move kept once (at its first index). */
function linesOf(collected: Map<number, EngineLine>): EngineLine[] {
  const seen = new Set<string>();
  const ordered = Array.from(collected.entries()).sort(([a], [b]) => a - b).map(([, line]) => line);
  return ordered.filter((line) => {
    if (seen.has(line.move)) return false;
    seen.add(line.move);
    return true;
  });
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
  let lastMultiPv: number | null = null;
  let active: Search | null = null;
  let queue: Search[] = [];

  const busy = () => awaitingUciok || readyoksOwed > 0 || staleBestmoves > 0 || active !== null;

  function settle(search: Search, outcome: { analysis: Analysis } | { error: Error }) {
    if (search.done) return;
    search.done = true;
    search.cleanup();
    if (active === search) active = null;
    queue = queue.filter((s) => s !== search);
    if ("error" in outcome) search.reject(outcome.error);
    else search.resolve(outcome.analysis);
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
    const { depth, multiPv, movetimeMs } = next.limits;
    if (multiPv !== lastMultiPv) {
      transport.send(`setoption name MultiPV value ${multiPv}`);
      lastMultiPv = multiPv;
    }
    transport.send(`position fen ${next.fen}`);
    transport.send(`go depth ${depth} movetime ${movetimeMs}`);
  }

  function onLine(line: string) {
    if (dead) return;
    if (line === "uciok") {
      if (!awaitingUciok) return;
      awaitingUciok = false;
      transport.send("isready");
      readyoksOwed += 1;
    } else if (line === "readyok") {
      if (awaitingUciok || readyoksOwed === 0) return;
      readyoksOwed -= 1;
      pump();
    } else if (line.startsWith("info ")) {
      // Only the running search's lines count: never while a stale bestmove is owed.
      if (!active || staleBestmoves > 0) return;
      const parsed = parseInfoLine(line);
      if (parsed && parsed.index <= active.limits.multiPv) active.lines.set(parsed.index, parsed.line);
    } else if (line === "bestmove" || line.startsWith("bestmove ")) {
      if (staleBestmoves > 0) {
        staleBestmoves -= 1;
        pump();
      } else if (active) {
        const move = line.split(/\s+/)[1];
        const bestMove = !move || move === "(none)" ? null : move;
        const lines = bestMove === null ? [] : linesOf(active.lines);
        settle(active, { analysis: { lines, bestMove } });
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
    analyse(fen, limits, signal) {
      if (dead) return Promise.reject(new EngineError(dead));
      const checked = checkLimits(limits);
      if (checked instanceof RangeError) return Promise.reject(checked);
      if (signal?.aborted) return Promise.reject(new EngineError("aborted"));

      return new Promise<Analysis>((resolve, reject) => {
        const onAbort = () => cancel(search, "aborted");
        // The limit counts from the call, so no call can wait forever, even
        // behind a handshake or a stale answer that never comes.
        const timer = setTimer(() => cancel(search, "timeout"), checked.movetimeMs + TIMEOUT_GRACE_MS);
        const search: Search = {
          fen,
          limits: checked,
          lines: new Map(),
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
