import { afterEach, describe, expect, it, vi } from "vitest";

import { initialGameState } from "game/engine/game-state";
import { type MoveChoice, OpponentError, type OpponentErrorCode } from "game/opponent/opponent";
import { uciToMove } from "game/opponent/position";
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

const SETTINGS = { elo: 2100, clock: { baseMs: 600_000, incrementMs: 0 } };
const req = (gameId: number, ply: number): TurnRequest => ({ gameId, ply, state: start, settings: SETTINGS });

/** An opponent whose every `chooseMove` waits until the test settles it. */
function fakeOpponent(name: string, log: string[]) {
  const asks: Deferred<MoveChoice>[] = [];
  const opponent = {
    chooseMove: vi.fn((..._args: unknown[]): Promise<MoveChoice> => {
      log.push(`${name}.chooseMove`);
      const d = deferred<MoveChoice>();
      asks.push(d);
      return d.promise;
    }),
    newGame: vi.fn(() => {
      log.push(`${name}.newGame`);
    }),
    dispose: vi.fn(() => {
      log.push(`${name}.dispose`);
    }),
  } satisfies LiemOpponent;
  return { opponent, asks, last: () => asks[asks.length - 1] };
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

  it.each<OpponentErrorCode>(["illegal-engine-move", "engine-timeout"])(
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
