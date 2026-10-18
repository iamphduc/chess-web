import { describe, expect, it } from "vitest";

import { applyMove } from "game/engine/engine";
import { initialGameState, type GameState } from "game/engine/game-state";
import { uciToMove } from "game/opponent/position";
import { STEP_PROFILES } from "game/opponent/step-profiles";
import { createAppStore } from "app/store";
import { GameOverType } from "features/board/components/GameOver";
import { liemTurn, type LiemTurnBoard } from "../liemTurn";
import { matchSlice, type MatchState, setColorPick } from "../matchSlice";
import { liemGameId } from "../useLiemOpponent";

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
    expect(liemTurn(board(), match())).toEqual({
      gameId: 3,
      ply: 1,
      state: afterE4,
      settings: { profile: STEP_PROFILES[2100], clock: { baseMs: 600_000, incrementMs: 0 } },
    });
  });

  it("returns the last state by reference and ply = plies played", () => {
    const afterE5 = play(afterE4, "e7e5");
    const afterNf3 = play(afterE5, "g1f3");
    const turn = liemTurn(board({ engineHistory: [start, afterE4, afterE5, afterNf3] }), match());
    expect(turn?.ply).toBe(3);
    expect(turn?.state).toBe(afterNf3);
  });

  it("plays White's first move when the human is Black (ply 0)", () => {
    const turn = liemTurn(board({ engineHistory: [start], humanColor: "black" }), match());
    expect(turn).toMatchObject({ gameId: 3, ply: 0, state: start });
  });

  it("maps the strength step to its profile", () => {
    expect(liemTurn(board(), match({ strength: 1400 }))?.settings.profile).toBe(STEP_PROFILES[1400]);
    expect(liemTurn(board(), match({ strength: 2500 }))?.settings.profile).toBe(STEP_PROFILES[2500]);
    expect(liemTurn(board(), match({ strength: "full" }))?.settings.profile).toBe(STEP_PROFILES.full);
    expect(liemTurn(board(), match())?.settings).not.toHaveProperty("elo");
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
    expect(liemTurn(board(b), match(m))).toBeNull();
  });
});

describe("page load", () => {
  it("no request on page load", () => {
    const store = createAppStore();
    const { board, match } = store.getState();
    // The page opens on vs Liem with the card open, and nothing asks him or loads him.
    expect(match).toMatchObject({ mode: "liem", setupOpen: true });
    expect(liemTurn(board, match)).toBeNull();
    expect(liemGameId(board, match)).toBeNull();

    // Black picked: he would move first, but not before Start game.
    store.dispatch(setColorPick("black"));
    const after = store.getState();
    expect(after.match.colorPick).toBe("black");
    expect(liemTurn(after.board, after.match)).toBeNull();
    expect(liemGameId(after.board, after.match)).toBeNull();
  });
});
