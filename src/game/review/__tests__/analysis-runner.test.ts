import { describe, expect, it } from "vitest";
import { applyMove } from "../../engine/engine";
import { type EngineSquare, type GameState, initialGameState } from "../../engine/game-state";
import { PieceType } from "../../piece-type";
import type { SearchLimits } from "../../opponent/engine/lines";
import { EngineError, type Analysis } from "../../opponent/engine/move-engine";
import { toFen, uciToMove } from "../../opponent/position";
import { createAnalysisRunner, type PositionEval, type ReviewEngine } from "../analysis-runner";

// ---- fixtures ---------------------------------------------------------------

const LIMITS: SearchLimits = { depth: 18, multiPv: 1, movetimeMs: 500 };

function play(state: GameState, ...ucis: string[]): GameState[] {
  const out: GameState[] = [state];
  for (const uci of ucis) {
    const s = out[out.length - 1];
    const move = uciToMove(s, uci);
    if (move === null) throw new Error(`rejected ${uci}`);
    out.push(applyMove(s, move));
  }
  return out;
}

const start = initialGameState();
/** Fool's mate: the last position is checkmate (White to move, mated). */
const FOOLS = play(start, "f2f3", "e7e5", "g2g4", "d8h4");
const GAME = play(start, "e2e4", "e7e5", "g1f3");

function board(pieces: Record<string, PieceType>, turn: "white" | "black"): GameState {
  const grid: EngineSquare[][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => null as EngineSquare)
  );
  for (const [sq, piece] of Object.entries(pieces)) {
    grid[8 - Number(sq[1])]["abcdefgh".indexOf(sq[0])] = piece;
  }
  return {
    ...start,
    squares: grid,
    turn,
    castling: { white: { kingSide: false, queenSide: false }, black: { kingSide: false, queenSide: false } },
  };
}

/** Black to move, no legal move, not in check. */
const STALEMATE = board(
  { a8: PieceType.BlackKing, b6: PieceType.WhiteQueen, c1: PieceType.WhiteKing },
  "black"
);

interface Deferred {
  resolve(a: Analysis): void;
  reject(e: unknown): void;
}

/** A ReviewEngine whose searches wait until the test settles them. Aborts reject `aborted`. */
function fakeEngine(opts: { ignoreAbort?: boolean } = {}) {
  const calls: { fen: string; limits: SearchLimits; signal?: AbortSignal; d: Deferred }[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const engine: ReviewEngine = {
    analyse(fen, limits, signal) {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      return new Promise<Analysis>((resolve, reject) => {
        const done = () => (inFlight -= 1);
        const d: Deferred = {
          resolve: (a) => {
            done();
            resolve(a);
          },
          reject: (e) => {
            done();
            reject(e);
          },
        };
        calls.push({ fen, limits, signal, d });
        if (!opts.ignoreAbort) signal?.addEventListener("abort", () => d.reject(new EngineError("aborted")));
      });
    },
  };
  return { engine, calls, maxInFlight: () => maxInFlight, last: () => calls[calls.length - 1] };
}

const line = (move: string, cp: number): Analysis => ({
  lines: [{ move, score: { cp }, depth: 18 }],
  bestMove: move,
});

async function flush(): Promise<void> {
  for (let i = 0; i < 50; i++) await Promise.resolve();
}

function collect() {
  const got: [number, PositionEval][] = [];
  return { got, onEval: (i: number, e: PositionEval) => got.push([i, e]) };
}

/** The settled state of a promise, without waiting for it. */
function track<T>(p: Promise<T>) {
  const t: { value?: T; error?: unknown; settled: boolean } = { settled: false };
  p.then(
    (v) => Object.assign(t, { value: v, settled: true }),
    (e) => Object.assign(t, { error: e, settled: true })
  );
  return t;
}

// ---- tests ------------------------------------------------------------------

describe("runs positions in order", () => {
  it("searches each position from the start index, one at a time, with the given limits", async () => {
    const fake = fakeEngine();
    const runner = createAnalysisRunner({ engine: fake.engine, limits: LIMITS });
    const { got, onEval } = collect();
    const pass = track(runner.start(GAME, 1, onEval));

    await flush();
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0].fen).toBe(toFen(GAME[1]));
    expect(fake.calls[0].limits).toEqual(LIMITS);
    fake.calls[0].d.resolve(line("g1f3", 30));
    await flush();
    expect(got).toEqual([[1, { score: { cp: 30 }, best: "g1f3" }]]);
    expect(fake.calls).toHaveLength(2);
    expect(fake.calls[1].fen).toBe(toFen(GAME[2]));
    fake.calls[1].d.resolve(line("b8c6", -25));
    await flush();
    fake.calls[2].d.resolve({ lines: [{ move: "d2d4", score: { mate: 3 }, depth: 18 }], bestMove: "d2d4" });
    await flush();

    expect(pass.value).toBe("done");
    expect(fake.calls.map((c) => c.fen)).toEqual([toFen(GAME[1]), toFen(GAME[2]), toFen(GAME[3])]);
    expect(fake.maxInFlight()).toBe(1);
    expect(got.map(([i]) => i)).toEqual([1, 2, 3]);
    expect(got[2][1]).toEqual({ score: { mate: 3 }, best: "d2d4" });
  });

  it("a start index at or past the end resolves done with no search", async () => {
    const fake = fakeEngine();
    const runner = createAnalysisRunner({ engine: fake.engine, limits: LIMITS });
    const { got, onEval } = collect();
    expect(await runner.start(GAME, GAME.length, onEval)).toBe("done");
    expect(await runner.start([], 0, onEval)).toBe("done");
    expect(fake.calls).toHaveLength(0);
    expect(got).toHaveLength(0);
  });

  it("a negative or fractional start index rejects with a RangeError", async () => {
    const runner = createAnalysisRunner({ engine: fakeEngine().engine, limits: LIMITS });
    await expect(runner.start(GAME, -1, () => {})).rejects.toBeInstanceOf(RangeError);
    await expect(runner.start(GAME, 1.5, () => {})).rejects.toBeInstanceOf(RangeError);
  });
});

describe("terminal positions are not searched", () => {
  it("checkmate is mate 0 and stalemate cp 0, both with no best move", async () => {
    const fake = fakeEngine();
    const runner = createAnalysisRunner({ engine: fake.engine, limits: LIMITS });
    const { got, onEval } = collect();
    expect(await runner.start([FOOLS[4], STALEMATE], 0, onEval)).toBe("done");
    expect(fake.calls).toHaveLength(0);
    expect(got).toEqual([
      [0, { score: { mate: 0 }, best: null }],
      [1, { score: { cp: 0 }, best: null }],
    ]);
  });

  it("a game ending in mate searches every position but the last", async () => {
    const fake = fakeEngine();
    const runner = createAnalysisRunner({ engine: fake.engine, limits: LIMITS });
    const { got, onEval } = collect();
    const pass = track(runner.start(FOOLS, 3, onEval));
    await flush();
    fake.calls[0].d.resolve(line("d8h4", -900));
    await flush();
    expect(pass.value).toBe("done");
    expect(fake.calls).toHaveLength(1);
    expect(got[1]).toEqual([4, { score: { mate: 0 }, best: null }]);
  });

  it("a check of a terminal position answers at once with no search", async () => {
    const fake = fakeEngine();
    const runner = createAnalysisRunner({ engine: fake.engine, limits: LIMITS });
    expect(await runner.check(STALEMATE)).toEqual({ score: { cp: 0 }, best: null });
    expect(await runner.check(FOOLS[4])).toEqual({ score: { mate: 0 }, best: null });
    expect(fake.calls).toHaveLength(0);
  });
});

describe("a check jumps the queue", () => {
  it("runs right after the search in flight, before the pass's next one, and returns its eval", async () => {
    const fake = fakeEngine();
    const runner = createAnalysisRunner({ engine: fake.engine, limits: LIMITS });
    const { got, onEval } = collect();
    const pass = track(runner.start(GAME, 0, onEval));
    await flush();

    const tried = play(GAME[1], "d7d5")[1];
    const checked = track(runner.check(tried));
    await flush();
    expect(fake.calls).toHaveLength(1); // still one at a time

    fake.calls[0].d.resolve(line("e2e4", 20));
    await flush();
    expect(fake.calls).toHaveLength(2);
    expect(fake.calls[1].fen).toBe(toFen(tried));
    expect(fake.calls[1].limits).toEqual(LIMITS);
    fake.calls[1].d.resolve(line("e4d5", 120));
    await flush();
    expect(checked.value).toEqual({ score: { cp: 120 }, best: "e4d5" });
    // The check's eval is not sent as a position of the game.
    expect(got).toEqual([[0, { score: { cp: 20 }, best: "e2e4" }]]);

    expect(fake.calls[2].fen).toBe(toFen(GAME[1]));
    for (let i = 2; i < 5; i++) {
      fake.calls[i].d.resolve(line("a2a3", 0));
      await flush();
    }
    expect(pass.value).toBe("done");
    expect(fake.maxInFlight()).toBe(1);
  });

  it("two checks run in the order asked, both before the pass goes on", async () => {
    const fake = fakeEngine();
    const runner = createAnalysisRunner({ engine: fake.engine, limits: LIMITS });
    void runner.start(GAME, 0, () => {});
    await flush();
    const a = play(GAME[1], "d7d5")[1];
    const b = play(GAME[1], "c7c5")[1];
    void runner.check(a);
    void runner.check(b);
    fake.calls[0].d.resolve(line("e2e4", 20));
    await flush();
    fake.last().d.resolve(line("e4d5", 120));
    await flush();
    expect(fake.calls.map((c) => c.fen)).toEqual([toFen(GAME[0]), toFen(a), toFen(b)]);
  });

  it("with no pass running, a check searches at once", async () => {
    const fake = fakeEngine();
    const runner = createAnalysisRunner({ engine: fake.engine, limits: LIMITS });
    const checked = track(runner.check(GAME[1]));
    await flush();
    expect(fake.calls).toHaveLength(1);
    fake.calls[0].d.resolve(line("e7e5", -20));
    await flush();
    expect(checked.value).toEqual({ score: { cp: -20 }, best: "e7e5" });
  });

  it("a failed check rejects with the engine's error and the pass goes on", async () => {
    const fake = fakeEngine();
    const runner = createAnalysisRunner({ engine: fake.engine, limits: LIMITS });
    const pass = track(runner.start(GAME.slice(0, 2), 0, () => {}));
    await flush();
    const checked = track(runner.check(GAME[2]));
    fake.calls[0].d.resolve(line("e2e4", 20));
    await flush();
    const boom = new Error("boom");
    fake.calls[1].d.reject(boom);
    await flush();
    expect(checked.error).toBe(boom);
    fake.calls[2].d.resolve(line("e7e5", -20));
    await flush();
    expect(pass.value).toBe("done");
  });

  it("a check with no lines rejects failed", async () => {
    const fake = fakeEngine();
    const runner = createAnalysisRunner({ engine: fake.engine, limits: LIMITS });
    const checked = track(runner.check(GAME[1]));
    await flush();
    fake.calls[0].d.resolve({ lines: [], bestMove: "e7e5" });
    await flush();
    expect(checked.error).toBeInstanceOf(EngineError);
    expect((checked.error as EngineError).code).toBe("failed");
  });
});

describe("stop", () => {
  it("aborts the search in flight, resolves stopped, rejects a pending check aborted, and sends nothing more", async () => {
    const fake = fakeEngine();
    const runner = createAnalysisRunner({ engine: fake.engine, limits: LIMITS });
    const { got, onEval } = collect();
    const pass = track(runner.start(GAME, 0, onEval));
    await flush();
    const checked = track(runner.check(GAME[2]));
    await flush();

    runner.stop();
    expect(fake.calls[0].signal?.aborted).toBe(true);
    await flush();
    expect(pass.value).toBe("stopped");
    expect(checked.error).toBeInstanceOf(EngineError);
    expect((checked.error as EngineError).code).toBe("aborted");
    expect(fake.calls).toHaveLength(1);
    expect(got).toHaveLength(0);
  });

  it("a search that answers after stop anyway sends nothing", async () => {
    const fake = fakeEngine({ ignoreAbort: true });
    const runner = createAnalysisRunner({ engine: fake.engine, limits: LIMITS });
    const { got, onEval } = collect();
    const pass = track(runner.start(GAME, 0, onEval));
    await flush();
    runner.stop();
    fake.calls[0].d.resolve(line("e2e4", 20));
    await flush();
    expect(pass.value).toBe("stopped");
    expect(got).toHaveLength(0);
    expect(fake.calls).toHaveLength(1);
  });

  it("a check in flight rejects aborted, even when its engine fails some other way", async () => {
    const fake = fakeEngine({ ignoreAbort: true });
    const runner = createAnalysisRunner({ engine: fake.engine, limits: LIMITS });
    const checked = track(runner.check(GAME[1]));
    await flush();
    runner.stop();
    fake.calls[0].d.reject(new Error("superseded"));
    await flush();
    expect((checked.error as EngineError).code).toBe("aborted");
  });

  it("an engine error after stop still resolves stopped", async () => {
    const fake = fakeEngine({ ignoreAbort: true });
    const runner = createAnalysisRunner({ engine: fake.engine, limits: LIMITS });
    const pass = track(runner.start(GAME, 0, () => {}));
    await flush();
    runner.stop();
    fake.calls[0].d.reject(new EngineError("failed"));
    await flush();
    expect(pass.value).toBe("stopped");
  });

  it("stop with nothing running does nothing, and the runner works after a stop", async () => {
    const fake = fakeEngine();
    const runner = createAnalysisRunner({ engine: fake.engine, limits: LIMITS });
    runner.stop();
    void runner.start(GAME, 0, () => {});
    await flush();
    runner.stop();
    await flush();

    const { got, onEval } = collect();
    const pass = track(runner.start(GAME.slice(0, 1), 0, onEval));
    await flush();
    expect(fake.calls).toHaveLength(2);
    fake.calls[1].d.resolve(line("e2e4", 20));
    await flush();
    expect(pass.value).toBe("done");
    expect(got).toEqual([[0, { score: { cp: 20 }, best: "e2e4" }]]);
  });

  it("a second start stops the first pass and keeps pending checks", async () => {
    const fake = fakeEngine();
    const runner = createAnalysisRunner({ engine: fake.engine, limits: LIMITS });
    const first = track(runner.start(GAME, 0, () => {}));
    await flush();
    const checked = track(runner.check(GAME[3]));
    const { got, onEval } = collect();
    const second = track(runner.start(GAME, 2, onEval));
    await flush();
    expect(first.value).toBe("stopped");
    // The check runs first, then the new pass from index 2.
    expect(fake.calls[1].fen).toBe(toFen(GAME[3]));
    fake.calls[1].d.resolve(line("b8c6", -30));
    await flush();
    expect(checked.value).toEqual({ score: { cp: -30 }, best: "b8c6" });
    expect(fake.calls[2].fen).toBe(toFen(GAME[2]));
    fake.calls[2].d.resolve(line("g1f3", 25));
    await flush();
    fake.calls[3].d.resolve(line("b8c6", -30));
    await flush();
    expect(second.value).toBe("done");
    expect(got.map(([i]) => i)).toEqual([2, 3]);
    expect(fake.maxInFlight()).toBe(1);
  });
});

describe("engine failure", () => {
  it("an engine error rejects start with it; evals already sent stay and no more searches run", async () => {
    const fake = fakeEngine();
    const runner = createAnalysisRunner({ engine: fake.engine, limits: LIMITS });
    const { got, onEval } = collect();
    const pass = track(runner.start(GAME, 0, onEval));
    await flush();
    fake.calls[0].d.resolve(line("e2e4", 20));
    await flush();
    const error = new EngineError("timeout");
    fake.calls[1].d.reject(error);
    await flush();
    expect(pass.error).toBe(error);
    expect(got).toEqual([[0, { score: { cp: 20 }, best: "e2e4" }]]);
    expect(fake.calls).toHaveLength(2);
  });

  it("a non-terminal position with no lines rejects start failed", async () => {
    const fake = fakeEngine();
    const runner = createAnalysisRunner({ engine: fake.engine, limits: LIMITS });
    const { got, onEval } = collect();
    const pass = track(runner.start(GAME, 0, onEval));
    await flush();
    fake.calls[0].d.resolve({ lines: [], bestMove: null });
    await flush();
    expect(pass.error).toBeInstanceOf(EngineError);
    expect((pass.error as EngineError).code).toBe("failed");
    expect(got).toHaveLength(0);
  });

  it("a check waiting behind a failed pass still runs", async () => {
    const fake = fakeEngine();
    const runner = createAnalysisRunner({ engine: fake.engine, limits: LIMITS });
    const pass = track(runner.start(GAME, 0, () => {}));
    await flush();
    const checked = track(runner.check(GAME[1]));
    fake.calls[0].d.reject(new EngineError("failed"));
    await flush();
    expect(pass.error).toBeInstanceOf(EngineError);
    expect(fake.calls).toHaveLength(2);
    fake.calls[1].d.resolve(line("e7e5", -20));
    await flush();
    expect(checked.value).toEqual({ score: { cp: -20 }, best: "e7e5" });
  });
});
