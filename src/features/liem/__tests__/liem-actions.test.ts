import { describe, expect, it } from "vitest";

import { createAppStore } from "app/store";
import { clickSquare, reset } from "features/board/BoardSlice";
import { setFlipped } from "features/board/viewSlice";
import { newLiemGame, startLiemGame, switchMode } from "../liemActions";
import { setColorPick, setStrength } from "../matchSlice";

type Store = ReturnType<typeof createAppStore>;

/** A store in vs-Liem mode with the setup card open: the page as it opens. */
function liemStore(): Store {
  return createAppStore();
}

/** A store in Two players, after one click on its tab. */
function twoPlayerStore(): Store {
  const store = createAppStore();
  store.dispatch(switchMode("two-player"));
  return store;
}

/** Plays 1.e4 by hand (e2 is [6, 4], e4 is [4, 4]). */
function playE4(store: Store) {
  store.dispatch(clickSquare({ y: 6, x: 4 }));
  store.dispatch(clickSquare({ y: 4, x: 4 }));
}

describe("switchMode", () => {
  it("keeps the board state object when the mode is the current one", () => {
    // The vs Liem tab at page load changes nothing.
    const store = createAppStore();
    const board = store.getState().board;
    const match = store.getState().match;
    store.dispatch(switchMode("liem"));
    expect(store.getState().board).toBe(board);
    expect(store.getState().match).toBe(match);

    store.dispatch(switchMode("two-player"));
    const twoBoard = store.getState().board;
    const twoMatch = store.getState().match;
    store.dispatch(switchMode("two-player"));
    expect(store.getState().board).toBe(twoBoard);
    expect(store.getState().match).toBe(twoMatch);
  });

  it("to liem resets the board and opens the card", () => {
    const store = twoPlayerStore();
    const gameId = store.getState().board.gameId;
    store.dispatch(switchMode("liem"));
    const { board, match } = store.getState();
    expect(match.mode).toBe("liem");
    expect(match.setupOpen).toBe(true);
    expect(board.gameId).toBe(gameId + 1);
    expect(board.isPlaying).toBe(false);
    expect(board.humanColor).toBeNull();
  });

  it("to two-player mid-game resets the board and closes the card", () => {
    const store = liemStore();
    store.dispatch(startLiemGame());
    const gameId = store.getState().board.gameId;
    store.dispatch(switchMode("two-player"));
    const { board, match } = store.getState();
    expect(match.mode).toBe("two-player");
    expect(match.setupOpen).toBe(false);
    expect(board.gameId).toBe(gameId + 1);
    expect(board.isPlaying).toBe(false);
    expect(board.humanColor).toBeNull();
  });

  it("leaves the flip as is", () => {
    const store = twoPlayerStore();
    store.dispatch(setFlipped(true));
    store.dispatch(switchMode("liem"));
    expect(store.getState().view.flipped).toBe(true);
    store.dispatch(switchMode("two-player"));
    expect(store.getState().view.flipped).toBe(true);
  });
});

describe("startLiemGame", () => {
  it("White: humanColor white, not flipped, playing, card closed, gameId + 1", () => {
    const store = liemStore();
    const gameId = store.getState().board.gameId;
    store.dispatch(startLiemGame());
    const { board, match, view } = store.getState();
    expect(board.humanColor).toBe("white");
    expect(board.isPlaying).toBe(true);
    expect(board.gameId).toBe(gameId + 1);
    expect(view.flipped).toBe(false);
    expect(match.setupOpen).toBe(false);
  });

  it("Black: humanColor black and the board flipped", () => {
    const store = liemStore();
    store.dispatch(setColorPick("black"));
    store.dispatch(startLiemGame());
    expect(store.getState().board.humanColor).toBe("black");
    expect(store.getState().view.flipped).toBe(true);
  });

  it("White after a Black game turns the board back", () => {
    const store = liemStore();
    store.dispatch(setColorPick("black"));
    store.dispatch(startLiemGame());
    store.dispatch(newLiemGame());
    store.dispatch(setColorPick("white"));
    store.dispatch(startLiemGame());
    expect(store.getState().view.flipped).toBe(false);
  });

  it("Random: 0.49 is white, 0.5 is black", () => {
    const low = liemStore();
    low.dispatch(setColorPick("random"));
    low.dispatch(startLiemGame(() => 0.49));
    expect(low.getState().board.humanColor).toBe("white");
    expect(low.getState().view.flipped).toBe(false);

    const high = liemStore();
    high.dispatch(setColorPick("random"));
    high.dispatch(startLiemGame(() => 0.5));
    expect(high.getState().board.humanColor).toBe("black");
    expect(high.getState().view.flipped).toBe(true);
  });

  it("keeps the strength picked on the card", () => {
    const store = liemStore();
    store.dispatch(setStrength("full"));
    store.dispatch(startLiemGame());
    expect(store.getState().match.strength).toBe("full");
  });

  it("does nothing once the card is closed, so a second Start keeps the game", () => {
    const store = liemStore();
    store.dispatch(startLiemGame());
    playE4(store);
    const board = store.getState().board;
    expect(board.engineHistory).toHaveLength(2);
    store.dispatch(startLiemGame());
    expect(store.getState().board).toBe(board);
  });

  it("does nothing in two-player mode", () => {
    const store = twoPlayerStore();
    const before = store.getState();
    store.dispatch(startLiemGame());
    expect(store.getState().board).toBe(before.board);
    expect(store.getState().view).toBe(before.view);
  });
});

describe("newLiemGame", () => {
  it("resets the board (isPlaying false, gameId + 1) and opens the card", () => {
    const store = liemStore();
    store.dispatch(setColorPick("black"));
    store.dispatch(startLiemGame());
    const gameId = store.getState().board.gameId;
    store.dispatch(newLiemGame());
    const { board, match } = store.getState();
    expect(board.isPlaying).toBe(false);
    expect(board.gameId).toBe(gameId + 1);
    expect(board.humanColor).toBeNull();
    expect(board.engineHistory).toHaveLength(1);
    expect(match.setupOpen).toBe(true);
    expect(match.colorPick).toBe("black");
  });

  it("does nothing in two-player mode", () => {
    const store = twoPlayerStore();
    const before = store.getState();
    store.dispatch(newLiemGame());
    expect(store.getState().board).toBe(before.board);
    expect(store.getState().match).toBe(before.match);
  });
});

describe("picks across switches", () => {
  it("picks survive switches and new games", () => {
    // Picked on the card the page opens with, no tab click first.
    const store = createAppStore();
    store.dispatch(setColorPick("black"));
    store.dispatch(setStrength(1400));
    expect(store.getState().match).toMatchObject({ colorPick: "black", strength: 1400 });

    // Two players and back: the card reopens with the same picks.
    store.dispatch(switchMode("two-player"));
    store.dispatch(switchMode("liem"));
    expect(store.getState().match).toMatchObject({ setupOpen: true, colorPick: "black", strength: 1400 });

    // A game, then New game: still the same picks.
    store.dispatch(startLiemGame());
    expect(store.getState().board.humanColor).toBe("black");
    store.dispatch(newLiemGame());
    expect(store.getState().match).toMatchObject({ setupOpen: true, colorPick: "black", strength: 1400 });

    // The board's reset clears the game, not the picks.
    store.dispatch(startLiemGame());
    const gameId = store.getState().board.gameId;
    store.dispatch(reset());
    const { board, match } = store.getState();
    expect(board).toMatchObject({ gameId: gameId + 1, humanColor: null, isPlaying: false });
    expect(board.engineHistory).toHaveLength(1);
    expect(match).toMatchObject({ colorPick: "black", strength: 1400 });
  });
});
