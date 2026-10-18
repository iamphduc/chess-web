import { describe, expect, it } from "vitest";
import { TOTAL_MS } from "../../../src/features/board/clock";
import type { GameState } from "../../../src/game/engine/game-state";
import type { EngineLine, Score } from "../../../src/game/opponent/engine/lines";
import type { Analysis } from "../../../src/game/opponent/engine/move-engine";
import { uciToMove } from "../../../src/game/opponent/position";
import type { StrengthStep } from "../../../src/game/opponent/strength";
import { REVIEW_LIMITS } from "../../../src/features/review/reviewLimits";
import { loadAccuracy } from "../accuracy";
import {
  MEASURE_CLOCK,
  measureOneGame,
  playSelfGame,
  runMeasure,
  type MeasureArgs,
  type MeasureDeps,
  type MeasureMove,
  type MeasurePlayer,
} from "../measure";

type Source = "book" | "engine";

/** Plays `moves` in order, each with its source and a top line scored `scores[i]` (default cp 0). */
function scripted(moves: readonly string[], sources?: readonly Source[], scores?: readonly Score[]): MeasurePlayer {
  let next = 0;
  return {
    newGame: () => {
      next = 0;
    },
    move: async () => {
      if (next >= moves.length) throw new Error("ran out of moves");
      const i = next++;
      const source = sources?.[i] ?? "engine";
      const move: MeasureMove = { uci: moves[i], source };
      if (source === "engine") move.lines = [{ move: moves[i], score: scores?.[i] ?? { cp: 0 }, depth: 5 }];
      return move;
    },
  };
}

/** Shuffles a knight out and back forever; its n-th move's source and top score come from the lists. */
function shuffler(sources: readonly Source[] = [], scores: readonly Score[] = []): MeasurePlayer & { moves: number } {
  const player = {
    moves: 0,
    newGame: () => {},
    move: async (state: GameState): Promise<MeasureMove> => {
      const home = state.turn === "white" ? ["g1f3", "f3g1"] : ["g8f6", "f6g8"];
      const uci = home.find((m) => uciToMove(state, m) !== null);
      if (!uci) throw new Error("no knight move");
      const i = player.moves++;
      const source = sources[i] ?? "engine";
      const lines: EngineLine[] | undefined =
        source === "engine" ? [{ move: uci, score: scores[i] ?? { cp: 0 }, depth: 5 }] : undefined;
      return { uci, source, lines };
    },
  };
  return player;
}

/** A grader whose k-th search (position k, in order) scores `whiteView(k)` from White's view. */
function fakeGrader(whiteView: (k: number) => Score = () => ({ cp: 0 }), failAt?: number) {
  const calls: { fen: string; limits: unknown }[] = [];
  return {
    calls,
    disposed: 0,
    async analyse(fen: string, limits: unknown): Promise<Analysis> {
      const k = calls.length;
      calls.push({ fen, limits });
      if (failAt !== undefined && k === failAt) throw new Error("grader crashed");
      const w = whiteView(k);
      const whiteToMove = fen.split(" ")[1] === "w";
      const score: Score = whiteToMove ? w : "cp" in w ? { cp: -w.cp } : { mate: -w.mate };
      return { lines: [{ move: "a1a1", score, depth: 18 }], bestMove: "a1a1" };
    },
    dispose() {
      this.disposed += 1;
    },
  };
}

// Fool's mate: 1.f3 e5 2.g4 Qh4#.
const FOOLS = { white: ["f2f3", "g2g4"], black: ["e7e5", "d8h4"] };
/**
 * White's view per position: f3 drops White from 50 to 25 win % (a mistake),
 * g4 walks into a mate (a blunder by the mate rule).
 */
const foolsEvals = (k: number): Score => [{ cp: 0 }, { cp: -298 }, { cp: -298 }, { mate: -1 }][k] ?? { cp: 0 };

describe("measure mode", () => {
  it("plays with the app's 10+0 clock", () => {
    expect(MEASURE_CLOCK).toEqual({ baseMs: TOTAL_MS, incrementMs: 0 });
  });

  it("grades only engine plies", async () => {
    const grader = fakeGrader(foolsEvals);
    const white = scripted(FOOLS.white, ["book", "engine"]);
    const black = scripted(FOOLS.black, ["book", "engine"]);
    const result = await measureOneGame(white, black, () => grader);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.end).toBe("checkmate");
    expect(result.record.winner).toBe("black");
    expect(result.game.uci).toEqual(["f2f3", "e7e5", "g2g4", "d8h4"]);
    // Book plies never count; engine plies of both sides do.
    expect(result.game.graded).toEqual([false, false, true, true]);
    expect(result.game.sides).toEqual(["white", "black"]);
    // Every live position is searched at the review's limits; the mate isn't searched.
    expect(grader.calls).toHaveLength(4);
    expect(grader.calls.every((c) => c.limits === REVIEW_LIMITS)).toBe(true);
    expect(result.game.evals).toHaveLength(5);
    expect(result.game.evals[4]).toEqual({ mate: 0 });
    expect(result.bookPlies).toBe(2);
    expect(grader.disposed).toBe(1);
  });

  describe("resignation", () => {
    const lost: Score = { cp: -1000 };
    const fine: Score = { cp: -500 };

    it("resigns after the 3rd own top line in a row at -1000 or worse", async () => {
      const white = shuffler([], [lost, lost, lost, lost]);
      const record = await playSelfGame(white, shuffler(), { maxPlies: 50 });
      expect(record.end).toBe("resign");
      expect(record.winner).toBe("black");
      // White's 3rd move is ply 4; it is played, then he resigns.
      expect(record.uci).toHaveLength(5);
    });

    it("a mate against counts like -1000", async () => {
      const black = shuffler([], [{ mate: -4 }, lost, { mate: -1 }]);
      const record = await playSelfGame(shuffler(), black, { maxPlies: 50 });
      expect(record.end).toBe("resign");
      expect(record.winner).toBe("white");
      expect(record.uci).toHaveLength(6);
    });

    it("a better line in between resets the count", async () => {
      const white = shuffler([], [lost, lost, fine, lost, lost, lost]);
      const record = await playSelfGame(white, shuffler(), { maxPlies: 50 });
      expect(record.end).toBe("resign");
      // White's 6th move is ply 10.
      expect(record.uci).toHaveLength(11);
    });

    it("a book move in between resets the count", async () => {
      const white = shuffler(["engine", "engine", "book"], Array(6).fill(lost));
      const record = await playSelfGame(white, shuffler(), { maxPlies: 50 });
      expect(record.end).toBe("resign");
      // Moves 1-2 lost, 3 book, then 4-6 lost: resigns at his 6th move.
      expect(record.uci).toHaveLength(11);
    });

    it("-999 never counts", async () => {
      const white = shuffler([], Array(30).fill({ cp: -999 }));
      const record = await playSelfGame(white, shuffler(), { maxPlies: 20 });
      expect(record.end).toBe("ply-cap");
      expect(record.winner).toBeNull();
    });
  });

  it("ply cap", async () => {
    const grader = fakeGrader();
    const result = await measureOneGame(shuffler(), shuffler(), () => grader);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.end).toBe("ply-cap");
    expect(result.record.winner).toBeNull();
    expect(result.game.uci).toHaveLength(200);
    expect(result.game.graded.filter(Boolean)).toHaveLength(200);
  });

  it("a player error lists the game as an error", async () => {
    const white = scripted(["e2e5"]);
    const result = await measureOneGame(white, shuffler(), () => fakeGrader());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/illegal move e2e5/);
  });
});

/** Fake deps: every game is fool's mate, all engine plies, unless `grader` says otherwise. */
function fakeDeps(over: Partial<MeasureDeps> & { graderFor?: (game: number) => ReturnType<typeof fakeGrader> } = {}) {
  const out: string[] = [];
  let games = 0;
  let clock = 0;
  const deps: MeasureDeps = {
    log: (line) => out.push(line),
    error: (line) => out.push(`ERR ${line}`),
    now: () => (clock += 100),
    makePlayer: (_step: StrengthStep, _random: () => number) => {
      const side = games % 2 === 0 ? FOOLS.white : FOOLS.black;
      games += 1;
      return { ...scripted(side), dispose: () => {} };
    },
    makeGrader: (() => {
      let n = 0;
      return () => (over.graderFor ? over.graderFor(n++) : fakeGrader(foolsEvals));
    })(),
    readBaselines: () => BASELINES,
    loadAccuracy: async () => null,
    ...over,
  };
  return { deps, out };
}

const rates = (mistake: number, blunder: number) => ({
  games: 150,
  sides: 300,
  gradedMoves: 8000,
  per40: {
    review: { inaccuracy: 4, mistake, blunder },
    lichess: { inaccuracy: 5, mistake: 3, blunder: 2 },
    hung: 0.8,
    missedCapture: 0.4,
  },
  avgLoss: 4.5,
  accuracy: 76,
});

const BASELINES = {
  format: 1,
  generated: "2026-10-18",
  source: "test",
  skipPlies: 10,
  levels: {
    "1400": {
      ratingMin: 1300,
      ratingMax: 1500,
      games: 150,
      droppedGames: 0,
      speeds: { blitz: 100, rapid: 50 },
      lowSample: false,
      rates: rates(40 / 3, 20),
    },
  },
};

const args = (steps: StrengthStep[], games = 2): MeasureArgs => ({ mode: "measure", steps, games, seed: 1, jobs: 1 });

/** The lines of one step's block, from its profile line to the next step's. */
function block(out: string[], step: StrengthStep): string[] {
  const start = out.findIndex((l) => l.startsWith(`Step ${step} `));
  expect(start, `no block for step ${step}`).toBeGreaterThanOrEqual(0);
  const end = out.findIndex((l, i) => i > start && l.startsWith("Step "));
  return out.slice(start, end < 0 ? undefined : end);
}

describe("measure report", () => {
  it("table against baseline", async () => {
    const { deps, out } = fakeDeps();
    expect(await runMeasure(args([1400, 1700]), deps)).toBe(0);
    const b1400 = block(out, 1400).join("\n");
    // Two fool's mates: 8 graded moves, 2 mistakes and 2 blunders = 10 per 40 each.
    expect(b1400).toMatch(/mistake 0, blunder 0 up to 0 cp, hang weight 0/);
    expect(b1400).toMatch(/games 2, errors 0, avg book plies 0\.0, graded moves 8/);
    expect(b1400).toMatch(/rate\s+bot\s+human\s+target\s+ok/);
    // Human 13.33 -> target 10.00: within. Human 20 -> target 15: outside.
    expect(b1400).toMatch(/review\.mistake\s+10\.00\s+13\.33\s+10\.00\s+yes/);
    expect(b1400).toMatch(/review\.blunder\s+10\.00\s+20\.00\s+15\.00\s+no/);
    // Other rates show bot, human and target, with no ok.
    expect(b1400).toMatch(/review\.inaccuracy\s+0\.00\s+4\.00\s+3\.00\s*$/m);
    expect(b1400).toMatch(/^\s*hung\s+/m);
    expect(b1400).toMatch(/^\s*missed capture\s+/m);
    expect(b1400).toMatch(/^\s*avg loss\s+/m);
    // The biggest drops: FEN, move, drop, biggest first.
    expect(b1400).toMatch(/biggest drops/);
    expect(b1400).toMatch(/rnbqkbnr\/pppppppp\/8\/8\/8\/8\/PPPPPPPP\/RNBQKBNR w KQkq - 0 1\s+f2f3\s+25\.0/);

    // 1700 has no baseline: dashes, a note naming npm run baseline.
    const b1700 = block(out, 1700).join("\n");
    expect(b1700).toMatch(/review\.mistake\s+10\.00\s+-\s+-\s+-/);
    expect(b1700).toMatch(/no human baseline for 1700.*npm run baseline/);
  });

  it("a missing baseline file prints dashes and exits 0", async () => {
    const { deps, out } = fakeDeps({ readBaselines: () => null });
    expect(await runMeasure(args([1400], 1), deps)).toBe(0);
    const text = out.join("\n");
    expect(text).toMatch(/review\.blunder\s+20\.00\s+-\s+-\s+-/);
    expect(text).toMatch(/human-baselines\.json.*npm run baseline/);
  });

  it("full prints no target", async () => {
    const { deps, out } = fakeDeps();
    expect(await runMeasure(args(["full"], 1), deps)).toBe(0);
    const b = block(out, "full").join("\n");
    expect(b).toMatch(/review\.mistake\s+0\.00\s+-\s+-\s+-/);
  });

  it("grader failure", async () => {
    const { deps, out } = fakeDeps({ graderFor: (g) => fakeGrader(foolsEvals, g === 1 ? 2 : undefined) });
    expect(await runMeasure(args([1400]), deps)).toBe(0);
    const b = block(out, 1400).join("\n");
    // Game 2 is an error; only game 1's 4 graded moves count.
    expect(b).toMatch(/games 1, errors 1, avg book plies 0\.0, graded moves 4/);
    expect(b).toMatch(/error.*grader crashed/);
    expect(b).toMatch(/review\.mistake\s+10\.00/);
  });

  it("accuracy column is optional", async () => {
    // Missing file: the loader returns null without importing anything.
    let imported = 0;
    const loaded = await loadAccuracy({
      exists: () => false,
      load: async () => {
        imported += 1;
        return {};
      },
    });
    expect(loaded).toBeNull();
    expect(imported).toBe(0);

    const { deps, out } = fakeDeps();
    await runMeasure(args([1400], 1), deps);
    expect(out.some((l) => /^\s*accuracy\b/.test(l))).toBe(false);

    // Present: the row shows, with the human's accuracy beside it. Higher
    // accuracy is better, so 75 % of his is no target.
    const withFn = fakeDeps({ loadAccuracy: async () => () => 80 });
    await runMeasure(args([1400], 1), withFn.deps);
    expect(withFn.out.join("\n")).toMatch(/^\s*accuracy\s+80\.00\s+76\.00\s+-\s*$/m);
  });

  it("the loader wraps the module's game accuracy over the game's evals", async () => {
    const seen: unknown[] = [];
    const fn = await loadAccuracy({
      exists: () => true,
      load: async () => ({
        LICHESS_START_WIN: 51,
        lichessWinPercent: (score: Score, side: "white" | "black") =>
          "cp" in score ? (side === "white" ? score.cp : -score.cp) : 0,
        gameAccuracy: (wins: readonly (number | null)[], movers: readonly string[], color: string) => {
          seen.push({ wins, movers, color });
          return 90;
        },
      }),
    });
    expect(fn).not.toBeNull();
    const value = fn!({ uci: ["e2e4", "e7e5"], evals: [{ cp: 30 }, { cp: -40 }, { cp: 20 }], graded: [true, true], sides: ["white", "black"] }, "black");
    expect(value).toBe(90);
    // White's view per position, the start replaced by Lichess's start.
    expect(seen).toEqual([{ wins: [51, 40, 20], movers: ["white", "black"], color: "black" }]);

    // A module without the function gives no column.
    expect(await loadAccuracy({ exists: () => true, load: async () => ({}) })).toBeNull();
  });
});
