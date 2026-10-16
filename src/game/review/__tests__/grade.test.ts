import { describe, expect, it } from "vitest";
import { winPercent } from "../../opponent/human-move";
import {
  BLUNDER,
  gradeForDrop,
  gradeMove,
  INACCURACY,
  isFound,
  MISTAKE,
  moveAccuracy,
  moveDrop,
  winFor,
} from "../grade";
import type { PositionEval } from "../types";

const cp = (n: number): PositionEval => ({ score: { cp: n }, best: "e2e4" });
const mate = (n: number): PositionEval => ({ score: { mate: n }, best: "e2e4" });
/** After the human's move the opponent is to move, so `after` is from his side. */
const theirs = (e: PositionEval): PositionEval =>
  "cp" in e.score ? { ...e, score: { cp: -e.score.cp } } : { ...e, score: { mate: -e.score.mate } };

describe("grade levels", () => {
  it("are 10, 20 and 30 win % points", () => {
    expect([INACCURACY, MISTAKE, BLUNDER]).toEqual([10, 20, 30]);
  });
});

describe("win from either side", () => {
  it("uses winPercent from the side to move", () => {
    expect(winFor(cp(0), "white", "white")).toBe(50);
    expect(winFor(cp(100), "white", "white")).toBe(winPercent({ cp: 100 }));
    expect(winFor(cp(100), "black", "black")).toBe(winPercent({ cp: 100 }));
  });

  it("negates the score for the other side", () => {
    expect(winFor(cp(100), "white", "black")).toBe(winPercent({ cp: -100 }));
    expect(winFor(cp(-250), "black", "white")).toBe(winPercent({ cp: 250 }));
  });

  it("scores mates as 100 for and 0 against", () => {
    expect(winFor(mate(3), "white", "white")).toBe(100);
    expect(winFor(mate(-3), "white", "white")).toBe(0);
    expect(winFor(mate(3), "white", "black")).toBe(0);
    expect(winFor(mate(-3), "black", "white")).toBe(100);
  });

  it("scores the terminal evals: checkmated 0 to move and 100 to the other side, stalemate 50", () => {
    const mated: PositionEval = { score: { mate: 0 }, best: null };
    expect(winFor(mated, "black", "black")).toBe(0);
    expect(winFor(mated, "black", "white")).toBe(100);
    const stalemate: PositionEval = { score: { cp: 0 }, best: null };
    expect(winFor(stalemate, "white", "white")).toBe(50);
    expect(winFor(stalemate, "white", "black")).toBe(50);
  });
});

describe("drop and accuracy", () => {
  it("drop is the win % lost, never below 0", () => {
    expect(moveDrop(60, 45)).toBe(15);
    expect(moveDrop(45, 60)).toBe(0);
  });

  it("accuracy follows the Lichess formula, clamped to 0..100", () => {
    expect(moveAccuracy(50, 40)).toBeCloseTo(63.58, 1);
    expect(moveAccuracy(50, 20)).toBeCloseTo(24.78, 1);
    expect(moveAccuracy(100, 0)).toBe(0);
    expect(moveAccuracy(40, 60)).toBe(100);
  });

  it("gradeMove reads before from the human's side and after from the opponent's", () => {
    const g = gradeMove(cp(0), theirs(cp(-100)));
    expect(g.drop).toBeCloseTo(50 - winPercent({ cp: -100 }), 10);
    expect(g.accuracy).toBeCloseTo(moveAccuracy(50, winPercent({ cp: -100 })), 10);
  });

  it("a move that gains scores 100 and drop 0", () => {
    const g = gradeMove(cp(0), theirs(cp(150)));
    expect(g).toEqual({ drop: 0, accuracy: 100, grade: null });
  });
});

describe("grade levels at their edges", () => {
  it("grades the drop at 9.99 / 10 / 19.99 / 20 / 29.99 / 30", () => {
    expect([9.99, 10, 19.99, 20, 29.99, 30].map(gradeForDrop)).toEqual([
      null,
      "inaccuracy",
      "inaccuracy",
      "mistake",
      "mistake",
      "blunder",
    ]);
  });

  it("gradeMove grades by the drop when no mate is involved", () => {
    expect(gradeMove(cp(0), theirs(cp(-1000))).grade).toBe("blunder");
    expect(gradeMove(cp(0), theirs(cp(-30))).grade).toBeNull();
  });
});

describe("mate rules", () => {
  it("a lost mate grades by the cp after: >999 inaccuracy, >700 mistake, else blunder", () => {
    const after = (n: number) => gradeMove(mate(3), theirs(cp(n))).grade;
    expect(after(1000)).toBe("inaccuracy");
    expect(after(999)).toBe("mistake");
    expect(after(701)).toBe("mistake");
    expect(after(700)).toBe("blunder");
    expect(after(699)).toBe("blunder");
  });

  it("a lost mate is an inaccuracy at +1500 though the drop is tiny", () => {
    const g = gradeMove(mate(5), theirs(cp(1500)));
    expect(g.drop).toBeLessThan(1);
    expect(g.grade).toBe("inaccuracy");
  });

  it("a mate turned into a mate against is a blunder", () => {
    expect(gradeMove(mate(3), theirs(mate(-2))).grade).toBe("blunder");
  });

  it("walking into a mate grades by the cp before: < -999 inaccuracy, < -700 mistake, else blunder", () => {
    const before = (n: number) => gradeMove(cp(n), theirs(mate(-2))).grade;
    expect(before(-1000)).toBe("inaccuracy");
    expect(before(-999)).toBe("mistake");
    expect(before(-701)).toBe("mistake");
    expect(before(-700)).toBe("blunder");
    expect(before(-699)).toBe("blunder");
    expect(before(0)).toBe("blunder");
  });

  it("mate to mate gives no grade", () => {
    expect(gradeMove(mate(5), theirs(mate(2))).grade).toBeNull();
    expect(gradeMove(mate(-5), theirs(mate(-1))).grade).toBeNull();
    // Delivering mate: the opponent is checkmated, `{ mate: 0 }` from his side.
    expect(gradeMove(mate(1), { score: { mate: 0 }, best: null }).grade).toBeNull();
  });

  it("getting out of a mate against is never graded", () => {
    expect(gradeMove(mate(-3), theirs(cp(-200))).grade).toBeNull();
  });
});

describe("found rule", () => {
  const base = { best: "e2e4", played: "d2d4", before: 50 };

  it("the best move is found, whatever its score", () => {
    expect(isFound({ ...base, tried: "e2e4", after: 0 })).toBe(true);
  });

  it("the move played is not found, whatever its score", () => {
    expect(isFound({ ...base, tried: "d2d4", after: 50 })).toBe(false);
  });

  it("another move is found when it loses less than 10", () => {
    expect(isFound({ ...base, tried: "g1f3", after: 40.01 })).toBe(true);
    expect(isFound({ ...base, tried: "g1f3", after: 40 })).toBe(false);
    expect(isFound({ ...base, tried: "g1f3", after: 70 })).toBe(true);
  });

  it("with no best move, only the loss decides", () => {
    expect(isFound({ ...base, best: null, tried: "g1f3", after: 45 })).toBe(true);
  });
});
