import { describe, expect, it } from "vitest";
import { gradeMove, LICHESS_LEVELS } from "../../../src/game/review/grade";
import {
  cpLoss,
  GradedGame,
  measureGames,
  Score,
  targetFor,
  TARGET_SHARE,
  TOLERANCE,
  withinTarget,
} from "../rates";

const cp = (n: number): Score => ({ cp: n });
const mate = (n: number): Score => ({ mate: n });
const ev = (score: Score) => ({ score, best: null });

/** Four plies, all graded, both sides: drops 0, ~47, ~12.5 and ~7. */
function fourPlyGame(over: Partial<GradedGame> = {}): GradedGame {
  return {
    uci: ["e2e4", "e7e5", "g1f3", "b8c6"],
    evals: [cp(0), cp(0), cp(1000), cp(-470), cp(660)],
    graded: [true, true, true, true],
    sides: ["white", "black"],
    ...over,
  };
}

describe("per-40 rates", () => {
  it("the fixture's plies grade as the test expects", () => {
    const g = fourPlyGame();
    const grades = g.uci.map((_, i) => gradeMove(ev(g.evals[i]), ev(g.evals[i + 1])));
    const lichess = g.uci.map((_, i) =>
      gradeMove(ev(g.evals[i]), ev(g.evals[i + 1]), LICHESS_LEVELS)
    );
    expect(grades.map((x) => x.grade)).toEqual([null, "blunder", "inaccuracy", null]);
    expect(lichess.map((x) => x.grade)).toEqual([null, "blunder", "mistake", "inaccuracy"]);
  });

  it("counts each grade at both level sets per 40 graded moves, and the mean loss", () => {
    const g = fourPlyGame();
    const r = measureGames([g]);
    expect(r.games).toBe(1);
    expect(r.sides).toBe(2);
    expect(r.gradedMoves).toBe(4);
    expect(r.per40.review).toEqual({ inaccuracy: 10, mistake: 0, blunder: 10 });
    expect(r.per40.lichess).toEqual({ inaccuracy: 10, mistake: 10, blunder: 10 });
    const drops = g.uci.map((_, i) => gradeMove(ev(g.evals[i]), ev(g.evals[i + 1])).drop);
    expect(r.avgLoss).toBeCloseTo(drops.reduce((a, b) => a + b, 0) / 4, 9);
    expect(r.per40.hung).toBe(0);
    expect(r.per40.missedCapture).toBe(0);
  });

  it("only graded plies of the measured sides count", () => {
    const g = fourPlyGame({ graded: [false, true, true, true], sides: ["white"] });
    const r = measureGames([g]);
    expect(r.sides).toBe(1);
    expect(r.gradedMoves).toBe(1);
    expect(r.per40.review).toEqual({ inaccuracy: 40, mistake: 0, blunder: 0 });
    expect(r.per40.lichess).toEqual({ inaccuracy: 0, mistake: 40, blunder: 0 });
  });

  it("adds games together before dividing", () => {
    const a = fourPlyGame();
    const b = fourPlyGame({ graded: [true, false, false, false] });
    const r = measureGames([a, b]);
    expect(r.games).toBe(2);
    expect(r.sides).toBe(4);
    expect(r.gradedMoves).toBe(5);
    expect(r.per40.review.blunder).toBeCloseTo(8, 9);
  });

  it("rejects a game whose moves are not legal or whose evals don't fit", () => {
    expect(() =>
      measureGames([fourPlyGame({ uci: ["e2e5", "e7e5", "g1f3", "b8c6"] })])
    ).toThrow();
    expect(() => measureGames([fourPlyGame({ evals: [cp(0)] })])).toThrow();
  });
});

/** 1.e4 d5 2.Qg4: the queen hangs to Bc8 (materialNet -9). */
function queenHang(after: Score, before: Score = cp(0)): GradedGame {
  return {
    uci: ["e2e4", "d7d5", "d1g4"],
    evals: [cp(0), cp(0), before, after],
    graded: [false, false, true],
    sides: ["white", "black"],
  };
}

describe("hung pieces", () => {
  it("needs a net of -2 or less and a cp loss of 150 (149 is not)", () => {
    expect(measureGames([queenHang(cp(150))]).per40.hung).toBe(40);
    expect(measureGames([queenHang(cp(149))]).per40.hung).toBe(0);
  });

  it("a move that hangs nothing never counts, however much it loses", () => {
    const g: GradedGame = {
      uci: ["e2e4"],
      evals: [cp(0), cp(900)],
      graded: [true],
      sides: ["white"],
    };
    expect(measureGames([g]).per40.hung).toBe(0);
  });

  it("a mate counts as 1000 and cp clamps to ±1000, from the mover's view", () => {
    // Black now mates: the loss is 0 - (-1000).
    expect(measureGames([queenHang(mate(3))]).per40.hung).toBe(40);
    // 1300 and 1140 both clamp to 1000: no loss, though the raw drop is 160.
    expect(measureGames([queenHang(cp(-1140), cp(1300))]).per40.hung).toBe(0);
    expect(cpLoss(cp(1300), cp(-1140))).toBe(0);
    expect(cpLoss(cp(200), mate(1))).toBe(1200);
    expect(cpLoss(mate(2), mate(-1))).toBe(0);
    expect(cpLoss(cp(0), mate(0))).toBe(0);
    expect(cpLoss(mate(-2), cp(-50))).toBe(0);
    expect(cpLoss(cp(-2000), cp(-50))).toBe(0);
  });
});

/** 1.e4 e6 2.d4 d6 3.d5 Nc6: dxc6 nets 2, dxe6 and a3 net 0. */
function skipsKnight(move: string, after: Score): GradedGame {
  return {
    uci: ["e2e4", "e7e6", "d2d4", "d7d6", "d4d5", "b8c6", move],
    evals: [cp(0), cp(0), cp(0), cp(0), cp(0), cp(0), cp(0), after],
    graded: [false, false, false, false, false, false, true],
    sides: ["white", "black"],
  };
}

describe("missed captures", () => {
  it("best net 2, played net 0, cp loss 100 counts; 99 doesn't", () => {
    expect(measureGames([skipsKnight("a2a3", cp(100))]).per40.missedCapture).toBe(40);
    expect(measureGames([skipsKnight("a2a3", cp(99))]).per40.missedCapture).toBe(0);
    expect(measureGames([skipsKnight("d5e6", cp(100))]).per40.missedCapture).toBe(40);
  });

  it("taking the best capture is never missed", () => {
    expect(measureGames([skipsKnight("d5c6", cp(500))]).per40.missedCapture).toBe(0);
  });

  it("no capture on the board, nothing to miss", () => {
    const g: GradedGame = {
      uci: ["e2e4"],
      evals: [cp(0), cp(900)],
      graded: [true],
      sides: ["white"],
    };
    expect(measureGames([g]).per40.missedCapture).toBe(0);
  });
});

describe("empty and missing inputs", () => {
  const nullRates = {
    review: { inaccuracy: null, mistake: null, blunder: null },
    lichess: { inaccuracy: null, mistake: null, blunder: null },
    hung: null,
    missedCapture: null,
  };

  it("no games gives zero counts and null rates", () => {
    const r = measureGames([]);
    expect(r).toEqual({
      games: 0,
      sides: 0,
      gradedMoves: 0,
      per40: nullRates,
      avgLoss: null,
      accuracy: null,
    });
  });

  it("games with no graded move give null rates, not an error", () => {
    const r = measureGames([fourPlyGame({ graded: [false, false, false, false] })], {
      accuracy: () => 80,
    });
    expect(r.games).toBe(1);
    expect(r.gradedMoves).toBe(0);
    expect(r.per40).toEqual(nullRates);
    expect(r.avgLoss).toBeNull();
    expect(r.accuracy).toBeNull();
  });

  it("no accuracy function gives accuracy null", () => {
    expect(measureGames([fourPlyGame()]).accuracy).toBeNull();
  });

  it("accuracy is the mean per side, skipping nulls; all null is null", () => {
    const a = fourPlyGame();
    const b = fourPlyGame();
    const table = new Map<GradedGame, Record<string, number | null>>([
      [a, { white: 90, black: 70 }],
      [b, { white: null, black: 50 }],
    ]);
    expect(
      measureGames([a, b], { accuracy: (g, side) => table.get(g)![side] }).accuracy
    ).toBe(70);
    expect(measureGames([a, b], { accuracy: () => null }).accuracy).toBeNull();
    const seen: string[] = [];
    measureGames([fourPlyGame({ sides: ["black"] })], {
      accuracy: (_, s) => {
        seen.push(s);
        return 1;
      },
    });
    expect(seen).toEqual(["black"]);
  });
});

describe("target and tolerance", () => {
  it("the target is 75 % of the human rate, with 25 % tolerance", () => {
    expect(TARGET_SHARE).toBe(0.75);
    expect(TOLERANCE).toBe(0.25);
    expect(targetFor(4)).toBe(3);
    expect(targetFor(null)).toBeNull();
  });

  it("exactly ±25 % of the target is within; just outside is not", () => {
    expect(withinTarget(3, 4)).toBe(true);
    expect(withinTarget(3.75, 4)).toBe(true);
    expect(withinTarget(2.25, 4)).toBe(true);
    expect(withinTarget(3.7501, 4)).toBe(false);
    expect(withinTarget(2.2499, 4)).toBe(false);
    // Bounds that aren't exact in binary still count.
    expect(withinTarget(1.2 * 0.75 * 1.25, 1.2)).toBe(true);
    expect(withinTarget(1.2 * 0.75 * 0.75, 1.2)).toBe(true);
  });

  it("a target of 0 holds only a bot rate of 0", () => {
    expect(withinTarget(0, 0)).toBe(true);
    expect(withinTarget(0.01, 0)).toBe(false);
  });

  it("null on either side is never within", () => {
    expect(withinTarget(null, 4)).toBe(false);
    expect(withinTarget(3, null)).toBe(false);
    expect(withinTarget(null, null)).toBe(false);
  });
});
