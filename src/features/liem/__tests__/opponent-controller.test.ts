import { afterEach, describe, expect, it, vi } from "vitest";

import { initialGameState } from "game/engine/game-state";
import type { SearchLimits } from "game/opponent/engine/lines";
import type { Analysis } from "game/opponent/engine/move-engine";
import { type MoveChoice, OpponentError, type OpponentErrorCode } from "game/opponent/opponent";
import { uciToMove } from "game/opponent/position";
import { STEP_PROFILES } from "game/opponent/step-profiles";
import type { TurnRequest } from "../liemTurn";
import { createOpponentController, type LiemOpponent, type OpponentMove } from "../opponentController";
import type { OpponentStatus } from "../matchSlice";

// ---- fakes ------------------------------------------------------------------

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Lets every pending promise callback run. Uses no timers. */
async function flush(): Promise<void> {
  for (let i = 0; i < 50; i++) await Promise.resolve();
}

const start = initialGameState();
const e2e4 = uciToMove(start, "e2e4");
if (e2e4 === null) throw new Error("e2e4 must be legal");
const CHOICE: MoveChoice = { move: e2e4, uci: "e2e4", source: "book", lookup: null };

const SETTINGS = { profile: STEP_PROFILES[2100], clock: { baseMs: 600_000, incrementMs: 0 } };
const req = (gameId: number, ply: number): TurnRequest => ({ gameId, ply, state: start, settings: SETTINGS });

/**
 * An opponent whose every `chooseMove` and `analyse` waits until the test
 * settles it. Like the real one, an aborted review search rejects `superseded`,
 * and `dispose` rejects everything in flight with `disposed`.
 */
function fakeOpponent(name: string, log: string[]) {
  const asks: Deferred<MoveChoice>[] = [];
  const searches: { d: Deferred<Analysis>; signal?: AbortSignal }[] = [];
  const opponent = {
    chooseMove: vi.fn((..._args: unknown[]): Promise<MoveChoice> => {
      log.push(`${name}.chooseMove`);
      const d = deferred<MoveChoice>();
      asks.push(d);
      return d.promise;
    }),
    analyse: vi.fn((_fen: string, _limits: SearchLimits, signal?: AbortSignal): Promise<Analysis> => {
      log.push(`${name}.analyse`);
      const d = deferred<Analysis>();
      searches.push({ d, signal });
      signal?.addEventListener("abort", () => {
        log.push(`${name}.abort`);
        d.reject(new OpponentError("superseded"));
      });
      return d.promise;
    }),
    newGame: vi.fn(() => {
      log.push(`${name}.newGame`);
    }),
    dispose: vi.fn(() => {
      log.push(`${name}.dispose`);
      for (const a of asks) a.reject(new OpponentError("disposed"));
      for (const s of searches) s.d.reject(new OpponentError("disposed"));
    }),
  } satisfies LiemOpponent;
  return {
    opponent,
    asks,
    searches,
    last: () => asks[asks.length - 1],
    search: () => searches[searches.length - 1],
  };
}

/** A controller over a queue of loads the test settles one by one. */
function setup() {
  const log: string[] = [];
  const loads: Deferred<LiemOpponent>[] = [];
  const load = vi.fn(() => {
    log.push("load");
    const d = deferred<LiemOpponent>();
    loads.push(d);
    return d.promise;
  });
  const moves: OpponentMove[] = [];
  const statuses: OpponentStatus[] = [];
  const controller = createOpponentController({
    load,
    onMove: (m) => {
      moves.push(m);
      log.push(`onMove ${m.gameId}/${m.ply}`);
    },
    onStatus: (s) => statuses.push(s),
  });
  const lastStatus = () => statuses[statuses.length - 1];
  return { log, loads, load, moves, statuses, lastStatus, controller };
}

/** A controller with its first opponent already loaded. */
async function loaded() {
  const t = setup();
  const a = fakeOpponent("a", t.log);
  t.controller.preload();
  t.loads[0].resolve(a.opponent);
  await flush();
  return { ...t, a };
}

const err = (code: OpponentErrorCode) => new OpponentError(code);

afterEach(() => {
  vi.useRealTimers();
});

// ---- tests ------------------------------------------------------------------

describe("loads once", () => {
  it("preload then two requests call load once", async () => {
    const t = setup();
    const a = fakeOpponent("a", t.log);
    t.controller.preload();
    t.controller.request(req(1, 0));
    t.controller.request(req(1, 1));
    t.controller.preload();
    t.loads[0].resolve(a.opponent);
    await flush();
    t.controller.request(req(1, 2));
    t.controller.preload();
    await flush();
    expect(t.load).toHaveBeenCalledTimes(1);
  });

  it("a request alone starts the load", () => {
    const t = setup();
    t.controller.request(req(1, 0));
    expect(t.load).toHaveBeenCalledTimes(1);
  });
});

describe("same request runs once", () => {
  it("a repeated (gameId, ply) calls chooseMove once", async () => {
    const t = await loaded();
    t.controller.request(req(1, 0));
    t.controller.request(req(1, 0));
    await flush();
    t.controller.request(req(1, 0));
    expect(t.a.opponent.chooseMove).toHaveBeenCalledTimes(1);
    t.a.last().resolve(CHOICE);
    await flush();
    t.controller.request(req(1, 0));
    await flush();
    expect(t.a.opponent.chooseMove).toHaveBeenCalledTimes(1);
    expect(t.moves).toHaveLength(1);
  });

  it("the same ply in another game is a new request", async () => {
    const t = await loaded();
    t.controller.request(req(1, 0));
    await flush();
    t.controller.request(req(2, 0));
    await flush();
    expect(t.a.opponent.chooseMove).toHaveBeenCalledTimes(2);
  });

  it("passes the request's state and settings to chooseMove", async () => {
    const t = await loaded();
    const r = req(4, 6);
    t.controller.request(r);
    await flush();
    expect(t.a.opponent.chooseMove).toHaveBeenCalledWith(r.state, r.settings);
    t.a.last().resolve(CHOICE);
    await flush();
    expect(t.moves).toEqual([{ gameId: 4, ply: 6, choice: CHOICE }]);
  });
});

describe("stale answers are dropped", () => {
  it("an older request's answer never reaches onMove", async () => {
    const t = await loaded();
    t.controller.request(req(1, 0));
    await flush();
    const first = t.a.last();
    t.controller.request(req(1, 2));
    await flush();
    const second = t.a.last();
    first.resolve(CHOICE);
    await flush();
    expect(t.moves).toEqual([]);
    second.resolve(CHOICE);
    await flush();
    expect(t.moves).toEqual([{ gameId: 1, ply: 2, choice: CHOICE }]);
  });

  it("an answer after cancel never reaches onMove", async () => {
    const t = await loaded();
    t.controller.request(req(1, 0));
    await flush();
    t.controller.cancel();
    t.a.last().resolve(CHOICE);
    await flush();
    expect(t.moves).toEqual([]);
  });

  it("a request made while loading and then cancelled never chooses", async () => {
    const t = setup();
    const a = fakeOpponent("a", t.log);
    t.controller.request(req(1, 0));
    t.controller.cancel();
    t.loads[0].resolve(a.opponent);
    await flush();
    expect(a.opponent.chooseMove).not.toHaveBeenCalled();
    expect(t.moves).toEqual([]);
  });

  it("after cancel the same (gameId, ply) can be asked again", async () => {
    const t = await loaded();
    t.controller.request(req(1, 0));
    await flush();
    t.controller.cancel();
    t.controller.request(req(1, 0));
    await flush();
    expect(t.a.opponent.chooseMove).toHaveBeenCalledTimes(2);
    t.a.last().resolve(CHOICE);
    await flush();
    expect(t.moves).toHaveLength(1);
  });

  it("an older request's failure does not touch the newer one", async () => {
    const t = await loaded();
    t.controller.request(req(1, 0));
    await flush();
    const first = t.a.last();
    t.controller.request(req(1, 2));
    await flush();
    first.reject(err("engine-failed"));
    await flush();
    expect(t.lastStatus()).toBe("thinking");
    expect(t.a.opponent.dispose).not.toHaveBeenCalled();
  });
});

describe("newGame between games", () => {
  it("is called before game 2's first choice, not on game 1 and not between plies", async () => {
    const t = await loaded();
    t.controller.request(req(1, 0));
    await flush();
    t.a.last().resolve(CHOICE);
    await flush();
    t.controller.request(req(1, 2));
    await flush();
    t.a.last().resolve(CHOICE);
    await flush();
    expect(t.a.opponent.newGame).not.toHaveBeenCalled();

    t.controller.request(req(2, 1));
    await flush();
    t.a.last().resolve(CHOICE);
    await flush();
    t.controller.request(req(2, 3));
    await flush();
    expect(t.a.opponent.newGame).toHaveBeenCalledTimes(1);
    expect(t.log.filter((l) => l.startsWith("a."))).toEqual([
      "a.chooseMove",
      "a.chooseMove",
      "a.newGame",
      "a.chooseMove",
      "a.chooseMove",
    ]);
  });

  it("resets once when game 2 starts after a cancel, and not again on its next ply", async () => {
    const t = await loaded();
    t.controller.request(req(1, 0));
    await flush();
    t.controller.cancel();
    t.controller.request(req(2, 0));
    await flush();
    t.controller.request(req(2, 2));
    await flush();
    expect(t.a.opponent.newGame).toHaveBeenCalledTimes(1);
    expect(t.log.filter((l) => l.startsWith("a."))).toEqual([
      "a.chooseMove",
      "a.newGame",
      "a.chooseMove",
      "a.chooseMove",
    ]);
  });

  it("carries a pending reset across a load", async () => {
    const t = setup();
    const a = fakeOpponent("a", t.log);
    t.controller.request(req(1, 0));
    t.controller.request(req(2, 0));
    t.loads[0].resolve(a.opponent);
    await flush();
    expect(t.log).toEqual(["load", "a.newGame", "a.chooseMove"]);
  });
});

describe("failures and retry", () => {
  it("load reject → failed, retry loads a fresh opponent and re-asks", async () => {
    const t = setup();
    const b = fakeOpponent("b", t.log);
    t.controller.request(req(1, 0));
    t.loads[0].reject(new Error("network"));
    await flush();
    expect(t.lastStatus()).toBe("failed");
    t.controller.retry();
    expect(t.load).toHaveBeenCalledTimes(2);
    t.loads[1].resolve(b.opponent);
    await flush();
    expect(b.opponent.chooseMove).toHaveBeenCalledTimes(1);
    b.last().resolve(CHOICE);
    await flush();
    expect(t.moves).toEqual([{ gameId: 1, ply: 0, choice: CHOICE }]);
    expect(t.lastStatus()).toBe("idle");
  });

  it("a failed preload → failed, retry loads again", async () => {
    const t = setup();
    t.controller.preload();
    t.loads[0].reject(new Error("404"));
    await flush();
    expect(t.lastStatus()).toBe("failed");
    t.controller.retry();
    expect(t.load).toHaveBeenCalledTimes(2);
    t.loads[1].resolve(fakeOpponent("b", t.log).opponent);
    await flush();
    expect(t.lastStatus()).toBe("idle");
  });

  it("engine-failed → failed, the old opponent is disposed and retry loads a fresh one", async () => {
    const t = await loaded();
    const b = fakeOpponent("b", t.log);
    t.controller.request(req(1, 0));
    await flush();
    t.a.last().reject(err("engine-failed"));
    await flush();
    expect(t.lastStatus()).toBe("failed");
    expect(t.a.opponent.dispose).toHaveBeenCalledTimes(1);
    t.controller.retry();
    expect(t.load).toHaveBeenCalledTimes(2);
    t.loads[1].resolve(b.opponent);
    await flush();
    expect(b.opponent.chooseMove).toHaveBeenCalledTimes(1);
    expect(t.a.opponent.chooseMove).toHaveBeenCalledTimes(1);
    b.last().resolve(CHOICE);
    await flush();
    expect(t.moves).toEqual([{ gameId: 1, ply: 0, choice: CHOICE }]);
  });

  it("an unknown error from chooseMove is treated as engine-failed", async () => {
    const t = await loaded();
    t.controller.request(req(1, 0));
    await flush();
    t.a.last().reject(new TypeError("boom"));
    await flush();
    expect(t.lastStatus()).toBe("failed");
    expect(t.a.opponent.dispose).toHaveBeenCalledTimes(1);
  });

  it("engine-timeout → failed, retry loads a fresh opponent", async () => {
    // A hung search can't be trusted to end, so the engine is replaced.
    const t = await loaded();
    const b = fakeOpponent("b", t.log);
    t.controller.request(req(1, 0));
    await flush();
    t.a.last().reject(err("engine-timeout"));
    await flush();
    expect(t.lastStatus()).toBe("failed");
    expect(t.a.opponent.dispose).toHaveBeenCalledTimes(1);
    t.controller.retry();
    expect(t.load).toHaveBeenCalledTimes(2);
    t.loads[1].resolve(b.opponent);
    await flush();
    expect(t.a.opponent.chooseMove).toHaveBeenCalledTimes(1);
    expect(b.opponent.chooseMove).toHaveBeenCalledTimes(1);
    b.last().resolve(CHOICE);
    await flush();
    expect(t.moves).toEqual([{ gameId: 1, ply: 0, choice: CHOICE }]);
    expect(t.lastStatus()).toBe("idle");
  });

  it.each<OpponentErrorCode>(["illegal-engine-move"])(
    "%s → failed, retry re-asks the same opponent",
    async (code) => {
      const t = await loaded();
      t.controller.request(req(1, 0));
      await flush();
      t.a.last().reject(err(code));
      await flush();
      expect(t.lastStatus()).toBe("failed");
      expect(t.a.opponent.dispose).not.toHaveBeenCalled();
      t.controller.retry();
      await flush();
      expect(t.load).toHaveBeenCalledTimes(1);
      expect(t.a.opponent.chooseMove).toHaveBeenCalledTimes(2);
      t.a.last().resolve(CHOICE);
      await flush();
      expect(t.moves).toEqual([{ gameId: 1, ply: 0, choice: CHOICE }]);
      expect(t.lastStatus()).toBe("idle");
    }
  );

  it("a failed request is not re-run by repeating it, only by retry", async () => {
    const t = await loaded();
    t.controller.request(req(1, 0));
    await flush();
    t.a.last().reject(err("engine-timeout"));
    await flush();
    t.controller.request(req(1, 0));
    await flush();
    expect(t.a.opponent.chooseMove).toHaveBeenCalledTimes(1);
  });

  it.each<OpponentErrorCode>(["superseded", "no-legal-moves", "disposed"])("%s does not fail", async (code) => {
    const t = await loaded();
    t.controller.request(req(1, 0));
    await flush();
    t.a.last().reject(err(code));
    await flush();
    expect(t.statuses).not.toContain("failed");
    expect(t.lastStatus()).toBe("idle");
    expect(t.a.opponent.dispose).not.toHaveBeenCalled();
    expect(t.moves).toEqual([]);
  });

  it("retry with nothing failed does nothing", async () => {
    const t = await loaded();
    t.controller.retry();
    t.controller.request(req(1, 0));
    await flush();
    t.controller.retry();
    await flush();
    expect(t.load).toHaveBeenCalledTimes(1);
    expect(t.a.opponent.chooseMove).toHaveBeenCalledTimes(1);
  });

  it("cancel after a failure clears it: status is idle and retry does nothing", async () => {
    const t = await loaded();
    t.controller.request(req(1, 0));
    await flush();
    t.a.last().reject(err("engine-timeout"));
    await flush();
    t.controller.cancel();
    expect(t.lastStatus()).toBe("idle");
    t.controller.retry();
    await flush();
    expect(t.a.opponent.chooseMove).toHaveBeenCalledTimes(1);
  });
});

describe("status order", () => {
  it("goes loading → thinking → idle", async () => {
    const t = setup();
    const a = fakeOpponent("a", t.log);
    t.controller.request(req(1, 0));
    expect(t.statuses).toEqual(["loading"]);
    t.loads[0].resolve(a.opponent);
    await flush();
    expect(t.statuses).toEqual(["loading", "thinking"]);
    a.last().resolve(CHOICE);
    await flush();
    expect(t.statuses).toEqual(["loading", "thinking", "idle"]);
  });

  it("a preload goes loading → idle, and a loaded opponent goes straight to thinking", async () => {
    const t = setup();
    const a = fakeOpponent("a", t.log);
    t.controller.preload();
    t.loads[0].resolve(a.opponent);
    await flush();
    expect(t.statuses).toEqual(["loading", "idle"]);
    t.controller.request(req(1, 0));
    expect(t.statuses).toEqual(["loading", "idle", "thinking"]);
  });

  it("cancel while thinking goes back to idle and stays there", async () => {
    const t = await loaded();
    t.controller.request(req(1, 0));
    await flush();
    t.controller.cancel();
    expect(t.lastStatus()).toBe("idle");
    t.a.last().resolve(CHOICE);
    await flush();
    expect(t.lastStatus()).toBe("idle");
  });

  it("is idle before onMove runs", async () => {
    const t = await loaded();
    let status: OpponentStatus | undefined;
    let statusAtMove: OpponentStatus | undefined;
    const controller = createOpponentController({
      load: () => Promise.resolve(t.a.opponent),
      onMove: () => {
        statusAtMove = status;
      },
      onStatus: (s) => {
        status = s;
      },
    });
    controller.request(req(1, 0));
    await flush();
    t.a.last().resolve(CHOICE);
    await flush();
    expect(statusAtMove).toBe("idle");
  });
});

describe("dispose", () => {
  it("disposes the opponent and later calls do nothing", async () => {
    const t = await loaded();
    t.controller.request(req(1, 0));
    await flush();
    const ask = t.a.last();
    const before = t.statuses.length;
    t.controller.dispose();
    expect(t.a.opponent.dispose).toHaveBeenCalledTimes(1);
    ask.resolve(CHOICE);
    t.controller.request(req(1, 2));
    t.controller.preload();
    t.controller.retry();
    t.controller.cancel();
    t.controller.dispose();
    await flush();
    expect(t.moves).toEqual([]);
    expect(t.load).toHaveBeenCalledTimes(1);
    expect(t.a.opponent.chooseMove).toHaveBeenCalledTimes(1);
    expect(t.a.opponent.dispose).toHaveBeenCalledTimes(1);
    expect(t.statuses.length).toBe(before);
  });

  it("a load that resolves after dispose is disposed at once", async () => {
    const t = setup();
    const a = fakeOpponent("a", t.log);
    t.controller.request(req(1, 0));
    t.controller.dispose();
    t.loads[0].resolve(a.opponent);
    await flush();
    expect(a.opponent.dispose).toHaveBeenCalledTimes(1);
    expect(a.opponent.chooseMove).not.toHaveBeenCalled();
    expect(t.moves).toEqual([]);
  });

  it("a load that fails after dispose reports nothing", async () => {
    const t = setup();
    t.controller.request(req(1, 0));
    const before = t.statuses.length;
    t.controller.dispose();
    t.loads[0].reject(new Error("network"));
    await flush();
    expect(t.statuses.length).toBe(before);
  });
});

describe("no added delay", () => {
  it("with fake timers never advanced, a loaded book answer reaches onMove", async () => {
    vi.useFakeTimers();
    const a = fakeOpponent("a", []);
    a.opponent.chooseMove.mockImplementation(() => Promise.resolve(CHOICE));
    const moves: OpponentMove[] = [];
    const controller = createOpponentController({
      load: () => Promise.resolve(a.opponent),
      onMove: (m) => moves.push(m),
      onStatus: () => {},
    });
    controller.request(req(1, 0));
    await flush();
    expect(moves).toEqual([{ gameId: 1, ply: 0, choice: CHOICE }]);
    expect(vi.getTimerCount()).toBe(0);
  });
});

// ---- review searches ---------------------------------------------------------

const FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
const LIMITS: SearchLimits = { depth: 18, multiPv: 1, movetimeMs: 500 };
const ANALYSIS: Analysis = { lines: [{ move: "e7e5", score: { cp: -30 }, depth: 18 }], bestMove: "e7e5" };

/** The settled state of a promise, without waiting for it. */
function track<T>(p: Promise<T>) {
  const t: { value?: T; error?: unknown; settled: boolean } = { settled: false };
  p.then(
    (v) => Object.assign(t, { value: v, settled: true }),
    (e) => Object.assign(t, { error: e, settled: true })
  );
  return t;
}

const codeOf = (e: unknown) => (e instanceof OpponentError ? e.code : e);

describe("analyse loads quietly", () => {
  it("loads him on first use, passes the search through, and never reports a status", async () => {
    const t = setup();
    const a = fakeOpponent("a", t.log);
    const result = track(t.controller.analyse(FEN, LIMITS));
    expect(t.load).toHaveBeenCalledTimes(1);
    t.loads[0].resolve(a.opponent);
    await flush();
    expect(a.opponent.analyse).toHaveBeenCalledTimes(1);
    expect(a.opponent.analyse.mock.calls[0][0]).toBe(FEN);
    expect(a.opponent.analyse.mock.calls[0][1]).toEqual(LIMITS);
    a.search().d.resolve(ANALYSIS);
    await flush();
    expect(result.value).toEqual(ANALYSIS);

    // Loaded: the next search uses the same opponent.
    void t.controller.analyse(FEN, LIMITS);
    await flush();
    expect(t.load).toHaveBeenCalledTimes(1);
    expect(a.opponent.analyse).toHaveBeenCalledTimes(2);
    expect(t.statuses).toEqual([]);
  });

  it("a cancel while it loads him quietly doesn't report loading", async () => {
    const t = setup();
    const a = fakeOpponent("a", t.log);
    void t.controller.analyse(FEN, LIMITS);
    t.controller.cancel();
    t.loads[0].resolve(a.opponent);
    await flush();
    t.controller.cancel();
    expect(t.statuses).not.toContain("loading");
  });

  it("shares the load with a preload, and the preload still reports its own statuses", async () => {
    const t = setup();
    const a = fakeOpponent("a", t.log);
    t.controller.preload();
    void t.controller.analyse(FEN, LIMITS);
    t.loads[0].resolve(a.opponent);
    await flush();
    expect(t.load).toHaveBeenCalledTimes(1);
    expect(a.opponent.analyse).toHaveBeenCalledTimes(1);
    expect(t.statuses).toEqual(["loading", "idle"]);
  });

  it("a failed load rejects with its error, reports nothing, and the next use loads again", async () => {
    const t = setup();
    const a = fakeOpponent("a", t.log);
    const failure = new Error("network");
    const result = track(t.controller.analyse(FEN, LIMITS));
    t.loads[0].reject(failure);
    await flush();
    expect(result.error).toBe(failure);
    expect(t.statuses).toEqual([]);
    void t.controller.analyse(FEN, LIMITS);
    t.loads[1].resolve(a.opponent);
    await flush();
    expect(a.opponent.analyse).toHaveBeenCalledTimes(1);
  });

  it("the caller's signal aborts it, while loading or searching: superseded", async () => {
    const t = setup();
    const a = fakeOpponent("a", t.log);
    const early = new AbortController();
    const whileLoading = track(t.controller.analyse(FEN, LIMITS, early.signal));
    early.abort();
    await flush();
    expect(codeOf(whileLoading.error)).toBe("superseded");
    t.loads[0].resolve(a.opponent);
    await flush();
    expect(a.opponent.analyse).not.toHaveBeenCalled();

    const late = new AbortController();
    const searching = track(t.controller.analyse(FEN, LIMITS, late.signal));
    await flush();
    late.abort();
    await flush();
    expect(codeOf(searching.error)).toBe("superseded");
    expect(a.opponent.dispose).not.toHaveBeenCalled();
  });

  it("rejects disposed after dispose, in flight and later, with no load", async () => {
    const t = await loaded();
    const inFlight = track(t.controller.analyse(FEN, LIMITS));
    await flush();
    const before = t.statuses.length;
    t.controller.dispose();
    await flush();
    expect(codeOf(inFlight.error)).toBe("disposed");
    const later = track(t.controller.analyse(FEN, LIMITS));
    await flush();
    expect(codeOf(later.error)).toBe("disposed");
    expect(t.load).toHaveBeenCalledTimes(1);
    expect(t.statuses.length).toBe(before);
  });

  it("a search waiting on the load when the controller is disposed rejects disposed", async () => {
    const t = setup();
    const a = fakeOpponent("a", t.log);
    const waiting = track(t.controller.analyse(FEN, LIMITS));
    t.controller.dispose();
    t.loads[0].resolve(a.opponent);
    await flush();
    expect(codeOf(waiting.error)).toBe("disposed");
    expect(a.opponent.analyse).not.toHaveBeenCalled();
    expect(a.opponent.dispose).toHaveBeenCalledTimes(1);
  });
});

describe("his turn stops review searches", () => {
  it("request aborts every review search before asking him; they reject superseded", async () => {
    const t = await loaded();
    const one = track(t.controller.analyse(FEN, LIMITS));
    const two = track(t.controller.analyse(FEN, LIMITS));
    await flush();
    t.controller.request(req(1, 1));
    await flush();
    expect(t.log.filter((l) => l.startsWith("a."))).toEqual([
      "a.analyse",
      "a.analyse",
      "a.abort",
      "a.abort",
      "a.chooseMove",
    ]);
    expect(codeOf(one.error)).toBe("superseded");
    expect(codeOf(two.error)).toBe("superseded");
    // His turn plays on, and the opponent is kept.
    t.a.last().resolve(CHOICE);
    await flush();
    expect(t.moves).toHaveLength(1);
    expect(t.a.opponent.dispose).not.toHaveBeenCalled();
    expect(t.statuses).not.toContain("failed");
  });

  it("a review search still waiting on the load is dropped too and never reaches him", async () => {
    const t = setup();
    const a = fakeOpponent("a", t.log);
    const waiting = track(t.controller.analyse(FEN, LIMITS));
    t.controller.request(req(1, 1));
    t.loads[0].resolve(a.opponent);
    await flush();
    expect(codeOf(waiting.error)).toBe("superseded");
    expect(a.opponent.analyse).not.toHaveBeenCalled();
    expect(a.opponent.chooseMove).toHaveBeenCalledTimes(1);
  });

  it("a repeated request aborts searches started since", async () => {
    const t = await loaded();
    t.controller.request(req(1, 1));
    await flush();
    const later = track(t.controller.analyse(FEN, LIMITS));
    await flush();
    t.controller.request(req(1, 1));
    await flush();
    expect(codeOf(later.error)).toBe("superseded");
    expect(t.a.opponent.chooseMove).toHaveBeenCalledTimes(1);
  });
});

describe("a broken review search replaces the engine", () => {
  it.each<OpponentErrorCode>(["engine-failed", "engine-timeout"])(
    "%s drops him, reports no status, and the next use loads fresh",
    async (code) => {
      const t = await loaded();
      const b = fakeOpponent("b", t.log);
      const before = t.statuses.length;
      const broken = track(t.controller.analyse(FEN, LIMITS));
      await flush();
      t.a.search().d.reject(err(code));
      await flush();
      expect(codeOf(broken.error)).toBe(code);
      expect(t.a.opponent.dispose).toHaveBeenCalledTimes(1);
      expect(t.statuses.length).toBe(before);

      const next = track(t.controller.analyse(FEN, LIMITS));
      expect(t.load).toHaveBeenCalledTimes(2);
      t.loads[1].resolve(b.opponent);
      await flush();
      b.search().d.resolve(ANALYSIS);
      await flush();
      expect(next.value).toEqual(ANALYSIS);

      // His next turn uses the fresh one too.
      t.controller.request(req(1, 1));
      await flush();
      expect(b.opponent.chooseMove).toHaveBeenCalledTimes(1);
      expect(t.a.opponent.chooseMove).not.toHaveBeenCalled();
    }
  );

  it.each<OpponentErrorCode>(["superseded", "disposed"])("%s keeps him", async (code) => {
    const t = await loaded();
    const p = track(t.controller.analyse(FEN, LIMITS));
    await flush();
    t.a.search().d.reject(err(code));
    await flush();
    expect(codeOf(p.error)).toBe(code);
    expect(t.a.opponent.dispose).not.toHaveBeenCalled();
  });

  it("a late failure from a replaced opponent doesn't drop the new one", async () => {
    const t = await loaded();
    const b = fakeOpponent("b", t.log);
    // A real opponent might still answer after dispose; this fake's dispose rejects, so fake the late one by hand.
    let lateFail!: (e: unknown) => void;
    t.a.opponent.analyse.mockImplementationOnce(() => new Promise<Analysis>((_, reject) => (lateFail = reject)));
    void t.controller.analyse(FEN, LIMITS).catch(() => {});
    void t.controller.analyse(FEN, LIMITS).catch(() => {});
    await flush();
    t.a.search().d.reject(err("engine-failed"));
    await flush();
    expect(t.a.opponent.dispose).toHaveBeenCalledTimes(1);
    void t.controller.analyse(FEN, LIMITS);
    t.loads[1].resolve(b.opponent);
    await flush();
    lateFail(err("engine-timeout"));
    await flush();
    expect(b.opponent.dispose).not.toHaveBeenCalled();
  });

  it("his move in flight on the dropped opponent fails visibly, and retry asks a fresh one", async () => {
    const t = await loaded();
    const b = fakeOpponent("b", t.log);
    // A review search started during his turn (only request aborts them).
    t.controller.request(req(1, 1));
    await flush();
    void t.controller.analyse(FEN, LIMITS).catch(() => {});
    await flush();
    t.a.search().d.reject(err("engine-failed"));
    await flush();
    expect(t.lastStatus()).toBe("failed");
    expect(t.moves).toEqual([]);
    t.controller.retry();
    t.loads[1].resolve(b.opponent);
    await flush();
    expect(b.opponent.chooseMove).toHaveBeenCalledTimes(1);
    b.last().resolve(CHOICE);
    await flush();
    expect(t.moves).toEqual([{ gameId: 1, ply: 1, choice: CHOICE }]);
  });
});

describe("cancel leaves review searches", () => {
  it("cancel doesn't abort a review search", async () => {
    const t = await loaded();
    const p = track(t.controller.analyse(FEN, LIMITS));
    await flush();
    t.controller.cancel();
    t.controller.cancel();
    await flush();
    expect(t.a.search().signal?.aborted).toBe(false);
    t.a.search().d.resolve(ANALYSIS);
    await flush();
    expect(p.value).toEqual(ANALYSIS);
  });

  it("retry doesn't abort a review search", async () => {
    const t = await loaded();
    t.controller.request(req(1, 1));
    await flush();
    t.a.last().reject(err("illegal-engine-move"));
    await flush();
    expect(t.lastStatus()).toBe("failed");
    const p = track(t.controller.analyse(FEN, LIMITS));
    await flush();
    t.controller.retry();
    await flush();
    expect(t.a.opponent.chooseMove).toHaveBeenCalledTimes(2);
    expect(t.a.search().signal?.aborted).toBe(false);
    t.a.search().d.resolve(ANALYSIS);
    await flush();
    expect(p.value).toEqual(ANALYSIS);
  });
});
