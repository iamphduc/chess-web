import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchLimits } from "../lines";
import { EngineError, type Analysis, type MoveEngine } from "../move-engine";
import { createUciEngine, type UciTransport } from "../uci-engine";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const OTHER = "8/8/8/8/8/8/8/K6k w - - 0 1";
const LIM: SearchLimits = { depth: 10, multiPv: 1, movetimeMs: 1000 };
const FOUR: SearchLimits = { depth: 8, multiPv: 4, movetimeMs: 500 };

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

const best = (p: Promise<Analysis>) => p.then((a) => a.bestMove);

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

const isStrength = (l: string) => /UCI_LimitStrength|UCI_Elo/.test(l);

describe("handshake order", () => {
  it("handshake sends uci then isready and no strength options", async () => {
    const t = fakeTransport();
    const engine = createUciEngine(t.transport);
    expect(t.sent).toEqual(["uci"]);

    const p = engine.analyse(START, LIM);
    // nothing more until uciok
    t.reply("id name Stockfish 18", "option name UCI_Elo type spin default 1320 min 1320 max 3190");
    expect(t.sent).toEqual(["uci"]);

    t.reply("uciok");
    expect(t.sent).toEqual(["uci", "isready"]);

    // no search before readyok
    t.reply("readyok");
    expect(t.sent).toEqual([
      "uci",
      "isready",
      "setoption name MultiPV value 1",
      `position fen ${START}`,
      "go depth 10 movetime 1000",
    ]);
    t.reply("bestmove e2e4");
    await expect(best(p)).resolves.toBe("e2e4");

    engine.newGame();
    const q = engine.analyse(START, FOUR);
    t.reply("readyok", "bestmove d2d4");
    await expect(best(q)).resolves.toBe("d2d4");
    expect(t.sent.filter(isStrength)).toEqual([]);
    expect(t.sent.filter((l) => l === "uci")).toHaveLength(1);
  });

  it("does not search while only uciok has arrived", () => {
    const t = fakeTransport();
    const engine = createUciEngine(t.transport);
    void engine.analyse(START, LIM);
    t.reply("uciok");
    expect(t.sent.some((l) => l.startsWith("position"))).toBe(false);
  });

  it("ignores a stray readyok, info or bestmove before the handshake", async () => {
    const t = fakeTransport();
    const engine = createUciEngine(t.transport);
    const p = engine.analyse(START, LIM);
    t.reply("readyok", "info depth 5 score cp 10 pv a2a3", "bestmove a2a3");
    expect(t.sent).toEqual(["uci"]);
    t.reply("uciok", "readyok", "bestmove e2e4");
    await expect(p).resolves.toEqual({ lines: [], bestMove: "e2e4" });
  });
});

describe("analyse sends the search", () => {
  it("analyse sends MultiPV, position and go depth with movetime", async () => {
    const { engine, sent, reply } = readyEngine();
    const p = engine.analyse(START, { depth: 12, multiPv: 3, movetimeMs: 800 });
    expect(sent).toEqual([
      "setoption name MultiPV value 3",
      `position fen ${START}`,
      "go depth 12 movetime 800",
    ]);
    reply("bestmove e2e4 ponder e7e5");
    await expect(best(p)).resolves.toBe("e2e4");
  });

  it("MultiPV is sent only when it changes", async () => {
    const { engine, sent, reply } = readyEngine();
    for (const multiPv of [4, 4, 2, 2, 4, 1]) {
      const p = engine.analyse(START, { ...FOUR, multiPv });
      reply("bestmove e2e4");
      await p;
    }
    const multi = sent.filter((l) => l.startsWith("setoption name MultiPV"));
    expect(multi.map((l) => l.split(" ").pop())).toEqual(["4", "2", "4", "1"]);
    // each one goes before its position line
    const firstPosition = sent.findIndex((l) => l.startsWith("position"));
    expect(sent.indexOf("setoption name MultiPV value 4")).toBeLessThan(firstPosition);
  });

  it("MultiPV survives newGame (it is not sent again)", async () => {
    const { engine, sent, reply } = readyEngine();
    const a = engine.analyse(START, FOUR);
    reply("bestmove e2e4");
    await a;
    engine.newGame();
    const b = engine.analyse(START, FOUR);
    reply("readyok", "bestmove e2e4");
    await b;
    expect(sent.filter((l) => l.startsWith("setoption name MultiPV"))).toHaveLength(1);
  });

  it("rounds a fractional movetime, never below 1", async () => {
    const { engine, sent, reply } = readyEngine();
    for (const movetimeMs of [250.4, 0.3]) {
      const p = engine.analyse(START, { ...LIM, movetimeMs });
      reply("bestmove e2e4");
      await p;
    }
    expect(sent.filter((l) => l.startsWith("go"))).toEqual(["go depth 10 movetime 250", "go depth 10 movetime 1"]);
  });

  it("accepts the bounds: depth 1 and 30, multiPv 1 and 6", async () => {
    const { engine, sent, reply } = readyEngine();
    for (const limits of [
      { depth: 1, multiPv: 1, movetimeMs: 100 },
      { depth: 30, multiPv: 6, movetimeMs: 100 },
    ]) {
      const p = engine.analyse(START, limits);
      reply("bestmove e2e4");
      await p;
    }
    expect(sent.filter((l) => l.startsWith("go"))).toEqual(["go depth 1 movetime 100", "go depth 30 movetime 100"]);
  });

  it("rejects bad limits without sending anything", async () => {
    const { engine, sent } = readyEngine();
    const bad: SearchLimits[] = [
      { ...LIM, depth: 0 },
      { ...LIM, depth: 31 },
      { ...LIM, depth: 2.5 },
      { ...LIM, depth: NaN },
      { ...LIM, depth: -3 },
      { ...LIM, multiPv: 0 },
      { ...LIM, multiPv: 7 },
      { ...LIM, multiPv: 1.5 },
      { ...LIM, multiPv: NaN },
      { ...LIM, movetimeMs: NaN },
      { ...LIM, movetimeMs: 0 },
      { ...LIM, movetimeMs: -100 },
      { ...LIM, movetimeMs: Infinity },
    ];
    for (const limits of bad) {
      await expect(engine.analyse(START, limits), JSON.stringify(limits)).rejects.toBeInstanceOf(RangeError);
    }
    expect(sent).toEqual([]);
  });

  it("bad limits during the handshake send nothing and leave the next search intact", async () => {
    const t = fakeTransport();
    const engine = createUciEngine(t.transport);
    await expect(engine.analyse(START, { ...LIM, depth: 0 })).rejects.toBeInstanceOf(RangeError);
    const p = engine.analyse(START, LIM);
    t.reply("uciok", "readyok");
    expect(t.sent.filter((l) => l.startsWith("go"))).toEqual(["go depth 10 movetime 1000"]);
    t.reply("bestmove e2e4");
    await expect(best(p)).resolves.toBe("e2e4");
  });

  it("keeps the promotion suffix", async () => {
    const { engine, reply } = readyEngine();
    const p = engine.analyse("8/P7/8/8/8/8/8/k6K w - - 0 1", LIM);
    reply("bestmove a7a8q");
    await expect(best(p)).resolves.toBe("a7a8q");
  });

  it("handles several lines in one message and trims line endings", async () => {
    const { engine, reply } = readyEngine();
    const p = engine.analyse(START, LIM);
    reply("info depth 1 multipv 1 score cp 12 pv c2c4\r\nbestmove c2c4\r\n");
    await expect(p).resolves.toEqual({
      lines: [{ move: "c2c4", score: { cp: 12 }, depth: 1 }],
      bestMove: "c2c4",
    });
  });

  it("runs calls made at the same time one after the other, in order", async () => {
    const { engine, sent, reply } = readyEngine();
    const a = engine.analyse(START, LIM);
    const b = engine.analyse(OTHER, LIM);
    expect(sent.filter((l) => l.startsWith("go"))).toHaveLength(1);
    reply("info depth 3 score cp 20 pv e2e4", "bestmove e2e4");
    await expect(a).resolves.toEqual({ lines: [{ move: "e2e4", score: { cp: 20 }, depth: 3 }], bestMove: "e2e4" });
    expect(sent.filter((l) => l.startsWith("go"))).toHaveLength(2);
    expect(sent).toContain(`position fen ${OTHER}`);
    reply("bestmove a1b1");
    // a's lines don't carry into b
    await expect(b).resolves.toEqual({ lines: [], bestMove: "a1b1" });
  });

  it("ignores a bestmove or info when no search is running", async () => {
    const { engine, reply } = readyEngine();
    reply("info depth 9 score cp 99 pv h2h3", "bestmove h2h3");
    const p = engine.analyse(START, LIM);
    reply("bestmove e2e4");
    await expect(p).resolves.toEqual({ lines: [], bestMove: "e2e4" });
  });

  it("newGame sends ucinewgame and waits for readyok before the next position", async () => {
    const { engine, sent, reply } = readyEngine();
    engine.newGame();
    expect(sent).toEqual([]);
    const p = engine.analyse(START, LIM);
    expect(sent).toEqual(["ucinewgame", "isready"]);
    reply("readyok");
    expect(sent.slice(2)).toEqual([
      "setoption name MultiPV value 1",
      `position fen ${START}`,
      "go depth 10 movetime 1000",
    ]);
    reply("bestmove e2e4");
    await expect(best(p)).resolves.toBe("e2e4");
  });

  it("newGame during a search waits for that search to end", async () => {
    const { engine, sent, reply } = readyEngine();
    const a = engine.analyse(START, LIM);
    engine.newGame();
    const b = engine.analyse(START, LIM);
    expect(sent).not.toContain("ucinewgame");
    reply("bestmove e2e4");
    await expect(best(a)).resolves.toBe("e2e4");
    expect(sent.slice(-2)).toEqual(["ucinewgame", "isready"]);
    reply("info depth 4 score cp 1 pv a2a3"); // no search runs while readyok is owed
    reply("readyok", "bestmove d2d4");
    await expect(b).resolves.toEqual({ lines: [], bestMove: "d2d4" });
  });
});

describe("info lines", () => {
  it("collects the latest scored line per multipv", async () => {
    const { engine, reply } = readyEngine();
    const p = engine.analyse(START, FOUR);
    reply(
      "info string NNUE evaluation using nn-xyz.nnue enabled",
      "info depth 1 seldepth 1 multipv 1 score cp 40 nodes 20 nps 2000 time 1 pv e2e4",
      "info depth 1 seldepth 1 multipv 2 score cp 35 nodes 40 pv d2d4",
      "info depth 1 seldepth 1 multipv 3 score cp 20 nodes 60 pv g1f3",
      "info depth 2 multipv 3 score cp 22 pv c2c4 e7e5",
      "info depth 2 multipv 2 score cp 30 pv g1f3 d7d5",
      "info depth 2 multipv 1 score cp 41 upperbound pv a2a3", // bound: kept out
      "info depth 2 multipv 1 score cp 45 lowerbound pv h2h3", // bound: kept out
      "info depth 2 currmove e2e4 currmovenumber 1", // no pv
      "info depth 2 multipv 4 score mate -3 pv f2f3 e7e5",
      "info depth 2 multipv 4 score cp 10", // no pv
      "info depth 2 nodes 900 time 3", // no score
      "bestmove e2e4 ponder e7e5",
    );
    await expect(p).resolves.toEqual({
      lines: [
        { move: "e2e4", score: { cp: 40 }, depth: 1 },
        { move: "g1f3", score: { cp: 30 }, depth: 2 },
        { move: "c2c4", score: { cp: 22 }, depth: 2 },
        { move: "f2f3", score: { mate: -3 }, depth: 2 },
      ],
      bestMove: "e2e4",
    });
  });

  it("a missing multipv counts as line 1", async () => {
    const { engine, reply } = readyEngine();
    const p = engine.analyse(START, LIM);
    reply("info depth 3 score cp 15 pv e2e4", "info depth 4 score mate 2 pv d1h5", "bestmove d1h5");
    await expect(p).resolves.toEqual({ lines: [{ move: "d1h5", score: { mate: 2 }, depth: 4 }], bestMove: "d1h5" });
  });

  it("drops lines past the requested multipv", async () => {
    const { engine, reply } = readyEngine();
    const p = engine.analyse(START, { ...FOUR, multiPv: 2 });
    reply(
      "info depth 5 multipv 1 score cp 30 pv e2e4",
      "info depth 5 multipv 2 score cp 25 pv d2d4",
      "info depth 5 multipv 3 score cp 20 pv g1f3",
      "info depth 5 multipv 7 score cp 10 pv c2c4",
      "bestmove e2e4",
    );
    const { lines } = await p;
    expect(lines.map((l) => l.move)).toEqual(["e2e4", "d2d4"]);
  });

  it("skips lines with a bad multipv, depth or score", async () => {
    const { engine, reply } = readyEngine();
    const p = engine.analyse(START, FOUR);
    reply(
      "info depth 5 multipv 0 score cp 30 pv a2a3",
      "info depth 5 multipv x score cp 30 pv a2a4",
      "info depth 5 multipv 1.5 score cp 30 pv b2b3",
      "info depth x multipv 2 score cp 30 pv b2b4",
      "info multipv 2 score cp 30 pv c2c3", // no depth
      "info depth 5 multipv 3 score cp nan pv c2c4",
      "info depth 5 multipv 3 score cp pv d2d3",
      "info depth 5 multipv 3 score mate 1.5 pv d2d4",
      "info depth 5 multipv 3 score wdl 300 400 300 pv e2e3",
      "info depth 5 multipv 4 score cp 12 pv",
      "info depth 5 multipv 1 score cp 18 pv g1f3",
      "bestmove g1f3",
    );
    await expect(p).resolves.toEqual({
      lines: [{ move: "g1f3", score: { cp: 18 }, depth: 5 }],
      bestMove: "g1f3",
    });
  });

  it("keeps a move once, at its first multipv", async () => {
    const { engine, reply } = readyEngine();
    const p = engine.analyse(START, FOUR);
    reply(
      "info depth 6 multipv 1 score cp 30 pv e2e4 e7e5",
      "info depth 6 multipv 2 score cp 28 pv d2d4",
      "info depth 6 multipv 3 score cp 20 pv e2e4 c7c5",
      "bestmove e2e4",
    );
    const { lines } = await p;
    expect(lines).toEqual([
      { move: "e2e4", score: { cp: 30 }, depth: 6 },
      { move: "d2d4", score: { cp: 28 }, depth: 6 },
    ]);
  });

  it("bestmove none resolves no lines", async () => {
    const { engine, reply } = readyEngine();
    const p = engine.analyse("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", FOUR);
    reply("info depth 0 score mate 0", "info depth 1 multipv 1 score cp 0 pv h8g8", "bestmove (none)");
    await expect(p).resolves.toEqual({ lines: [], bestMove: null });
  });

  it("a bare bestmove resolves no move", async () => {
    const { engine, reply } = readyEngine();
    const p = engine.analyse(START, LIM);
    reply("bestmove");
    await expect(p).resolves.toEqual({ lines: [], bestMove: null });
  });
});

describe("abort discards the stale answer", () => {
  it("sends stop, rejects aborted, ignores the stale bestmove, and the next position waits for it", async () => {
    const { engine, sent, reply } = readyEngine();
    const ctl = new AbortController();
    const a = engine.analyse(START, LIM, ctl.signal);
    ctl.abort();
    expect(await codeOf(a)).toBe("aborted");
    expect(sent.at(-1)).toBe("stop");

    const b = engine.analyse(OTHER, LIM);
    expect(sent.filter((l) => l.startsWith("position"))).toHaveLength(1);

    // the stale answer to the aborted search must not resolve b
    reply("bestmove e2e4");
    expect(sent.filter((l) => l.startsWith("position"))).toHaveLength(2);
    expect(sent.at(-2)).toBe(`position fen ${OTHER}`);
    const b2 = settledState(b);
    await flush();
    expect(b2.settled).toBe(false);

    reply("bestmove a1b1");
    await expect(best(b)).resolves.toBe("a1b1");
  });

  it("info lines from an aborted search are dropped", async () => {
    const { engine, reply } = readyEngine();
    const ctl = new AbortController();
    const a = engine.analyse(START, FOUR, ctl.signal);
    reply("info depth 3 multipv 1 score cp 30 pv e2e4");
    ctl.abort();
    expect(await codeOf(a)).toBe("aborted");
    const b = engine.analyse(OTHER, FOUR);
    // the aborted search's last words, then its stale bestmove
    reply("info depth 4 multipv 1 score cp 33 pv d2d4", "info depth 4 multipv 2 score cp 31 pv c2c4");
    reply("bestmove d2d4");
    // now b runs
    reply("info depth 2 multipv 1 score cp 0 pv a1b1", "bestmove a1b1");
    await expect(b).resolves.toEqual({
      lines: [{ move: "a1b1", score: { cp: 0 }, depth: 2 }],
      bestMove: "a1b1",
    });
  });

  it("an already aborted signal rejects at once and sends nothing", async () => {
    const { engine, sent } = readyEngine();
    const ctl = new AbortController();
    ctl.abort();
    expect(await codeOf(engine.analyse(START, LIM, ctl.signal))).toBe("aborted");
    expect(sent).toEqual([]);
  });

  it("aborting a queued call drops it without sending stop", async () => {
    const { engine, sent, reply } = readyEngine();
    const a = engine.analyse(START, LIM);
    const ctl = new AbortController();
    const b = engine.analyse(OTHER, LIM, ctl.signal);
    ctl.abort();
    expect(await codeOf(b)).toBe("aborted");
    expect(sent).not.toContain("stop");
    reply("bestmove e2e4");
    await expect(best(a)).resolves.toBe("e2e4");
    expect(sent.filter((l) => l.startsWith("position"))).toHaveLength(1);
  });

  it("aborting during the handshake drops the call; the next one runs after readyok", async () => {
    const t = fakeTransport();
    const engine = createUciEngine(t.transport);
    const ctl = new AbortController();
    const a = engine.analyse(START, LIM, ctl.signal);
    ctl.abort();
    expect(await codeOf(a)).toBe("aborted");
    const b = engine.analyse(START, LIM);
    t.reply("uciok", "readyok");
    expect(t.sent).not.toContain("stop");
    t.reply("bestmove e2e4");
    await expect(best(b)).resolves.toBe("e2e4");
  });

  it("aborting after the answer changes nothing", async () => {
    const { engine, sent, reply } = readyEngine();
    const ctl = new AbortController();
    const a = engine.analyse(START, LIM, ctl.signal);
    reply("bestmove e2e4");
    await expect(best(a)).resolves.toBe("e2e4");
    ctl.abort();
    expect(sent).not.toContain("stop");
    const b = engine.analyse(START, LIM);
    reply("bestmove d2d4");
    await expect(best(b)).resolves.toBe("d2d4");
  });

  it("two aborts in a row wait for both stale answers", async () => {
    const { engine, sent, reply } = readyEngine();
    const c1 = new AbortController();
    const a = engine.analyse(START, LIM, c1.signal);
    c1.abort();
    await codeOf(a);
    const c2 = new AbortController();
    const b = engine.analyse(START, LIM, c2.signal);
    reply("bestmove e2e4"); // stale for a; now b starts
    c2.abort();
    await codeOf(b);
    const c = engine.analyse(START, LIM);
    const positions = () => sent.filter((l) => l.startsWith("position")).length;
    expect(positions()).toBe(2);
    reply("info depth 9 score cp 50 pv g1f3", "bestmove d2d4"); // stale for b
    expect(positions()).toBe(3);
    reply("bestmove c2c4");
    await expect(c).resolves.toEqual({ lines: [], bestMove: "c2c4" });
  });
});

describe("search timeout", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("no bestmove within movetime + 5000 ms rejects timeout", async () => {
    const { engine, sent } = readyEngine();
    const p = engine.analyse(START, LIM);
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
    const p = engine.analyse(START, { ...LIM, movetimeMs: 200 });
    const state = settledState(p);
    await vi.advanceTimersByTimeAsync(5199);
    expect(state.settled).toBe(false);
    const code = codeOf(p);
    await vi.advanceTimersByTimeAsync(1);
    expect(await code).toBe("timeout");
  });

  it("an answer in time clears the timer", async () => {
    const { engine, reply } = readyEngine();
    const p = engine.analyse(START, LIM);
    await vi.advanceTimersByTimeAsync(5999);
    reply("bestmove e2e4");
    await expect(best(p)).resolves.toBe("e2e4");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("a late answer after a timeout is discarded, and the next search waits for it", async () => {
    const { engine, sent, reply } = readyEngine();
    const p = engine.analyse(START, LIM);
    const code = codeOf(p);
    await vi.advanceTimersByTimeAsync(6000);
    expect(await code).toBe("timeout");
    const q = engine.analyse(START, LIM);
    expect(sent.filter((l) => l.startsWith("position"))).toHaveLength(1);
    reply("info depth 20 score cp 5 pv h2h4", "bestmove e2e4"); // late answer to p
    reply("bestmove d2d4");
    await expect(q).resolves.toEqual({ lines: [], bestMove: "d2d4" });
  });

  it("an engine that never finishes the handshake times out instead of hanging", async () => {
    const t = fakeTransport();
    const engine = createUciEngine(t.transport);
    const code = codeOf(engine.analyse(START, LIM));
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
    const p = engine.analyse(START, LIM);
    expect(set).toHaveBeenCalledWith(expect.any(Function), 6000);
    t.reply("bestmove e2e4");
    await p;
    expect(clear).toHaveBeenCalled();
  });
});

describe("failure and dispose", () => {
  it("a transport error rejects the pending call and every later call with failed", async () => {
    const { engine, fail, sent } = readyEngine();
    const p = engine.analyse(START, LIM);
    const queued = engine.analyse(START, LIM);
    fail();
    expect(await codeOf(p)).toBe("failed");
    expect(await codeOf(queued)).toBe("failed");
    const count = sent.length;
    expect(await codeOf(engine.analyse(START, LIM))).toBe("failed");
    engine.newGame();
    expect(sent.length).toBe(count);
  });

  it("an error during the handshake fails the waiting call", async () => {
    const t = fakeTransport();
    const engine = createUciEngine(t.transport);
    const p = engine.analyse(START, LIM);
    t.fail();
    expect(await codeOf(p)).toBe("failed");
  });

  it("lines after a failure are ignored", async () => {
    const { engine, fail, reply } = readyEngine();
    const p = engine.analyse(START, LIM);
    fail();
    reply("bestmove e2e4");
    expect(await codeOf(p)).toBe("failed");
  });

  it("dispose terminates and rejects pending and later calls with disposed", async () => {
    const { engine, terminated, sent } = readyEngine();
    const p = engine.analyse(START, LIM);
    const queued = engine.analyse(START, LIM);
    engine.dispose();
    expect(terminated()).toBe(1);
    expect(await codeOf(p)).toBe("disposed");
    expect(await codeOf(queued)).toBe("disposed");
    const count = sent.length;
    expect(await codeOf(engine.analyse(START, LIM))).toBe("disposed");
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
    expect(await codeOf(engine.analyse(START, LIM))).toBe("disposed");
  });

  it("dispose clears the search timer", () => {
    vi.useFakeTimers();
    try {
      const { engine } = readyEngine();
      engine.analyse(START, LIM).catch(() => {});
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
