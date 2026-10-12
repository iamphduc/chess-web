import { describe, expect, it } from "vitest";
import { applyMove } from "../../../src/game/engine/engine";
import { initialGameState, type GameState } from "../../../src/game/engine/game-state";
import { gameStatus } from "../../../src/game/engine/game-status";
import type { EngineLine } from "../../../src/game/opponent/engine/lines";
import { winPercent } from "../../../src/game/opponent/human-move";
import { moveToUci, uciToMove } from "../../../src/game/opponent/position";
import {
  eloGap,
  gamePlan,
  moveLoss,
  OPENINGS,
  playGame,
  playMatch,
  summarize,
  type MatchPlayer,
  type MovePlayed,
  type Opening,
} from "../match";

/** Plays the given moves in order, then throws. */
function scripted(name: string, moves: readonly string[]): MatchPlayer {
  let next = 0;
  return {
    name,
    newGame: () => {
      next = 0;
    },
    move: async () => {
      if (next >= moves.length) throw new Error(`${name} ran out of moves`);
      return { uci: moves[next++] };
    },
  };
}

/** Shuffles a knight out and back forever, so a game never ends by itself. */
function shuffler(name: string, log?: { state: GameState }[]): MatchPlayer {
  return {
    name,
    newGame: () => {},
    move: async (state) => {
      log?.push({ state });
      const home = state.turn === "white" ? ["g1f3", "f3g1"] : ["g8f6", "f6g8"];
      const uci = home.find((m) => uciToMove(state, m) !== null);
      if (!uci) throw new Error("no knight move");
      return { uci };
    },
  };
}

const START: Opening = { name: "start", moves: [] };

function line(move: string, cp: number): EngineLine {
  return { move, score: { cp }, depth: 5 };
}

describe("playGame", () => {
  it("a game ends on checkmate, stalemate or the ply cap", async () => {
    // Fool's mate: 1.f3 e5 2.g4 Qh4#.
    const mate = await playGame(
      scripted("W", ["f2f3", "g2g4"]),
      scripted("B", ["e7e5", "d8h4"]),
      START
    );
    expect(mate).toMatchObject({ end: "checkmate", winner: "black", plies: 4 });

    // Loyd's ten-move stalemate, with Black to move and no legal move.
    const loyd = [
      "e2e3", "a7a5", "d1h5", "a8a6", "h5a5", "h7h5", "h2h4", "a6h6", "a5c7", "f7f6",
      "c7d7", "e8f7", "d7b7", "d8d3", "b7b8", "d3h7", "b8c8", "f7g6", "c8e6",
    ];
    const stale = await playGame(
      scripted("W", loyd.filter((_, i) => i % 2 === 0)),
      scripted("B", loyd.filter((_, i) => i % 2 === 1)),
      START
    );
    expect(stale).toMatchObject({ end: "stalemate", winner: null, plies: 19 });

    // Neither side can end it: a draw at exactly 200 plies, opening moves included.
    const capped = await playGame(shuffler("W"), shuffler("B"), {
      name: "e4 e5",
      moves: ["e2e4", "e7e5"],
    });
    expect(capped).toMatchObject({ end: "ply-cap", winner: null, plies: 200 });
    expect(capped.moves.white.length + capped.moves.black.length).toBe(198);
  });

  it("a mate on the last ply before the cap still wins", async () => {
    const mate = await playGame(
      scripted("W", ["f2f3", "g2g4"]),
      scripted("B", ["e7e5", "d8h4"]),
      START,
      { maxPlies: 4 }
    );
    expect(mate).toMatchObject({ end: "checkmate", winner: "black", plies: 4 });
  });

  it("an error ends the game and is reported, not scored", async () => {
    const thrown = await playGame(scripted("W", ["e2e4"]), scripted("B", ["e7e5"]), START);
    expect(thrown).toMatchObject({ end: "error", winner: null, plies: 2 });
    expect(thrown.error).toMatch(/W ran out of moves/);

    const illegal = await playGame(scripted("W", ["e2e5"]), scripted("B", []), START);
    expect(illegal).toMatchObject({ end: "error", winner: null, plies: 0 });
    expect(illegal.error).toMatch(/W.*illegal.*e2e5/);

    // Two games against a player that always fails: both are errors, none scored.
    const broken: MatchPlayer = {
      name: "broken",
      newGame: () => {},
      move: async () => {
        throw new Error("engine-failed");
      },
    };
    const result = await playMatch({ a: shuffler("A"), b: broken, games: 2, maxPlies: 20 });
    expect(result).toMatchObject({ wins: 0, draws: 0, losses: 0, errors: 2, played: 0 });
    expect(result.score).toBeNull();
    expect(result.eloGap).toBeNull();
    expect(result.errorMessages).toEqual([
      expect.stringMatching(/engine-failed/),
      expect.stringMatching(/engine-failed/),
    ]);

    // One error among scored games: only the others count.
    let calls = 0;
    const flaky: MatchPlayer = {
      name: "flaky",
      newGame: () => {},
      move: async (state) => {
        calls += 1;
        if (calls === 1) throw new Error("engine-timeout");
        return shuffler("x").move(state);
      },
    };
    const mixed = await playMatch({ a: shuffler("A"), b: flaky, games: 2, maxPlies: 6 });
    expect(mixed).toMatchObject({ wins: 0, draws: 1, losses: 0, errors: 1, played: 1, score: 0.5 });
  });

  it("every built-in opening is legal and leaves the game going", () => {
    expect(OPENINGS.length).toBeGreaterThanOrEqual(6);
    expect(new Set(OPENINGS.map((o) => o.moves.join(" "))).size).toBe(OPENINGS.length);
    for (const opening of OPENINGS) {
      let state = initialGameState();
      for (const uci of opening.moves) {
        const move = uciToMove(state, uci);
        expect(move, `${opening.name} ${uci}`).not.toBeNull();
        state = applyMove(state, move!);
      }
      expect(state.turn, opening.name).toBe("white");
      expect(gameStatus(state), opening.name).toBe("ongoing");
    }
  });
});

describe("playMatch", () => {
  it("colors swap each game and openings cycle", async () => {
    const openings: Opening[] = [
      { name: "e4", moves: ["e2e4", "e7e5"] },
      { name: "d4", moves: ["d2d4", "d7d5"] },
      { name: "c4", moves: ["c2c4", "c7c5"] },
    ];
    expect(gamePlan(8, openings.length)).toEqual([
      { game: 0, opening: 0, aWhite: true },
      { game: 1, opening: 0, aWhite: false },
      { game: 2, opening: 1, aWhite: true },
      { game: 3, opening: 1, aWhite: false },
      { game: 4, opening: 2, aWhite: true },
      { game: 5, opening: 2, aWhite: false },
      { game: 6, opening: 0, aWhite: true },
      { game: 7, opening: 0, aWhite: false },
    ]);

    // Each game, the first position A is asked about shows its color and the opening.
    const seen: { state: GameState }[] = [];
    let games = 0;
    const a = shuffler("A", seen);
    const counted: MatchPlayer = { ...a, newGame: () => void games++ };
    const result = await playMatch({ a: counted, b: shuffler("B"), games: 6, openings, maxPlies: 6 });
    expect(games).toBe(6);
    expect(result.records.map((r) => [r.white, r.black, r.opening])).toEqual([
      ["A", "B", "e4"],
      ["B", "A", "e4"],
      ["A", "B", "d4"],
      ["B", "A", "d4"],
      ["A", "B", "c4"],
      ["B", "A", "c4"],
    ]);
    // A moves first as White at ply 2 and second as Black, after B's first move.
    const firstMoves = result.records.map((r) => r.firstMoves);
    expect(firstMoves[0]).toEqual(["e2e4", "e7e5", "g1f3"]);
    expect(firstMoves[3]).toEqual(["d2d4", "d7d5", "g1f3"]);
    expect(firstMoves[4]).toEqual(["c2c4", "c7c5", "g1f3"]);
  });

  it("score and Elo estimate, clamped at 0 and 100 percent", async () => {
    expect(eloGap(3, 4)).toBeCloseTo(190.85, 1);
    expect(eloGap(2, 4)).toBeCloseTo(0, 6);
    expect(eloGap(1, 4)).toBeCloseTo(-190.85, 1);
    // 0/4 and 4/4 count as 0.5/4 and 3.5/4.
    expect(eloGap(0, 4)).toBeCloseTo(-400 * Math.log10(7), 6);
    expect(eloGap(4, 4)).toBeCloseTo(400 * Math.log10(7), 6);
    expect(Number.isFinite(eloGap(0, 2))).toBe(true);
    expect(eloGap(0, 0)).toBeNull();

    // A mates B in three of four games (as White), and B mates A once.
    const mater = (name: string): MatchPlayer => {
      let n = 0;
      return {
        name,
        newGame: () => {
          n = 0;
        },
        move: async (state) => {
          // White always walks into Fool's mate; Black always mates.
          const white = ["f2f3", "g2g4"];
          const black = ["e7e5", "d8h4"];
          const uci = (state.turn === "white" ? white : black)[n++];
          return { uci };
        },
      };
    };
    // Black wins every game, so A (White in games 0 and 2) loses 2 and wins 2.
    const even = await playMatch({ a: mater("A"), b: mater("B"), games: 4, openings: [START] });
    expect(even).toMatchObject({ wins: 2, draws: 0, losses: 2, errors: 0, played: 4, score: 0.5 });
    expect(even.eloGap).toBeCloseTo(0, 6);

    // Draws score half: four ply-cap draws are 50 percent.
    const drawn = await playMatch({ a: shuffler("A"), b: shuffler("B"), games: 4, maxPlies: 4 });
    expect(drawn).toMatchObject({ wins: 0, draws: 4, losses: 0, score: 0.5 });
  });

  it("score is from A's view: 3 wins and a loss is about +191", () => {
    const record = (white: string, black: string, winner: "white" | "black" | null) => ({
      white,
      black,
      opening: "x",
      plies: 10,
      end: winner ? ("checkmate" as const) : ("ply-cap" as const),
      winner,
      firstMoves: [],
      moves: { white: [], black: [] },
    });
    const s = summarize("A", "B", [
      record("A", "B", "white"),
      record("B", "A", "black"),
      record("A", "B", "white"),
      record("B", "A", "white"),
    ]);
    expect(s).toMatchObject({ wins: 3, draws: 0, losses: 1, errors: 0, played: 4, score: 0.75 });
    expect(s.eloGap).toBeCloseTo(190.85, 1);
  });

  it("average loss per move comes from the played line", async () => {
    const lines = [line("e2e4", 50), line("d2d4", 30), line("a2a3", -100)];
    expect(moveLoss("e2e4", lines)).toBe(0);
    expect(moveLoss("a2a3", lines)).toBeCloseTo(winPercent({ cp: 50 }) - winPercent({ cp: -100 }), 9);
    // The best line need not come first; the loss is against the best win %.
    expect(moveLoss("e2e4", [line("d2d4", 30), line("e2e4", 50)])).toBe(0);
    // Mate scores count through win %: a missed mate in 2 for a +100 line.
    expect(moveLoss("g1f3", [{ move: "d1h5", score: { mate: 2 }, depth: 5 }, line("g1f3", 100)]))
      .toBeCloseTo(100 - winPercent({ cp: 100 }), 9);
    // Not scored: no lines (book move), empty lines, or a move outside them.
    expect(moveLoss("e2e4", undefined)).toBeNull();
    expect(moveLoss("e2e4", [])).toBeNull();
    expect(moveLoss("h2h4", lines)).toBeNull();

    // In a match: A plays the 2nd line on its first move, a skipped move on its
    // second, and the best on its third; slips are losses above its slipAbove.
    const big = winPercent({ cp: 50 }) - winPercent({ cp: -300 });
    const plays: MovePlayed[] = [
      { uci: "g1f3", lines: [line("e2e4", 50), line("g1f3", -300)] },
      { uci: "f3g1" },
      { uci: "g1f3", lines: [line("g1f3", 20), line("b1c3", 10)] },
    ];
    let n = 0;
    const a: MatchPlayer = {
      name: "A",
      slipAbove: 10,
      newGame: () => {
        n = 0;
      },
      move: async () => plays[n++],
    };
    const result = await playMatch({ a, b: shuffler("B"), games: 1, openings: [START], maxPlies: 6 });
    expect(result.scoredMoves).toBe(2);
    expect(result.avgLoss).toBeCloseTo(big / 2, 9);
    expect(result.slipRate).toBeCloseTo(0.5, 9);
    expect(result.maxLoss).toBeCloseTo(big, 9);

    // A player with no slipAbove (an anchor) has no slip rate or loss.
    const anchor = await playMatch({ a: shuffler("A"), b: shuffler("B"), games: 2, maxPlies: 4 });
    expect(anchor.avgLoss).toBeNull();
    expect(anchor.slipRate).toBeNull();
  });

  it("times every move of A, average and max", async () => {
    let clock = 0;
    const steps = [5, 30, 10];
    let n = 0;
    const a: MatchPlayer = {
      name: "A",
      newGame: () => {},
      move: async (state) => {
        clock += steps[n++ % steps.length];
        return shuffler("x").move(state);
      },
    };
    const b: MatchPlayer = {
      name: "B",
      newGame: () => {},
      move: async (state) => {
        clock += 1000; // B's time never counts for A.
        return shuffler("x").move(state);
      },
    };
    const result = await playMatch({ a, b, games: 1, openings: [START], maxPlies: 6, now: () => clock });
    expect(result.avgMs).toBeCloseTo(15, 9);
    expect(result.maxMs).toBe(30);
  });

  it("an even, positive game count is required", async () => {
    await expect(playMatch({ a: shuffler("A"), b: shuffler("B"), games: 0 })).rejects.toThrow(RangeError);
    await expect(playMatch({ a: shuffler("A"), b: shuffler("B"), games: 1.5 })).rejects.toThrow(RangeError);
    expect(() => gamePlan(2, 0)).toThrow(RangeError);
  });
});

// Keep the helpers honest: moveToUci round-trips what uciToMove finds.
it("test helpers play legal moves", () => {
  const move = uciToMove(initialGameState(), "g1f3");
  expect(move && moveToUci(move)).toBe("g1f3");
});
