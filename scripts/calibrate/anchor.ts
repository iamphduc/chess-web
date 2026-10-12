// The anchors: Stockfish at a set UCI_Elo, through a small UCI player of its
// own (the app's engine never sends UCI_LimitStrength). Plus the Node glue
// that runs one Stockfish per child process.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createInterface } from "node:readline";
import type { GameState } from "../../src/game/engine/game-state";
import type { UciTimers, UciTransport } from "../../src/game/opponent/engine/uci-engine";
import { TIMEOUT_GRACE_MS } from "../../src/game/opponent/engine/uci-engine";
import { toFen } from "../../src/game/opponent/position";
import { strengthElo, type StrengthStep } from "../../src/game/opponent/strength";
import type { MatchPlayer, MovePlayed } from "./match";

/** Stockfish 18's UCI_Elo range. */
export const ANCHOR_ELO_MIN = 1320;
export const ANCHOR_ELO_MAX = 3190;

/** The default anchors, as offsets from a step's Elo. */
export const DEFAULT_ANCHOR_OFFSETS: readonly number[] = [-200, 0, 200];

export function clampAnchorElo(elo: number): number {
  return Math.min(ANCHOR_ELO_MAX, Math.max(ANCHOR_ELO_MIN, Math.round(elo)));
}

/**
 * The anchor Elos for a step: its Elo (Full's is `rating`) plus each offset,
 * clamped to Stockfish's range, in order, each once.
 */
export function defaultAnchors(
  step: StrengthStep,
  rating: number,
  offsets: readonly number[] = DEFAULT_ANCHOR_OFFSETS
): number[] {
  const base = strengthElo(step, rating);
  const elos = offsets.map((o) => clampAnchorElo(base + o));
  return [...new Set(elos)].sort((x, y) => x - y);
}

export interface Anchor extends MatchPlayer {
  dispose(): void;
}

/**
 * Stockfish limited to `elo`, thinking `movetimeMs` per move. One search at a
 * time; a search with no `bestmove` within movetime + 5 s fails.
 */
export function createAnchor(
  transport: UciTransport,
  options: { elo: number; movetimeMs: number; timers?: UciTimers }
): Anchor {
  const elo = clampAnchorElo(options.elo);
  const { movetimeMs } = options;
  const setTimer = options.timers?.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = options.timers?.clearTimeout ?? ((id) => clearTimeout(id));

  let dead: "failed" | "disposed" | null = null;
  let ready = false;
  let readyWaiters: (() => void)[] = [];
  let newGamePending = false;
  let pending: { resolve(m: MovePlayed): void; reject(e: Error): void } | null = null;

  function fail(state: "failed" | "disposed") {
    if (dead) return;
    dead = state;
    const p = pending;
    pending = null;
    p?.reject(new Error(`anchor ${elo} ${state}`));
  }

  transport.onLine((chunk) => {
    for (const raw of String(chunk).split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || dead) continue;
      if (line === "uciok") {
        transport.send("setoption name UCI_LimitStrength value true");
        transport.send(`setoption name UCI_Elo value ${elo}`);
        transport.send("isready");
      } else if (line === "readyok") {
        ready = true;
        const waiters = readyWaiters;
        readyWaiters = [];
        waiters.forEach((w) => w());
      } else if (line === "bestmove" || line.startsWith("bestmove ")) {
        const p = pending;
        pending = null;
        const move = line.split(/\s+/)[1];
        if (!p) continue;
        if (!move || move === "(none)") p.reject(new Error(`anchor ${elo}: no move`));
        else p.resolve({ uci: move });
      }
    }
  });
  transport.onError(() => fail("failed"));
  transport.send("uci");

  const whenReady = () =>
    new Promise<void>((resolve) => {
      if (ready) resolve();
      else readyWaiters.push(resolve);
    });

  return {
    name: `SF ${elo}`,

    newGame() {
      newGamePending = true;
    },

    move(state: GameState): Promise<MovePlayed> {
      if (dead) return Promise.reject(new Error(`anchor ${elo} ${dead}`));
      if (pending) return Promise.reject(new Error(`anchor ${elo} is busy`));
      const answer = new Promise<MovePlayed>((resolve, reject) => {
        const timer = setTimer(() => {
          if (pending !== search) return;
          pending = null;
          reject(new Error(`anchor ${elo} timed out`));
        }, movetimeMs + TIMEOUT_GRACE_MS);
        const search = {
          resolve: (m: MovePlayed) => {
            clearTimer(timer);
            resolve(m);
          },
          reject: (e: Error) => {
            clearTimer(timer);
            reject(e);
          },
        };
        pending = search;
      });
      const mine = pending;
      const still = () => !dead && pending === mine;
      void (async () => {
        await whenReady();
        if (!still()) return;
        if (newGamePending) {
          newGamePending = false;
          ready = false;
          transport.send("ucinewgame");
          transport.send("isready");
          await whenReady();
          if (!still()) return;
        }
        transport.send(`position fen ${toFen(state)}`);
        transport.send(`go movetime ${movetimeMs}`);
      })();
      return answer;
    },

    dispose() {
      if (dead === "disposed") return;
      transport.terminate();
      fail("disposed");
    },
  };
}

/**
 * Starts the lite single-thread Stockfish build (the one the browser uses) in
 * its own Node process, speaking UCI over stdin and stdout. Each engine gets a
 * process: the npm loader can't hold two in one process, and separate
 * processes let games run side by side.
 */
export function spawnStockfish(): UciTransport {
  const script = createRequire(import.meta.url).resolve("stockfish/bin/stockfish-18-lite-single.js");
  const child = spawn(process.execPath, [script], { stdio: ["pipe", "pipe", "pipe"] });
  const lineCbs: ((line: string) => void)[] = [];
  const errorCbs: ((err: unknown) => void)[] = [];
  let closed = false;
  createInterface({ input: child.stdout }).on("line", (line) => lineCbs.forEach((cb) => cb(line)));
  const onFail = (err: unknown) => {
    if (closed) return;
    closed = true;
    errorCbs.forEach((cb) => cb(err));
  };
  child.on("error", onFail);
  child.on("exit", (code) => onFail(new Error(`stockfish exited with ${code}`)));
  child.stdin.on("error", onFail);
  return {
    send: (line) => {
      if (!closed) child.stdin.write(`${line}\n`);
    },
    onLine: (cb) => void lineCbs.push(cb),
    onError: (cb) => void errorCbs.push(cb),
    terminate: () => {
      if (closed) return;
      closed = true;
      child.kill();
    },
  };
}
