import { describe, expect, it } from "vitest";
import { applyMove } from "../../engine/engine";
import { GameState, initialGameState } from "../../engine/game-state";
import { Score } from "../engine/lines";
import { AHEAD_WIN, chooseHumanMove, winPercent } from "../human-move";
import { uciToMove } from "../position";
import { StepProfile } from "../step-profiles";

/** A small seeded random (mulberry32), so runs repeat exactly. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Wraps `random`, recording every draw. */
function recorded(random: () => number): { random: () => number; draws: number[] } {
  const draws: number[] = [];
  return {
    draws,
    random: () => {
      const r = random();
      draws.push(r);
      return r;
    },
  };
}

const noRandom = () => {
  throw new Error("random() must not be called");
};

/** The cp score whose win % is `win` (the inverse of the Lichess formula). */
function cpFor(win: number): Score {
  const p = (win - 50) / 50;
  return { cp: -Math.log((1 - p) / (1 + p)) / 0.00368208 };
}

function profile(over: Partial<StepProfile> = {}): StepProfile {
  return {
    search: { depth: 8, multiPv: 4, movetimeMs: 500 },
    maxLoss: 10,
    temperature: 4,
    slipChance: 0,
    slipMaxLoss: 10,
    aheadMaxLoss: 10,
    forceMateIn: Infinity,
    ...over,
  };
}

function play(state: GameState, ...ucis: string[]): GameState {
  return ucis.reduce((s, uci) => {
    const move = uciToMove(s, uci);
    if (move === null) throw new Error(`rejected ${uci}`);
    return applyMove(s, move);
  }, state);
}

const START = initialGameState();
/** Quiet first moves from the start; none hangs anything. */
const MOVES = ["e2e4", "d2d4", "g1f3", "c2c4", "b1c3", "g2g3"];

/** Start-position lines with the given win % values, in order. */
function linesAt(...wins: number[]) {
  return wins.map((w, i) => ({ move: MOVES[i], score: cpFor(w) }));
}

/** Loss of `move` against the best of `lines`, in win % points. */
function lossOf(lines: { move: string; score: Score }[], move: string | null): number {
  const best = Math.max(...lines.map((l) => winPercent(l.score)));
  const line = lines.find((l) => l.move === move);
  if (line === undefined) throw new Error(`picked ${move}, not in lines`);
  return best - winPercent(line.score);
}

describe("winPercent", () => {
  it("win percent follows the Lichess formula", () => {
    expect(winPercent({ cp: 0 })).toBe(50);
    expect(winPercent({ cp: 100 })).toBeCloseTo(59.1, 1);
    expect(winPercent({ cp: 300 })).toBeCloseTo(75.1, 1);
    expect(winPercent({ cp: -100 })).toBeCloseTo(40.9, 1);
    expect(winPercent({ mate: 3 })).toBe(100);
    expect(winPercent({ mate: -2 })).toBe(0);
    expect(AHEAD_WIN).toBe(85);
  });
});

describe("chooseHumanMove", () => {
  it("never picks past the loss limit without a slip", () => {
    // Losses 0, 3, 8 (in), 15 (slip band), 40 (out of both).
    const lines = linesAt(60, 57, 52, 45, 20);
    const p = profile({ maxLoss: 10, slipChance: 0.3, slipMaxLoss: 20, temperature: 6 });
    const rec = recorded(seeded(1));
    let normal = 0;
    for (let i = 0; i < 1000; i++) {
      const before = rec.draws.length;
      const move = chooseHumanMove(lines, START, p, rec.random);
      const slipDraw = rec.draws[before];
      expect(slipDraw).toBeDefined();
      if (slipDraw >= 0.3) {
        normal++;
        expect(lossOf(lines, move)).toBeLessThanOrEqual(10);
      }
    }
    expect(normal).toBeGreaterThan(500);
  });

  it("a slip picks only between the limit and the slip limit", () => {
    // Losses 0, 3 (in), 12, 18 (band), 30 (past the slip limit).
    const lines = linesAt(60, 57, 48, 42, 30);
    const p = profile({ maxLoss: 10, slipChance: 0.5, slipMaxLoss: 20, temperature: 6 });
    const pick = seeded(2);
    const seen = new Set<string | null>();
    for (let i = 0; i < 500; i++) {
      // The first draw is the slip decision: 0 always slips.
      let first = true;
      const random = () => {
        if (!first) return pick();
        first = false;
        return 0;
      };
      const move = chooseHumanMove(lines, START, p, random);
      const loss = lossOf(lines, move);
      expect(loss).toBeGreaterThan(10);
      expect(loss).toBeLessThanOrEqual(20);
      seen.add(move);
    }
    expect(seen).toEqual(new Set([MOVES[2], MOVES[3]]));
  });

  it("a slip with no line in its band picks normally", () => {
    // Losses 0, 3 (in), 30 (past the slip limit): nothing to slip to.
    const lines = linesAt(60, 57, 30);
    const p = profile({ maxLoss: 10, slipChance: 0.9, slipMaxLoss: 20 });
    const rec = recorded(seeded(3));
    for (let i = 0; i < 200; i++) {
      const before = rec.draws.length;
      const move = chooseHumanMove(lines, START, p, rec.random);
      expect(rec.draws.length - before).toBe(1);
      expect(lossOf(lines, move)).toBeLessThanOrEqual(10);
    }
  });

  it("picks split by exp(-loss/temperature)", () => {
    const lines = linesAt(50, 48, 45);
    const p = profile({ maxLoss: 10, temperature: 2 });
    const random = seeded(4);
    const counts = new Map<string | null, number>();
    const n = 10_000;
    for (let i = 0; i < n; i++) {
      const move = chooseHumanMove(lines, START, p, random);
      counts.set(move, (counts.get(move) ?? 0) + 1);
    }
    const weights = [0, 2, 5].map((loss) => Math.exp(-loss / 2));
    const total = weights.reduce((a, b) => a + b, 0);
    weights.forEach((w, i) => {
      const share = (counts.get(MOVES[i]) ?? 0) / n;
      expect(Math.abs(share - w / total) * 100).toBeLessThan(2);
    });
  });

  it("temperature 0 always plays the best line", () => {
    // Two loss-0 lines share the picks; the loss-1 line never plays.
    const lines = [
      { move: "e2e4", score: { cp: 20 } },
      { move: "d2d4", score: { cp: 20 } },
      { move: "g1f3", score: cpFor(winPercent({ cp: 20 }) - 1) },
    ];
    const p = profile({ maxLoss: 10, temperature: 0 });
    const random = seeded(5);
    const seen = new Map<string | null, number>();
    for (let i = 0; i < 1000; i++) {
      const move = chooseHumanMove(lines, START, p, random);
      seen.set(move, (seen.get(move) ?? 0) + 1);
    }
    expect(Array.from(seen.keys()).sort()).toEqual(["d2d4", "e2e4"]);
    expect(seen.get("e2e4")).toBeGreaterThan(400);
    expect(seen.get("d2d4")).toBeGreaterThan(400);
  });

  it("never plays into a forced mate while another move avoids it", () => {
    const lines = [
      { move: "e2e4", score: { mate: -1 } },
      { move: "d2d4", score: { cp: -900 } },
      { move: "g1f3", score: { cp: -1200 } },
    ];
    // Slips always, with a band wide enough to reach every line.
    const p = profile({ maxLoss: 0, temperature: 50, slipChance: 1, slipMaxLoss: 100 });
    const random = seeded(6);
    const seen = new Set<string | null>();
    for (let i = 0; i < 500; i++) {
      const move = chooseHumanMove(lines, START, p, random);
      expect(move).not.toBe("e2e4");
      seen.add(move);
    }
    expect(seen.has(null)).toBe(false);
    // And on a normal pick.
    const calm = profile({ maxLoss: 100, temperature: 50 });
    for (let i = 0; i < 500; i++) {
      const move = chooseHumanMove(lines, START, calm, random);
      expect(move).not.toBe("e2e4");
      expect(move).not.toBeNull();
    }
  });

  it("when every line is mated, plays the longest mate", () => {
    const lines = [
      { move: "e2e4", score: { mate: -2 } },
      { move: "d2d4", score: { mate: -5 } },
      { move: "g1f3", score: { mate: -5 } },
      { move: "c2c4", score: { mate: -1 } },
    ];
    expect(chooseHumanMove(lines, START, profile(), noRandom)).toBe("d2d4");
  });

  it("plays the shortest mate within forceMateIn", () => {
    const lines = [
      { move: "e2e4", score: { cp: 300 } },
      { move: "d2d4", score: { mate: 3 } },
      { move: "g1f3", score: { mate: 1 } },
      { move: "c2c4", score: { mate: 1 } },
    ];
    const p = profile({ forceMateIn: Infinity, slipChance: 1, slipMaxLoss: 100 });
    expect(chooseHumanMove(lines, START, p, noRandom)).toBe("g1f3");
    // A mate exactly at the limit is forced too.
    expect(
      chooseHumanMove(lines.slice(0, 2), START, profile({ forceMateIn: 3 }), noRandom)
    ).toBe("d2d4");
  });

  it("a mate longer than forceMateIn is not forced", () => {
    // Both mates are 100 win %, so the weighted pick sees two loss-0 lines;
    // a high draw takes the second.
    const lines = [
      { move: "e2e4", score: { mate: 4 } },
      { move: "d2d4", score: { mate: 6 } },
      { move: "g1f3", score: { cp: 0 } },
    ];
    const rec = recorded(() => 0.99);
    const move = chooseHumanMove(lines, START, profile({ forceMateIn: 2 }), rec.random);
    expect(rec.draws).toHaveLength(1);
    expect(move).toBe("d2d4");
    // forceMateIn 0 never forces, even a mate in 1.
    const once = recorded(() => 0.99);
    const mateIn1 = [
      { move: "e2e4", score: { mate: 1 } },
      { move: "d2d4", score: { mate: 2 } },
    ];
    expect(chooseHumanMove(mateIn1, START, profile({ forceMateIn: 0 }), once.random))
      .toBe("d2d4");
    expect(once.draws).toHaveLength(1);
  });

  it("never hangs material for nothing, even on a slip", () => {
    // After 1.e4 e5 2.Nf3 Nc6, Ng5 leaves the knight to the d8 queen.
    const state = play(START, "e2e4", "e7e5", "g1f3", "b8c6");
    const lines = [
      { move: "f1c4", score: { cp: 30 } },
      { move: "f3g5", score: { cp: 25 } },
      { move: "d2d3", score: { cp: -400 } },
    ];
    const random = seeded(7);
    const loose = profile({ maxLoss: 10, temperature: 100 });
    const slipping = profile({ maxLoss: 0, temperature: 100, slipChance: 1, slipMaxLoss: 50 });
    for (let i = 0; i < 300; i++) {
      expect(chooseHumanMove(lines, state, loose, random)).toBe("f1c4");
      expect(chooseHumanMove(lines, state, slipping, random)).toBe("d2d3");
    }
  });

  it("the best line is never dropped for material", () => {
    const state = play(START, "e2e4", "e7e5", "g1f3", "b8c6");
    const lines = [
      { move: "f1c4", score: { cp: 25 } },
      { move: "f3g5", score: { cp: 30 } },
    ];
    const p = profile({ maxLoss: 0, temperature: 0 });
    expect(chooseHumanMove(lines, state, p, seeded(8))).toBe("f3g5");
  });

  it("when well ahead, picks within aheadMaxLoss and never slips", () => {
    // Losses 0, 2, 8, 15 from a best line at 90 win %.
    const lines = linesAt(90, 88, 82, 75);
    const p = profile({
      maxLoss: 10,
      aheadMaxLoss: 3,
      temperature: 20,
      slipChance: 1,
      slipMaxLoss: 20,
    });
    const rec = recorded(seeded(9));
    const seen = new Set<string | null>();
    for (let i = 0; i < 500; i++) {
      const before = rec.draws.length;
      const move = chooseHumanMove(lines, START, p, rec.random);
      expect(rec.draws.length - before).toBe(1);
      expect(lossOf(lines, move)).toBeLessThanOrEqual(3);
      seen.add(move);
    }
    expect(seen).toEqual(new Set([MOVES[0], MOVES[1]]));
  });

  it("drops illegal lines and returns null when none is legal", () => {
    const lines = [
      { move: "e2e5", score: { mate: 1 } },
      { move: "nonsense", score: { cp: 900 } },
      { move: "e7e5", score: { cp: 800 } },
      { move: "d2d4", score: { cp: 0 } },
    ];
    expect(chooseHumanMove(lines, START, profile({ maxLoss: 0 }), seeded(10))).toBe("d2d4");
    expect(chooseHumanMove(lines.slice(0, 3), START, profile(), seeded(10))).toBeNull();
    expect(chooseHumanMove([], START, profile(), seeded(10))).toBeNull();
  });

  it("a draw outside [0, 1) falls to the last candidate", () => {
    const lines = linesAt(50, 49, 48);
    expect(chooseHumanMove(lines, START, profile(), () => 1)).toBe(MOVES[2]);
  });
});
