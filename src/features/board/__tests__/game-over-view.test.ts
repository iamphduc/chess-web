import { describe, expect, it } from "vitest";

import { createAppStore } from "app/store";
import { startLiemGame, switchMode } from "features/liem/liemActions";
import { setColorPick } from "features/liem/matchSlice";
import { EngineSquare, GameState, initialGameState } from "game/engine/game-state";
import { PieceType } from "game/piece-type";
import { boardSlice, clickSquare, promotePawn, resign, start, stop } from "../BoardSlice";
import { projectSquares } from "../engineAdapter";
import { gameOverView } from "../gameOverView";
import { PiecePromoted } from "../components/Promotion";

const { reducer } = boardSlice;
type BoardState = ReturnType<typeof reducer>;
type Store = ReturnType<typeof createAppStore>;

const TWO_PLAYERS = { mode: "two-player", setupOpen: false } as const;

const fresh = (): BoardState => reducer(undefined, { type: "@@INIT" });

function play(state: BoardState, from: [number, number], to: [number, number]): BoardState {
  state = reducer(state, clickSquare({ y: from[0], x: from[1] }));
  return reducer(state, clickSquare({ y: to[0], x: to[1] }));
}

function playOn(store: Store, from: [number, number], to: [number, number]) {
  store.dispatch(clickSquare({ y: from[0], x: from[1] }));
  store.dispatch(clickSquare({ y: to[0], x: to[1] }));
}

/** 1.f3 e5 2.g4 Qh4#: Black mates. */
function foolsMate(state: BoardState): BoardState {
  state = play(state, [6, 5], [5, 5]); // f3
  state = play(state, [1, 4], [3, 4]); // e5
  state = play(state, [6, 6], [4, 6]); // g4
  return play(state, [0, 3], [4, 7]); // Qh4#
}

/** White: Kf7, Qg4; black: Kh8. Qg6 stalemates. */
function stalemated(): BoardState {
  const grid = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null as EngineSquare));
  grid[0][7] = PieceType.BlackKing; // h8
  grid[1][5] = PieceType.WhiteKing; // f7
  grid[4][6] = PieceType.WhiteQueen; // g4
  const engine: GameState = { ...initialGameState(), squares: grid };
  const seeded = { ...fresh(), engineHistory: [engine], history: [{ squares: projectSquares(engine) }] };
  return play(seeded, [4, 6], [2, 6]); // Qg6
}

/** Play pressed, then 1.h4 g5 2.hxg5 h6 3.gxh6 Nf6 4.h7 Rg8 5.hxg8, piece not picked yet. */
function whitePickingPromotion(): BoardState {
  let s = reducer(fresh(), start());
  s = play(s, [6, 7], [4, 7]); // h4
  s = play(s, [1, 6], [3, 6]); // g5
  s = play(s, [4, 7], [3, 6]); // hxg5
  s = play(s, [1, 7], [2, 7]); // h6
  s = play(s, [3, 6], [2, 7]); // gxh6
  s = play(s, [0, 6], [2, 5]); // Nf6
  s = play(s, [2, 7], [1, 7]); // h7
  s = play(s, [0, 7], [0, 6]); // Rg8
  return play(s, [1, 7], [0, 6]); // hxg8, picker opens
}

/** A vs-Liem game in progress, with you playing White. */
function liemGame(): Store {
  const store = createAppStore();
  store.dispatch(setColorPick("white"));
  store.dispatch(startLiemGame());
  return store;
}

const view = (store: Store) => gameOverView(store.getState().board, store.getState().match);

describe("gameOverView", () => {
  it("result and reason for each ending", () => {
    expect(gameOverView(fresh(), TWO_PLAYERS)).toBeNull();
    expect(gameOverView(play(fresh(), [6, 4], [4, 4]), TWO_PLAYERS)).toBeNull(); // 1.e4, mid-game
    expect(gameOverView(reducer(fresh(), start()), TWO_PLAYERS)).toBeNull(); // clocks running

    expect(gameOverView(foolsMate(fresh()), TWO_PLAYERS)).toMatchObject({
      title: "Black wins",
      reason: "Checkmate",
    });
    expect(gameOverView(stalemated(), TWO_PLAYERS)).toMatchObject({ title: "Draw", reason: "Stalemate" });

    // White's clock runs out at the start: Black wins on time.
    expect(gameOverView(reducer(reducer(fresh(), start()), stop()), TWO_PLAYERS)).toMatchObject({
      title: "Black wins",
      reason: "On time",
    });
    // After 1.e4 Black's clock runs out: White wins on time.
    const blackFlag = reducer(play(reducer(fresh(), start()), [6, 4], [4, 4]), stop());
    expect(gameOverView(blackFlag, TWO_PLAYERS)).toMatchObject({ title: "White wins", reason: "On time" });

    // Two players: White resigns at the start.
    expect(gameOverView(reducer(reducer(fresh(), start()), resign()), TWO_PLAYERS)).toMatchObject({
      title: "Black wins",
      reason: "Resigned",
    });

    // vs Liem as White: you resign on his turn, and he wins with the same words.
    const store = liemGame();
    playOn(store, [6, 4], [4, 4]); // 1.e4, his turn
    store.dispatch(resign());
    expect(view(store)).toMatchObject({ title: "Black wins", reason: "Resigned" });
  });

  it("the result never changes after the game ends", () => {
    let s = foolsMate(reducer(fresh(), start()));
    s = reducer(s, stop());
    s = reducer(s, resign());
    expect(gameOverView(s, TWO_PLAYERS)).toMatchObject({ title: "Black wins", reason: "Checkmate" });
  });

  it("waits for a promotion pick", () => {
    // White's flag falls with the picker open: White, the mover, loses.
    let s = reducer(whitePickingPromotion(), stop());
    expect(gameOverView(s, TWO_PLAYERS)).toBeNull();
    s = reducer(s, promotePawn({ piecePromoted: PiecePromoted.Queen }));
    expect(gameOverView(s, TWO_PLAYERS)).toMatchObject({ title: "Black wins", reason: "On time" });

    // White resigns with the picker open.
    let r = reducer(whitePickingPromotion(), resign());
    expect(gameOverView(r, TWO_PLAYERS)).toBeNull();
    r = reducer(r, promotePawn({ piecePromoted: PiecePromoted.Knight }));
    expect(gameOverView(r, TWO_PLAYERS)).toMatchObject({ title: "Black wins", reason: "Resigned" });

    // No result with the picker open: nothing until the game ends.
    expect(gameOverView(whitePickingPromotion(), TWO_PLAYERS)).toBeNull();
  });

  it("review game only after a vs-Liem game", () => {
    // Two players, over: never.
    expect(gameOverView(foolsMate(fresh()), TWO_PLAYERS)?.review).toBe(false);

    // vs Liem, a move of yours, then over: yes.
    const store = liemGame();
    playOn(store, [6, 4], [4, 4]); // 1.e4
    store.dispatch(resign());
    expect(view(store)?.review).toBe(true);

    // vs Liem, over before you moved: no.
    const early = liemGame();
    early.dispatch(resign());
    expect(view(early)).toMatchObject({ reason: "Resigned", review: false });

    // vs Liem mid-game: no card at all.
    const midGame = liemGame();
    playOn(midGame, [6, 4], [4, 4]);
    expect(view(midGame)).toBeNull();

    // Two players in the real store, over: no.
    const two = createAppStore();
    two.dispatch(switchMode("two-player"));
    two.dispatch(start());
    two.dispatch(resign());
    expect(view(two)).toMatchObject({ reason: "Resigned", review: false });
  });
});
