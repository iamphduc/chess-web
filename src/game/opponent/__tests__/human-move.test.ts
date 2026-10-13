import { describe, expect, it } from "vitest";
import { applyMove } from "../../engine/engine";
import { EngineSquare, GameState, initialGameState } from "../../engine/game-state";
import { PieceType } from "../../piece-type";
import { Score } from "../engine/lines";
import { AHEAD_WIN, chooseHumanMove, winPercent } from "../human-move";
import { uciToMove } from "../position";
import { STEP_PROFILES, StepProfile } from "../step-profiles";

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
      { move: "d2d3", score: { cp: -250 } },
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

/** A custom position from `{ e1: piece, ... }`, no castling rights. */
function board(
  pieces: Record<string, PieceType>,
  overrides: Partial<GameState> = {}
): GameState {
  const grid: EngineSquare[][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => null as EngineSquare)
  );
  for (const [sq, piece] of Object.entries(pieces)) {
    grid[8 - Number(sq[1])]["abcdefgh".indexOf(sq[0])] = piece;
  }
  return {
    ...initialGameState(),
    squares: grid,
    castling: {
      white: { kingSide: false, queenSide: false },
      black: { kingSide: false, queenSide: false },
    },
    ...overrides,
  };
}

/** How often each move is picked over `n` seeded runs. */
function tally(
  lines: { move: string; score: Score }[],
  state: GameState,
  p: StepProfile,
  seed: number,
  n = 500
): Map<string | null, number> {
  const random = seeded(seed);
  const counts = new Map<string | null, number>();
  for (let i = 0; i < n; i++) {
    const move = chooseHumanMove(lines, state, p, random);
    counts.set(move, (counts.get(move) ?? 0) + 1);
  }
  return counts;
}

// 1.e3 e5 2.Qf3 Nc6 3.Qf4: exf4 wins the queen for a pawn (9 - 1 = 8).
const QUEEN_EN_PRISE = play(START, "e2e3", "e7e5", "d1f3", "b8c6", "f3f4");

describe("chooseHumanMove: free material", () => {
  it("never skips a free queen when far ahead (the 1400 play check)", () => {
    // Already well ahead, win % is flat: Be7 loses only about 3.3 points,
    // inside the old 1400 ahead limit of 4, and 240 cp, under the cp cap.
    const lines = [
      { move: "e5f4", score: { cp: 1000 } },
      { move: "f8e7", score: { cp: 760 } },
      { move: "g8f6", score: { cp: 750 } },
    ];
    const old1400 = { ...STEP_PROFILES[1400], aheadMaxLoss: 4 };
    expect(tally(lines, QUEEN_EN_PRISE, old1400, 11)).toEqual(new Map([["e5f4", 500]]));
    // And at today's 1400, where Be7 is inside the 2-point limit.
    const flat = [
      { move: "e5f4", score: { cp: 1200 } },
      { move: "f8e7", score: { cp: 1000 } },
    ];
    expect(tally(flat, QUEEN_EN_PRISE, STEP_PROFILES[1400], 12)).toEqual(
      new Map([["e5f4", 500]])
    );
  });

  it("never skips a free capture on a slip", () => {
    // Not ahead: Be7 sits in the slip band (loss about 17.6).
    const lines = [
      { move: "e5f4", score: { cp: 200 } },
      { move: "f8e7", score: { cp: 0 } },
    ];
    const p = profile({ maxLoss: 10, slipChance: 1, slipMaxLoss: 20, temperature: 6 });
    expect(tally(lines, QUEEN_EN_PRISE, p, 13)).toEqual(new Map([["e5f4", 500]]));
  });

  it("takes the capture over a line the engine rates the same", () => {
    const lines = [
      { move: "f8e7", score: { cp: 900 } },
      { move: "e5f4", score: { cp: 900 } },
    ];
    expect(tally(lines, QUEEN_EN_PRISE, profile({ temperature: 10 }), 14)).toEqual(
      new Map([["e5f4", 500]])
    );
  });

  it("may skip it for a line the engine rates better", () => {
    const lines = [
      { move: "f8e7", score: { cp: 330 } },
      { move: "e5f4", score: { cp: 300 } },
    ];
    const counts = tally(lines, QUEEN_EN_PRISE, profile({ temperature: 10 }), 15);
    expect(counts.get("f8e7")).toBeGreaterThan(100);
    expect(counts.get("e5f4")).toBeGreaterThan(100);
  });

  it("a free piece (exactly 3) counts", () => {
    // 1.e4 e5 2.Nf3 Nc6 3.Ng5: Qxg5 wins a knight, and nothing takes back.
    const state = play(START, "e2e4", "e7e5", "g1f3", "b8c6", "f3g5");
    const lines = [
      { move: "d8g5", score: { cp: 330 } },
      { move: "g8f6", score: { cp: 300 } },
    ];
    expect(tally(lines, state, profile({ temperature: 10 }), 16)).toEqual(
      new Map([["d8g5", 500]])
    );
  });

  it("a capture that nets under 3 doesn't force", () => {
    // 1.e4 e5 2.Nf3 Nc6 3.d4: exd4 wins a pawn; Nxd4 can take back.
    const state = play(START, "e2e4", "e7e5", "g1f3", "b8c6", "d2d4");
    const lines = [
      { move: "e5d4", score: { cp: 40 } },
      { move: "g8f6", score: { cp: 20 } },
    ];
    const counts = tally(lines, state, profile({ temperature: 10 }), 17);
    expect(counts.get("g8f6")).toBeGreaterThan(100);
  });

  it("a smaller free capture doesn't stand in for a bigger one", () => {
    // Black to move: exf4 wins the queen (9); Rxa5 wins a knight (3).
    const P = PieceType;
    const state = board(
      { e1: P.WhiteKing, f4: P.WhiteQueen, a5: P.WhiteKingKnight,
        h8: P.BlackKing, e5: P.BlackPawnE, a8: P.BlackQueenRook },
      { turn: "black" }
    );
    const lines = [
      { move: "e5f4", score: { cp: 400 } },
      { move: "a8a5", score: { cp: 380 } },
      { move: "h8g8", score: { cp: 370 } },
    ];
    expect(tally(lines, state, profile({ temperature: 10 }), 18)).toEqual(
      new Map([["e5f4", 500]])
    );
  });

  it("a free capture far below a tied best line still returns a move", () => {
    // Both are exactly 100 win % (from about +10000 cp), so the capture ties
    // Be7 and Be7 is dropped, yet the capture is 400 cp below it.
    const lines = [
      { move: "f8e7", score: { cp: 10500 } },
      { move: "e5f4", score: { cp: 10100 } },
    ];
    expect(lines.map((l) => winPercent(l.score))).toEqual([100, 100]);
    for (const p of [profile(), STEP_PROFILES[1400], STEP_PROFILES.full]) {
      expect(chooseHumanMove(lines, QUEEN_EN_PRISE, p, seeded(24))).toBe("e5f4");
    }
  });

  it("a seen mate still comes first", () => {
    const lines = [
      { move: "e5f4", score: { cp: 1000 } },
      { move: "f8e7", score: { mate: 2 } },
    ];
    const p = profile({ forceMateIn: 2 });
    expect(chooseHumanMove(lines, QUEEN_EN_PRISE, p, noRandom)).toBe("f8e7");
  });
});

describe("chooseHumanMove: drops of a piece in centipawns", () => {
  it("far behind, never drops a piece more on a normal pick", () => {
    // At -800, a -1100 line loses only about 3.3 win % points.
    const lines = [
      { move: "e2e4", score: { cp: -800 } },
      { move: "d2d4", score: { cp: -1100 } },
      { move: "g1f3", score: { cp: -2000 } },
      { move: "c2c4", score: { cp: -1099 } },
    ];
    const counts = tally(lines, START, STEP_PROFILES[1400], 19, 1000);
    expect(counts.has("d2d4")).toBe(false);
    expect(counts.has("g1f3")).toBe(false);
    // A drop just under a piece still counts by win %.
    expect(counts.get("c2c4")).toBeGreaterThan(100);
    expect(counts.get("e2e4")).toBeGreaterThan(100);
  });

  it("far behind, a slip never drops a piece either", () => {
    // From -400: -650 is in the slip band and 250 cp down; -700 is 300 down.
    const lines = [
      { move: "e2e4", score: { cp: -400 } },
      { move: "d2d4", score: { cp: -650 } },
      { move: "g1f3", score: { cp: -700 } },
    ];
    const p = profile({ maxLoss: 10, slipChance: 1, slipMaxLoss: 15, temperature: 5 });
    expect(tally(lines, START, p, 20)).toEqual(new Map([["d2d4", 500]]));
  });

  it("far ahead, never drops a piece within the ahead limit", () => {
    // At +1500, +1200 loses only about 0.8 win % points.
    const lines = [
      { move: "e2e4", score: { cp: 1500 } },
      { move: "d2d4", score: { cp: 1200 } },
      { move: "g1f3", score: { cp: 1250 } },
    ];
    const counts = tally(lines, START, STEP_PROFILES[1400], 21, 1000);
    expect(counts.has("d2d4")).toBe(false);
    expect(counts.get("g1f3")).toBeGreaterThan(100);
  });

  it("the cap is skipped when the best line is a mate", () => {
    // Mate in 5 is past 1400's forceMateIn; +1200 is 1.2 points down.
    const lines = [
      { move: "e2e4", score: { mate: 5 } },
      { move: "d2d4", score: { cp: 1200 } },
    ];
    const counts = tally(lines, START, STEP_PROFILES[1400], 22, 1000);
    expect(counts.get("d2d4")).toBeGreaterThan(100);
  });

  it("level positions are unchanged: a 1400 slip still reaches the band", () => {
    // From 0: -100 (9.1 points) is within; -150 (13.4 points) is a slip.
    const lines = [
      { move: "e2e4", score: { cp: 0 } },
      { move: "d2d4", score: { cp: -100 } },
      { move: "g1f3", score: { cp: -150 } },
    ];
    const p = { ...STEP_PROFILES[1400], slipChance: 1 };
    expect(tally(lines, START, p, 23)).toEqual(new Map([["g1f3", 500]]));
  });
});
