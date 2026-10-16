import { describe, expect, it } from "vitest";
import type { PieceColor } from "../../engine/game-state";
import { gameAccuracy, lichessMoveAccuracy, lichessWinPercent, volatilityWeights } from "../game-accuracy";

// Lichess's numbers, written out here so the tests don't lean on the code.
const winOfCp = (cp: number): number => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
const accOf = (drop: number): number =>
  Math.min(100, Math.max(0, 103.1668100711649 * Math.exp(-0.04354415386753951 * drop) - 3.166924740191411 + 1));
const popSd = (xs: number[]): number => {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / xs.length);
};

/** Ply i's mover when White starts. */
const movers = (plies: number): PieceColor[] =>
  Array.from({ length: plies }, (_, i) => (i % 2 === 0 ? "white" : "black"));

describe("lichessWinPercent (White's view)", () => {
  it("uses the scalachess curve for cp", () => {
    expect(lichessWinPercent({ cp: 0 }, "white")).toBeCloseTo(50, 9);
    expect(lichessWinPercent({ cp: 300 }, "white")).toBeCloseTo(winOfCp(300), 9);
  });

  it("flips cp when Black is to move", () => {
    expect(lichessWinPercent({ cp: 300 }, "black")).toBeCloseTo(winOfCp(-300), 9);
  });

  it("clamps cp to ±1000", () => {
    expect(lichessWinPercent({ cp: 2500 }, "white")).toBeCloseTo(winOfCp(1000), 9);
    expect(lichessWinPercent({ cp: -2500 }, "white")).toBeCloseTo(winOfCp(-1000), 9);
  });

  it("treats a mate as ±1000 cp, and mate 0 as a mate against the side to move", () => {
    expect(lichessWinPercent({ mate: 3 }, "white")).toBeCloseTo(winOfCp(1000), 9);
    expect(lichessWinPercent({ mate: -2 }, "white")).toBeCloseTo(winOfCp(-1000), 9);
    expect(lichessWinPercent({ mate: 3 }, "black")).toBeCloseTo(winOfCp(-1000), 9);
    expect(lichessWinPercent({ mate: 0 }, "white")).toBeCloseTo(winOfCp(-1000), 9);
    expect(lichessWinPercent({ mate: 0 }, "black")).toBeCloseTo(winOfCp(1000), 9);
  });
});

describe("lichessMoveAccuracy", () => {
  it("is 100 when the mover's win % holds or rises", () => {
    expect(lichessMoveAccuracy(40, 40)).toBe(100);
    expect(lichessMoveAccuracy(40, 70)).toBe(100);
  });

  it("includes the +1 uncertainty bonus", () => {
    expect(lichessMoveAccuracy(50, 30)).toBeCloseTo(accOf(20), 9);
    expect(lichessMoveAccuracy(50, 30)).toBeCloseTo(103.1668100711649 * Math.exp(-0.04354415386753951 * 20) - 2.166924740191411, 9);
  });

  it("clamps to 0 and 100", () => {
    expect(lichessMoveAccuracy(50, 49.99)).toBe(100); // raw is above 100 for tiny drops
    expect(lichessMoveAccuracy(95, 0)).toBe(0);
  });
});

describe("volatilityWeights", () => {
  it("uses windows of 2 under 20 plies: one per ply, clamped to [0.5, 12]", () => {
    expect(volatilityWeights([50, 50, 60, 30, 30])).toEqual([0.5, 5, 12, 0.5]);
  });

  it("repeats the first window (windowSize - 2) times, then slides", () => {
    // 30 plies → window 3: 1 copy of the first 3, then 29 sliding windows.
    const wins = Array.from({ length: 31 }, (_, i) => 40 + ((i * 7) % 11));
    const w = volatilityWeights(wins);
    expect(w).toHaveLength(30);
    const clamp = (x: number) => Math.min(12, Math.max(0.5, x));
    expect(w[0]).toBeCloseTo(clamp(popSd(wins.slice(0, 3))), 9);
    expect(w[1]).toBeCloseTo(clamp(popSd(wins.slice(0, 3))), 9);
    expect(w[2]).toBeCloseTo(clamp(popSd(wins.slice(1, 4))), 9);
    expect(w[29]).toBeCloseTo(clamp(popSd(wins.slice(28, 31))), 9);
  });

  it("caps the window at 8 plies", () => {
    // 100 plies → floor(100/10) = 10, capped at 8: 6 copies of the first 8.
    const wins = Array.from({ length: 101 }, (_, i) => 30 + ((i * 13) % 17));
    const w = volatilityWeights(wins);
    expect(w).toHaveLength(100);
    const first = Math.min(12, Math.max(0.5, popSd(wins.slice(0, 8))));
    for (let i = 0; i < 7; i++) expect(w[i]).toBeCloseTo(first, 9);
    expect(w[7]).toBeCloseTo(Math.min(12, Math.max(0.5, popSd(wins.slice(1, 9)))), 9);
  });

  it("leaves out a missing win % from its windows", () => {
    expect(volatilityWeights([null, 50, 60])).toEqual([0.5, 5]);
    expect(volatilityWeights([50, 60, null])).toEqual([5, 0.5]);
  });
});

describe("gameAccuracy", () => {
  it("is 100 for a game the color never loses ground in", () => {
    expect(gameAccuracy([50, 50, 50], movers(2), "white")).toBe(100);
  });

  it("is the move's accuracy when the color has one ply", () => {
    expect(gameAccuracy([50, 30, 30], movers(2), "white")).toBeCloseTo(accOf(20), 9);
  });

  it("averages the volatility-weighted mean and the harmonic mean", () => {
    // White: ply 0 gains (100, weight 5), ply 2 drops 30 (weight 12).
    const a = accOf(30);
    const weighted = (100 * 5 + a * 12) / 17;
    const harmonic = 2 / (1 / 100 + 1 / a);
    expect(gameAccuracy([50, 60, 60, 30, 30], movers(4), "white")).toBeCloseTo((weighted + harmonic) / 2, 9);
  });

  it("scores Black from Black's side", () => {
    // White's win goes 50 → 50 → 70: Black's ply 1 loses 20 points.
    expect(gameAccuracy([50, 50, 70], movers(2), "black")).toBeCloseTo(accOf(20), 9);
    expect(gameAccuracy([50, 50, 30], movers(2), "black")).toBe(100);
  });

  it("floors each accuracy at 1 in the harmonic mean", () => {
    // One ply at 0: weighted 0, harmonic 1 / (1 / 1) = 1.
    expect(gameAccuracy([95, 0, 0], movers(2), "white")).toBeCloseTo(0.5, 9);
  });

  it("is null when a ply of the color lacks a win %", () => {
    expect(gameAccuracy([50, 50, null, 50], movers(3), "white")).toBeNull();
    expect(gameAccuracy([null, 50, 50], movers(2), "white")).toBeNull();
  });

  it("doesn't need the other color's missing win %", () => {
    expect(gameAccuracy([50, 50, 50, 40, null], movers(4), "white")).toBeCloseTo(
      ((100 * 0.5 + accOf(10) * 5) / 5.5 + 2 / (1 / 100 + 1 / accOf(10))) / 2,
      9
    );
    expect(gameAccuracy([null, 50, 50], movers(2), "black")).toBe(100);
  });

  it("is null when the color has no plies", () => {
    expect(gameAccuracy([50], [], "white")).toBeNull();
    expect(gameAccuracy([50, 50], movers(1), "black")).toBeNull();
  });
});
