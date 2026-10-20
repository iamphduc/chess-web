import { describe, expect, it } from "vitest";

import { createAppStore } from "app/store";
import { liemTurn } from "features/liem/liemTurn";
import { replayLiemGame, startLiemGame, switchMode } from "features/liem/liemActions";
import { setColorPick } from "features/liem/matchSlice";
import type { LiemOpponent } from "features/liem/opponentController";
import { createLiemController, syncLiemTurn } from "features/liem/useLiemOpponent";
import { canOpenReview } from "features/review/reviewActions";
import type { MoveChoice } from "game/opponent/opponent";
import { uciToMove } from "game/opponent/position";
import type { PieceColor } from "game/engine/game-state";
import {
  boardSlice,
  clickSquare,
  newGame,
  playOpponentMove,
  promotePawn,
  reset,
  resign,
  start,
  stop,
} from "../BoardSlice";
import { canResign, gameEnd } from "../gameEnd";
import { PiecePromoted } from "../components/Promotion";

type Store = ReturnType<typeof createAppStore>;
const { reducer } = boardSlice;
type BoardState = ReturnType<typeof reducer>;

const fresh = (): BoardState => reducer(undefined, { type: "@@INIT" });

/** A click on `from`, then on `to`: one move by hand. */
function play(state: BoardState, from: [number, number], to: [number, number]): BoardState {
  state = reducer(state, clickSquare({ y: from[0], x: from[1] }));
  return reducer(state, clickSquare({ y: to[0], x: to[1] }));
}

function playOn(store: Store, from: [number, number], to: [number, number]) {
  store.dispatch(clickSquare({ y: from[0], x: from[1] }));
  store.dispatch(clickSquare({ y: to[0], x: to[1] }));
}

/** A vs-Liem game in progress, with you playing `color`. */
function liemGame(color: PieceColor): Store {
  const store = createAppStore();
  store.dispatch(setColorPick(color));
  store.dispatch(startLiemGame());
  return store;
}

/** Two players with Play pressed. */
function twoPlayerRunning(): Store {
  const store = createAppStore();
  store.dispatch(switchMode("two-player"));
  store.dispatch(start());
  return store;
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

describe("resign", () => {
  it("you resign vs Liem", () => {
    const store = liemGame("white");
    expect(canResign(store.getState().board)).toBe(true);
    store.dispatch(clickSquare({ y: 6, x: 4 })); // e2 held, hints showing
    expect(store.getState().board.possibleMoves.length).toBeGreaterThan(0);
    const soundBefore = store.getState().board.moveSound;

    store.dispatch(resign());
    const board = store.getState().board;
    expect(gameEnd(board)).toEqual({ winner: "black", reason: "resigned" });
    expect(board.isPlaying).toBe(false);
    expect(board.selectedPiece).toBeNull();
    expect(board.possibleMoves).toEqual([]);
    expect(board.moveSound).toBe(soundBefore); // no sound
    expect(canResign(board)).toBe(false);
  });

  it("his late move never lands after a resign", async () => {
    // You play Black, so he moves first. You resign while he thinks.
    const asks: ((choice: MoveChoice) => void)[] = [];
    const opponent: LiemOpponent = {
      chooseMove: () => new Promise<MoveChoice>((resolve) => asks.push(resolve)),
      analyse: () => Promise.reject(new Error("unused")),
      newGame: () => undefined,
      dispose: () => undefined,
    };
    const store = liemGame("black");
    const controller = createLiemController(store.dispatch, () => Promise.resolve(opponent));
    const sync = () => syncLiemTurn(controller, store.getState().board, store.getState().match);
    const flush = async () => {
      for (let i = 0; i < 50; i++) await Promise.resolve();
    };
    const e4 = (): MoveChoice => {
      const move = uciToMove(store.getState().board.engineHistory[0], "e2e4");
      if (move === null) throw new Error("illegal e2e4");
      return { move, uci: "e2e4", source: "engine", lookup: null };
    };

    sync();
    await flush();
    expect(asks).toHaveLength(1);

    store.dispatch(resign()); // on his turn: you still lose
    expect(gameEnd(store.getState().board)).toEqual({ winner: "white", reason: "resigned" });
    expect(liemTurn(store.getState().board, store.getState().match)).toBeNull();
    sync();

    asks[0](e4());
    await flush();
    expect(store.getState().board.engineHistory).toHaveLength(1);

    // Also his answer sent straight to the board for this game and ply.
    const { gameId } = store.getState().board;
    store.dispatch(playOpponentMove({ gameId, ply: 0, move: e4().move }));
    const board = store.getState().board;
    expect(board.engineHistory).toHaveLength(1);
    expect(board.notation).toEqual([]);
    expect(gameEnd(board)).toEqual({ winner: "white", reason: "resigned" });
    expect(liemTurn(board, store.getState().match)).toBeNull();
    expect(asks).toHaveLength(1); // never asked again
    controller.dispose();
  });

  it("you lose on his turn as White too", () => {
    const store = liemGame("white");
    playOn(store, [6, 4], [4, 4]); // 1.e4, now his turn
    store.dispatch(resign());
    expect(gameEnd(store.getState().board)).toEqual({ winner: "black", reason: "resigned" });
  });

  it("the side to move resigns in Two players", () => {
    const store = twoPlayerRunning();
    expect(canResign(store.getState().board)).toBe(true);
    playOn(store, [6, 4], [4, 4]); // 1.e4, Black's clock runs
    store.dispatch(resign());
    const board = store.getState().board;
    expect(gameEnd(board)).toEqual({ winner: "white", reason: "resigned" });
    expect(board.isPlaying).toBe(false);

    // White to move resigns: Black wins.
    const other = twoPlayerRunning();
    other.dispatch(resign());
    expect(gameEnd(other.getState().board)).toEqual({ winner: "black", reason: "resigned" });
  });

  it("resign with the picker open", () => {
    // Two players: the mover (White) is the side whose clock runs.
    let s = reducer(whitePickingPromotion(), resign());
    expect(gameEnd(s)).toEqual({ winner: "black", reason: "resigned" });
    expect(s.pendingPromotion).not.toBeNull(); // the picker stays open

    s = reducer(s, promotePawn({ piecePromoted: PiecePromoted.Queen }));
    expect(s.pendingPromotion).toBeNull();
    expect(s.notation[s.notation.length - 1]).toBe("hxg8=Q");
    expect(gameEnd(s)).toEqual({ winner: "black", reason: "resigned" });
  });

  it("resign only once, only in a running game", () => {
    // Two players before Play: the clocks are stopped.
    const notStarted = createAppStore();
    notStarted.dispatch(switchMode("two-player"));
    const before = notStarted.getState().board;
    expect(canResign(before)).toBe(false);
    notStarted.dispatch(resign());
    expect(notStarted.getState().board).toBe(before);

    // vs Liem with the setup card open: no game yet.
    const setup = createAppStore();
    expect(canResign(setup.getState().board)).toBe(false);
    const setupBefore = setup.getState().board;
    setup.dispatch(resign());
    expect(setup.getState().board).toBe(setupBefore);

    // After mate, even before the clocks stop.
    let mate = reducer(fresh(), start());
    mate = play(mate, [6, 5], [5, 5]); // f3
    mate = play(mate, [1, 4], [3, 4]); // e5
    mate = play(mate, [6, 6], [4, 6]); // g4
    mate = play(mate, [0, 3], [4, 7]); // Qh4#
    expect(mate.isPlaying).toBe(true);
    expect(canResign(mate)).toBe(false);
    expect(reducer(mate, resign())).toBe(mate);

    // After a flag fall.
    const flagged = reducer(reducer(fresh(), start()), stop());
    expect(canResign(flagged)).toBe(false);
    expect(reducer(flagged, resign())).toBe(flagged);

    // A second resign, and a stop() after it, keep the first result.
    const once = reducer(reducer(fresh(), start()), resign());
    expect(reducer(once, resign())).toBe(once);
    const stopped = reducer(once, stop());
    expect(gameEnd(stopped)).toEqual({ winner: "black", reason: "resigned" });
  });

  it("a new game clears the result", () => {
    const store = liemGame("white");
    store.dispatch(resign());
    expect(gameEnd(store.getState().board)).not.toBeNull();

    store.dispatch(replayLiemGame());
    expect(gameEnd(store.getState().board)).toBeNull();
    expect(canResign(store.getState().board)).toBe(true);

    const resigned = reducer(reducer(fresh(), start()), resign());
    expect(gameEnd(reducer(resigned, reset()))).toBeNull();
    const next = reducer(resigned, newGame({ humanColor: "black" }));
    expect(gameEnd(next)).toBeNull();
    expect(canResign(next)).toBe(true);
  });

  it("review after a resign", () => {
    // Before your first move: nothing to review.
    const early = liemGame("white");
    early.dispatch(resign());
    expect(canOpenReview(early.getState().board, early.getState().match)).toBe(false);

    // After 1.e4, on his turn.
    const store = liemGame("white");
    playOn(store, [6, 4], [4, 4]);
    expect(canOpenReview(store.getState().board, store.getState().match)).toBe(false);
    store.dispatch(resign());
    expect(canOpenReview(store.getState().board, store.getState().match)).toBe(true);
  });
});
