import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EngineError, type MoveEngine } from "../move-engine";
import { createUciEngine, type UciTransport } from "../uci-engine";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const LIMIT = "setoption name UCI_LimitStrength value true";

// A scripted engine: records every line sent, and lets the test push lines back.
function fakeTransport() {
  const sent: string[] = [];
  let lineCb: (line: string) => void = () => {};
  let errorCb: (err: unknown) => void = () => {};
  let terminated = 0;
  const transport: UciTransport = {
    send: (line) => sent.push(line),
    onLine: (cb) => (lineCb = cb),
    onError: (cb) => (errorCb = cb),
    terminate: () => (terminated += 1),
  };
  return {
    transport,
    sent,
    reply: (...lines: string[]) => lines.forEach((l) => lineCb(l)),
    fail: (err: unknown = new Error("boom")) => errorCb(err),
    terminated: () => terminated,
  };
}

// Runs the handshake to the point where searches may start.
function readyEngine() {
  const t = fakeTransport();
  const engine = createUciEngine(t.transport);
  t.reply("id name Stockfish", "uciok");
  t.reply("readyok");
  t.sent.length = 0;
  return { ...t, engine };
}

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(EngineError);
    return (e as EngineError).code;
  }
  throw new Error("expected a rejection");
}

// Lets queued microtasks run, so promise state is observable.
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

function settledState(p: Promise<unknown>) {
  const state = { settled: false };
  p.then(
    () => (state.settled = true),
    () => (state.settled = true),
  );
  return state;
}

describe("handshake order", () => {
  it("sends uci, waits for uciok, limits strength once, then isready before the first search", async () => {
    const t = fakeTransport();
    const engine = createUciEngine(t.transport);
    expect(t.sent).toEqual(["uci"]);

    const p = engine.bestMove(START, { elo: 2000 });
    // nothing more until uciok
    t.reply("id name Stockfish 18", "option name UCI_Elo type spin");
    expect(t.sent).toEqual(["uci"]);

    t.reply("uciok");
    expect(t.sent).toEqual(["uci", LIMIT, "isready"]);

    // no search before readyok
    t.reply("readyok");
    expect(t.sent.slice(0, 3)).toEqual(["uci", LIMIT, "isready"]);
    expect(t.sent.slice(3)).toEqual([
      "setoption name UCI_Elo value 2000",
      `position fen ${START}`,
      "go movetime 1000",
    ]);
    t.reply("bestmove e2e4");
    await expect(p).resolves.toBe("e2e4");

    const q = engine.bestMove(START, { elo: 2100 });
    t.reply("bestmove d2d4");
    await expect(q).resolves.toBe("d2d4");
    expect(t.sent.filter((l) => l === LIMIT)).toHaveLength(1);
    expect(t.sent.filter((l) => l === "uci")).toHaveLength(1);
  });

  it("does not search while only uciok has arrived", () => {
    const t = fakeTransport();
    const engine = createUciEngine(t.transport);
    void engine.bestMove(START, { elo: 2000 });
    t.reply("uciok");
    expect(t.sent.some((l) => l.startsWith("position"))).toBe(false);
  });

  it("ignores a stray readyok or bestmove before the handshake", () => {
    const t = fakeTransport();
    const engine = createUciEngine(t.transport);
    const p = engine.bestMove(START, { elo: 2000 });
    t.reply("readyok", "bestmove a2a3");
    expect(t.sent).toEqual(["uci"]);
    t.reply("uciok", "readyok", "bestmove e2e4");
    return expect(p).resolves.toBe("e2e4");
  });
});

describe("bestMove resolves the engine answer", () => {
  it("sends position fen and go movetime, resolves the bestmove's UCI", async () => {
    const { engine, sent, reply } = readyEngine();
    const p = engine.bestMove(START, { elo: 2000 });
    expect(sent).toEqual(["setoption name UCI_Elo value 2000", `position fen ${START}`, "go movetime 1000"]);
    reply("info depth 1 score cp 30 pv e2e4", "bestmove e2e4 ponder e7e5");
    await expect(p).resolves.toBe("e2e4");
  });

  it("uses the given movetimeMs", async () => {
    const { engine, sent, reply } = readyEngine();
    const p = engine.bestMove(START, { elo: 2000, movetimeMs: 250 });
    expect(sent).toContain("go movetime 250");
    reply("bestmove g1f3");
    await expect(p).resolves.toBe("g1f3");
  });

  it("keeps the promotion suffix", async () => {
    const { engine, reply } = readyEngine();
    const p = engine.bestMove("8/P7/8/8/8/8/8/k6K w - - 0 1", { elo: 2000 });
    reply("bestmove a7a8q");
    await expect(p).resolves.toBe("a7a8q");
  });

  it('"bestmove (none)" resolves null', async () => {
    const { engine, reply } = readyEngine();
    const p = engine.bestMove("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", { elo: 2000 });
    reply("info depth 0 score mate 0", "bestmove (none)");
    await expect(p).resolves.toBeNull();
  });

  it("handles several lines in one message and trims line endings", async () => {
    const { engine, reply } = readyEngine();
    const p = engine.bestMove(START, { elo: 2000 });
    reply("info depth 1\r\nbestmove c2c4\r\n");
    await expect(p).resolves.toBe("c2c4");
  });

  it("runs calls made at the same time one after the other, in order", async () => {
    const { engine, sent, reply } = readyEngine();
    const a = engine.bestMove(START, { elo: 2000 });
    const b = engine.bestMove("8/8/8/8/8/8/8/K6k w - - 0 1", { elo: 2000 });
    expect(sent.filter((l) => l.startsWith("go"))).toHaveLength(1);
    reply("bestmove e2e4");
    await expect(a).resolves.toBe("e2e4");
    expect(sent.filter((l) => l.startsWith("go"))).toHaveLength(2);
    expect(sent).toContain("position fen 8/8/8/8/8/8/8/K6k w - - 0 1");
    reply("bestmove a1b1");
    await expect(b).resolves.toBe("a1b1");
  });

  it("ignores a bestmove when no search is running", async () => {
    const { engine, reply } = readyEngine();
    reply("bestmove h2h3");
    const p = engine.bestMove(START, { elo: 2000 });
    reply("bestmove e2e4");
    await expect(p).resolves.toBe("e2e4");
  });

  it("newGame sends ucinewgame and waits for readyok before the next position", async () => {
    const { engine, sent, reply } = readyEngine();
    engine.newGame();
    expect(sent).toEqual([]);
    const p = engine.bestMove(START, { elo: 2000 });
    expect(sent).toEqual(["ucinewgame", "isready"]);
    reply("readyok");
    expect(sent.slice(2)).toEqual(["setoption name UCI_Elo value 2000", `position fen ${START}`, "go movetime 1000"]);
    reply("bestmove e2e4");
    await expect(p).resolves.toBe("e2e4");
  });

  it("newGame during a search waits for that search to end", async () => {
    const { engine, sent, reply } = readyEngine();
    const a = engine.bestMove(START, { elo: 2000 });
    engine.newGame();
    const b = engine.bestMove(START, { elo: 2000 });
    expect(sent).not.toContain("ucinewgame");
    reply("bestmove e2e4");
    await expect(a).resolves.toBe("e2e4");
    expect(sent.slice(-2)).toEqual(["ucinewgame", "isready"]);
    reply("readyok", "bestmove d2d4");
    await expect(b).resolves.toBe("d2d4");
  });
});

describe("elo is clamped and sent on change", () => {
  const eloSent = (sent: string[]) =>
    sent.filter((l) => l.startsWith("setoption name UCI_Elo")).map((l) => l.split(" ").pop());

  it("rounds and clamps to 1320-3190", async () => {
    const { engine, sent, reply } = readyEngine();
    for (const elo of [1000, 4000, 2100.6, 1319.4, 3190.4]) {
      const p = engine.bestMove(START, { elo });
      reply("bestmove e2e4");
      await p;
    }
    expect(eloSent(sent)).toEqual(["1320", "3190", "2101", "1320", "3190"]);
  });

  it("sends UCI_Elo before go only when it differs from the last value sent", async () => {
    const { engine, sent, reply } = readyEngine();
    for (const elo of [2000, 2000, 2000.4, 1999.6, 2100, 2000]) {
      const p = engine.bestMove(START, { elo });
      reply("bestmove e2e4");
      await p;
    }
    // 2000.4 and 1999.6 round to 2000, so they send nothing
    expect(eloSent(sent)).toEqual(["2000", "2100", "2000"]);
    const firstGo = sent.indexOf("go movetime 1000");
    expect(sent.indexOf("setoption name UCI_Elo value 2000")).toBeLessThan(firstGo);
  });

  it("clamps infinite elo to the ends", async () => {
    const { engine, sent, reply } = readyEngine();
    for (const elo of [Infinity, -Infinity]) {
      const p = engine.bestMove(START, { elo });
      reply("bestmove e2e4");
      await p;
    }
    expect(eloSent(sent)).toEqual(["3190", "1320"]);
  });

  it("rejects a NaN elo without sending anything", async () => {
    const { engine, sent } = readyEngine();
    await expect(engine.bestMove(START, { elo: NaN })).rejects.toBeInstanceOf(RangeError);
    expect(sent).toEqual([]);
  });
});

describe("abort discards the stale answer", () => {
  it("sends stop, rejects aborted, ignores the stale bestmove, and the next position waits for it", async () => {
    const { engine, sent, reply } = readyEngine();
    const ctl = new AbortController();
    const a = engine.bestMove(START, { elo: 2000 }, ctl.signal);
    ctl.abort();
    expect(await codeOf(a)).toBe("aborted");
    expect(sent.at(-1)).toBe("stop");

    const next = "8/8/8/8/8/8/8/K6k w - - 0 1";
    const b = engine.bestMove(next, { elo: 2000 });
    expect(sent.filter((l) => l.startsWith("position"))).toHaveLength(1);

    // the stale answer to the aborted search must not resolve b
    reply("bestmove e2e4");
    expect(sent.filter((l) => l.startsWith("position"))).toHaveLength(2);
    expect(sent.at(-2)).toBe(`position fen ${next}`);
    const b2 = settledState(b);
    await flush();
    expect(b2.settled).toBe(false);

    reply("bestmove a1b1");
    await expect(b).resolves.toBe("a1b1");
  });

  it("an already aborted signal rejects at once and sends nothing", async () => {
    const { engine, sent } = readyEngine();
    const ctl = new AbortController();
    ctl.abort();
    expect(await codeOf(engine.bestMove(START, { elo: 2000 }, ctl.signal))).toBe("aborted");
    expect(sent).toEqual([]);
  });

  it("aborting a queued call drops it without sending stop", async () => {
    const { engine, sent, reply } = readyEngine();
    const a = engine.bestMove(START, { elo: 2000 });
    const ctl = new AbortController();
    const b = engine.bestMove("8/8/8/8/8/8/8/K6k w - - 0 1", { elo: 2000 }, ctl.signal);
    ctl.abort();
    expect(await codeOf(b)).toBe("aborted");
    expect(sent).not.toContain("stop");
    reply("bestmove e2e4");
    await expect(a).resolves.toBe("e2e4");
    expect(sent.filter((l) => l.startsWith("position"))).toHaveLength(1);
  });

  it("aborting during the handshake drops the call; the next one runs after readyok", async () => {
    const t = fakeTransport();
    const engine = createUciEngine(t.transport);
    const ctl = new AbortController();
    const a = engine.bestMove(START, { elo: 2000 }, ctl.signal);
    ctl.abort();
    expect(await codeOf(a)).toBe("aborted");
    const b = engine.bestMove(START, { elo: 2000 });
    t.reply("uciok", "readyok");
    expect(t.sent).not.toContain("stop");
    t.reply("bestmove e2e4");
    await expect(b).resolves.toBe("e2e4");
  });

  it("aborting after the answer changes nothing", async () => {
    const { engine, sent, reply } = readyEngine();
    const ctl = new AbortController();
    const a = engine.bestMove(START, { elo: 2000 }, ctl.signal);
    reply("bestmove e2e4");
    await expect(a).resolves.toBe("e2e4");
    ctl.abort();
    expect(sent).not.toContain("stop");
    const b = engine.bestMove(START, { elo: 2000 });
    reply("bestmove d2d4");
    await expect(b).resolves.toBe("d2d4");
  });

  it("two aborts in a row wait for both stale answers", async () => {
    const { engine, sent, reply } = readyEngine();
    const c1 = new AbortController();
    const a = engine.bestMove(START, { elo: 2000 }, c1.signal);
    c1.abort();
    await codeOf(a);
    const c2 = new AbortController();
    const b = engine.bestMove(START, { elo: 2000 }, c2.signal);
    reply("bestmove e2e4"); // stale for a; now b starts
    c2.abort();
    await codeOf(b);
    const c = engine.bestMove(START, { elo: 2000 });
    const positions = () => sent.filter((l) => l.startsWith("position")).length;
    expect(positions()).toBe(2);
    reply("bestmove d2d4"); // stale for b
    expect(positions()).toBe(3);
    reply("bestmove c2c4");
    await expect(c).resolves.toBe("c2c4");
  });
});

describe("search timeout", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("no bestmove within movetime + 5000 ms rejects timeout", async () => {
    const { engine, sent } = readyEngine();
    const p = engine.bestMove(START, { elo: 2000 });
    const state = settledState(p);
    await vi.advanceTimersByTimeAsync(5999);
    expect(state.settled).toBe(false);
    const code = codeOf(p);
    await vi.advanceTimersByTimeAsync(1);
    expect(await code).toBe("timeout");
    expect(sent.at(-1)).toBe("stop");
  });

  it("uses the given movetime for the limit", async () => {
    const { engine } = readyEngine();
    const p = engine.bestMove(START, { elo: 2000, movetimeMs: 200 });
    const state = settledState(p);
    await vi.advanceTimersByTimeAsync(5199);
    expect(state.settled).toBe(false);
    const code = codeOf(p);
    await vi.advanceTimersByTimeAsync(1);
    expect(await code).toBe("timeout");
  });

  it("an answer in time clears the timer", async () => {
    const { engine, reply } = readyEngine();
    const p = engine.bestMove(START, { elo: 2000 });
    await vi.advanceTimersByTimeAsync(5999);
    reply("bestmove e2e4");
    await expect(p).resolves.toBe("e2e4");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("a late answer after a timeout is discarded, and the next search waits for it", async () => {
    const { engine, sent, reply } = readyEngine();
    const p = engine.bestMove(START, { elo: 2000 });
    const code = codeOf(p);
    await vi.advanceTimersByTimeAsync(6000);
    expect(await code).toBe("timeout");
    const q = engine.bestMove(START, { elo: 2000 });
    expect(sent.filter((l) => l.startsWith("position"))).toHaveLength(1);
    reply("bestmove e2e4"); // late answer to p
    reply("bestmove d2d4");
    await expect(q).resolves.toBe("d2d4");
  });

  it("an engine that never finishes the handshake times out instead of hanging", async () => {
    const t = fakeTransport();
    const engine = createUciEngine(t.transport);
    const code = codeOf(engine.bestMove(START, { elo: 2000 }));
    await vi.advanceTimersByTimeAsync(6000);
    expect(await code).toBe("timeout");
    expect(t.sent).toEqual(["uci"]);
  });

  it("uses the injected timer functions", async () => {
    const t = fakeTransport();
    const set = vi.fn((fn: () => void, ms: number) => setTimeout(fn, ms));
    const clear = vi.fn((id: ReturnType<typeof setTimeout>) => clearTimeout(id));
    const engine = createUciEngine(t.transport, { setTimeout: set, clearTimeout: clear });
    t.reply("uciok", "readyok");
    const p = engine.bestMove(START, { elo: 2000 });
    expect(set).toHaveBeenCalledWith(expect.any(Function), 6000);
    t.reply("bestmove e2e4");
    await p;
    expect(clear).toHaveBeenCalled();
  });
});

describe("failure and dispose", () => {
  it("a transport error rejects the pending call and every later call with failed", async () => {
    const { engine, fail, sent } = readyEngine();
    const p = engine.bestMove(START, { elo: 2000 });
    const queued = engine.bestMove(START, { elo: 2000 });
    fail();
    expect(await codeOf(p)).toBe("failed");
    expect(await codeOf(queued)).toBe("failed");
    const count = sent.length;
    expect(await codeOf(engine.bestMove(START, { elo: 2000 }))).toBe("failed");
    engine.newGame();
    expect(sent.length).toBe(count);
  });

  it("an error during the handshake fails the waiting call", async () => {
    const t = fakeTransport();
    const engine = createUciEngine(t.transport);
    const p = engine.bestMove(START, { elo: 2000 });
    t.fail();
    expect(await codeOf(p)).toBe("failed");
  });

  it("lines after a failure are ignored", async () => {
    const { engine, fail, reply } = readyEngine();
    const p = engine.bestMove(START, { elo: 2000 });
    fail();
    reply("bestmove e2e4");
    expect(await codeOf(p)).toBe("failed");
  });

  it("dispose terminates and rejects pending and later calls with disposed", async () => {
    const { engine, terminated, sent } = readyEngine();
    const p = engine.bestMove(START, { elo: 2000 });
    const queued = engine.bestMove(START, { elo: 2000 });
    engine.dispose();
    expect(terminated()).toBe(1);
    expect(await codeOf(p)).toBe("disposed");
    expect(await codeOf(queued)).toBe("disposed");
    const count = sent.length;
    expect(await codeOf(engine.bestMove(START, { elo: 2000 }))).toBe("disposed");
    engine.newGame();
    expect(sent.length).toBe(count);
  });

  it("dispose twice terminates once", () => {
    const { engine, terminated } = readyEngine();
    engine.dispose();
    engine.dispose();
    expect(terminated()).toBe(1);
  });

  it("dispose after a failure still terminates, and later calls say disposed", async () => {
    const { engine, fail, terminated } = readyEngine();
    fail();
    engine.dispose();
    expect(terminated()).toBe(1);
    expect(await codeOf(engine.bestMove(START, { elo: 2000 }))).toBe("disposed");
  });

  it("dispose clears the search timer", () => {
    vi.useFakeTimers();
    try {
      const { engine } = readyEngine();
      engine.bestMove(START, { elo: 2000 }).catch(() => {});
      expect(vi.getTimerCount()).toBe(1);
      engine.dispose();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("EngineError carries its code", () => {
    const e = new EngineError("timeout");
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe("timeout");
    expect(e.name).toBe("EngineError");
  });
});

// Keeps the type in use, so the interface shape is checked by tsc.
export type _Check = MoveEngine;
