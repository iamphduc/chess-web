import { describe, expect, it } from "vitest";
import { EngineSquare, GameState, initialGameState } from "../../engine/game-state";
import { PieceType } from "../../piece-type";
import { Score } from "../engine/lines";
import { BLUNDER_LOSS, MISTAKE_LOSS, chooseHumanMove, winPercent } from "../human-move";
import { STEP_PROFILES, StepProfile } from "../step-profiles";
import { STRENGTH_STEPS } from "../strength";

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

/**
 * Kings and pawns only, White to move: few legal replies keep 10,000 picks
 * fast, and no pawn push hangs or captures anything.
 */
function pawnsOnly(): GameState {
  const P = PieceType;
  const pieces: Record<string, PieceType> = {
    e1: P.WhiteKing,
    a2: P.WhitePawnA,
    b2: P.WhitePawnB,
    c2: P.WhitePawnC,
    d2: P.WhitePawnD,
    g2: P.WhitePawnG,
    h2: P.WhitePawnH,
    e8: P.BlackKing,
    a7: P.BlackPawnA,
    h7: P.BlackPawnH,
  };
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
  };
}

const STATE = pawnsOnly();
const N = 10_000;

/**
 * Fixed fake lines centred on the steep part of the win % curve, so the
 * blunder line is as few cp down as it can be: a top line, a close second,
 * one mistake (loss about 21, 230 cp down) and one blunder (loss about 31,
 * 345 cp down).
 */
const TOP = { move: "a2a3", score: { cp: 170 } };
const SECOND = { move: "b2b3", score: { cp: 150 } };
const MISTAKE_LINE = { move: "c2c3", score: { cp: -60 } };
const BLUNDER_LINE = { move: "d2d3", score: { cp: -175 } };
const LINES: { move: string; score: Score }[] = [TOP, SECOND, MISTAKE_LINE, BLUNDER_LINE];

const lossOf = (s: Score) => winPercent(TOP.score) - winPercent(s);
const cpDrop = (s: Score) => TOP.score.cp - ("cp" in s ? s.cp : 0);

function tally(lines: { move: string; score: Score }[], p: StepProfile, seed: number) {
  const random = seeded(seed);
  const counts = new Map<string | null, number>();
  for (let i = 0; i < N; i++) {
    const move = chooseHumanMove(lines, STATE, p, random);
    counts.set(move, (counts.get(move) ?? 0) + 1);
  }
  return counts;
}

describe("chooser rates per level", () => {
  it("the fake lines sit in the bands", () => {
    expect(lossOf(SECOND.score)).toBeLessThan(5);
    expect(lossOf(MISTAKE_LINE.score)).toBeGreaterThanOrEqual(MISTAKE_LOSS);
    expect(lossOf(MISTAKE_LINE.score)).toBeLessThan(BLUNDER_LOSS);
    expect(lossOf(BLUNDER_LINE.score)).toBeGreaterThanOrEqual(BLUNDER_LOSS);
    expect(cpDrop(MISTAKE_LINE.score)).toBeLessThan(300);
    expect(cpDrop(BLUNDER_LINE.score)).toBe(345);
  });

  it("each level's chances", () => {
    STRENGTH_STEPS.forEach((step, i) => {
      // The level as it is, and with set chances on its other values.
      const level = STEP_PROFILES[step];
      const set: StepProfile = {
        ...level,
        mistakeChance: 0.12,
        blunderChance: 0.06,
        blunderMaxCp: 1000,
        hangWeight: 1,
      };
      for (const [name, p] of [["as is", level], ["set", set]] as const) {
        const counts = tally(LINES, p, 100 + i);
        const mistakes = (counts.get(MISTAKE_LINE.move) ?? 0) / N;
        const blunders = (counts.get(BLUNDER_LINE.move) ?? 0) / N;
        // The blunder line is reachable only under the level's cp cap.
        const blunderChance =
          cpDrop(BLUNDER_LINE.score) < p.blunderMaxCp ? p.blunderChance : 0;
        const label = `${step} ${name}`;
        expect(
          Math.abs(mistakes - p.mistakeChance),
          `${label} mistakes`
        ).toBeLessThanOrEqual(0.015);
        expect(Math.abs(blunders - blunderChance), `${label} blunders`).toBeLessThanOrEqual(0.015);
      }
    });
  }, 60_000);

  it("never walks into a seen mate at any level", () => {
    const withMates = [
      ...LINES,
      { move: "g2g3", score: { mate: -1 } },
      { move: "h2h3", score: { mate: 0 } },
    ];
    STRENGTH_STEPS.forEach((step, i) => {
      const p = STEP_PROFILES[step];
      // The level as it is, and with both bands always rolled.
      const rolling: StepProfile = {
        ...p,
        mistakeChance: 0.5,
        blunderChance: 0.5,
        blunderMaxCp: 100_000,
        hangWeight: 1,
      };
      for (const profile of [p, rolling]) {
        const counts = tally(withMates, profile, 200 + i);
        expect(counts.get("g2g3") ?? 0, `${step} mate in 1`).toBe(0);
        expect(counts.get("h2h3") ?? 0, `${step} mated`).toBe(0);
        expect(counts.has(null), `${step} null`).toBe(false);
      }
    });
  }, 60_000);

  it("Liem plays the best line", () => {
    expect(tally(LINES, STEP_PROFILES.full, 300)).toEqual(new Map([[TOP.move, N]]));
  });
});
