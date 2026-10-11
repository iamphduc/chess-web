import { describe, expect, it } from "vitest";

import { applyMove } from "game/engine/engine";
import { initialGameState, type GameState } from "game/engine/game-state";
import { uciToMove } from "game/opponent/position";
import { GameOverType } from "features/board/components/GameOver";
import { liemTurn, type LiemTurnBoard } from "../liemTurn";
import { matchSlice, type MatchState } from "../matchSlice";

const RATING = 2732;

function play(state: GameState, ...ucis: string[]): GameState {
  return ucis.reduce((s, uci) => {
    const move = uciToMove(s, uci);
    if (move === null) throw new Error(`rejected ${uci}`);
    return applyMove(s, move);
  }, state);
}

const start = initialGameState();
const afterE4 = play(start, "e2e4");

/** A vs-Liem game with the human on White, one ply played: Black (Liem) to move. */
function board(over: Partial<LiemTurnBoard> = {}): LiemTurnBoard {
  return {
    engineHistory: [start, afterE4],
    gameId: 3,
    humanColor: "white",
    isPlaying: true,
    gameOver: GameOverType.Continue,
    flagFallWinner: null,
    pendingPromotion: null,
    ...over,
  };
}

function match(over: Partial<MatchState> = {}): MatchState {
  return { ...matchSlice.reducer(undefined, { type: "@@init" }), mode: "liem", setupOpen: false, ...over };
}

describe("his turn only", () => {
  it("returns the request on his turn", () => {
    expect(liemTurn(board(), match(), RATING)).toEqual({
      gameId: 3,
      ply: 1,
      state: afterE4,
      settings: { elo: 2100, clock: { baseMs: 600_000, incrementMs: 0 } },
    });
  });

  it("returns the last state by reference and ply = plies played", () => {
    const afterE5 = play(afterE4, "e7e5");
    const afterNf3 = play(afterE5, "g1f3");
    const turn = liemTurn(board({ engineHistory: [start, afterE4, afterE5, afterNf3] }), match(), RATING);
    expect(turn?.ply).toBe(3);
    expect(turn?.state).toBe(afterNf3);
  });

  it("plays White's first move when the human is Black (ply 0)", () => {
    const turn = liemTurn(board({ engineHistory: [start], humanColor: "black" }), match(), RATING);
    expect(turn).toMatchObject({ gameId: 3, ply: 0, state: start });
  });

  it("maps the strength step to an Elo, full being his rating", () => {
    expect(liemTurn(board(), match({ strength: 1400 }), RATING)?.settings.elo).toBe(1400);
    expect(liemTurn(board(), match({ strength: "full" }), RATING)?.settings.elo).toBe(2732);
  });

  it.each<[string, Partial<LiemTurnBoard>, Partial<MatchState>]>([
    ["two-player mode", {}, { mode: "two-player" }],
    ["setup card open", {}, { setupOpen: true }],
    ["no human color", { humanColor: null }, {}],
    ["clocks not running", { isPlaying: false }, {}],
    ["checkmate", { gameOver: GameOverType.Win }, {}],
    ["stalemate", { gameOver: GameOverType.Draw }, {}],
    ["flag fell", { flagFallWinner: "White" }, {}],
    ["promotion pending", { pendingPromotion: { from: [1, 0], to: [0, 0] } }, {}],
    ["human to move", { humanColor: "black" }, {}],
    ["human to move at the start", { engineHistory: [start] }, {}],
  ])("returns null when %s", (_name, b, m) => {
    expect(liemTurn(board(b), match(m), RATING)).toBeNull();
  });
});
