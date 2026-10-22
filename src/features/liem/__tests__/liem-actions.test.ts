import { describe, expect, it, vi } from "vitest";

import { createAppStore } from "app/store";
import { clickSquare, playOpponentMove, reset } from "features/board/BoardSlice";
import { setFlipped } from "features/board/viewSlice";
import { openReview } from "features/review/reviewActions";
import type { MoveChoice } from "game/opponent/opponent";
import { uciToMove } from "game/opponent/position";
import * as liemActions from "../liemActions";
import { goHome, replayLiemGame, startLiemGame, switchMode } from "../liemActions";
import { setColorPick, setStrength } from "../matchSlice";
import type { LiemOpponent } from "../opponentController";
import { createLiemController, syncLiemTurn } from "../useLiemOpponent";

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
    store.dispatch(goHome());
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

describe("goHome ends the game", () => {
  it("exports no newLiemGame; goHome ends the game", () => {
    expect(liemActions).not.toHaveProperty("newLiemGame");
    const store = liemStore();
    store.dispatch(setColorPick("black"));
    store.dispatch(startLiemGame());
    const gameId = store.getState().board.gameId;
    store.dispatch(goHome());
    const { board, match } = store.getState();
    expect(board.isPlaying).toBe(false);
    expect(board.gameId).toBe(gameId + 1);
    expect(board.humanColor).toBeNull();
    expect(board.engineHistory).toHaveLength(1);
    expect(match.setupOpen).toBe(true);
    expect(match.colorPick).toBe("black");
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
    store.dispatch(goHome());
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

const sq = (name: string) => ({ y: 8 - Number(name[1]), x: "abcdefgh".indexOf(name[0]) });

/** Plays UCI moves: the human's by clicking squares, his through `playOpponentMove`. */
function play(store: Store, ucis: readonly string[]): void {
  for (const uci of ucis) {
    const { board } = store.getState();
    const ply = board.engineHistory.length - 1;
    const state = board.engineHistory[ply];
    if (board.humanColor !== null && state.turn !== board.humanColor) {
      const move = uciToMove(state, uci);
      if (move === null) throw new Error(`illegal ${uci}`);
      store.dispatch(playOpponentMove({ gameId: board.gameId, ply, move }));
    } else {
      store.dispatch(clickSquare(sq(uci.slice(0, 2))));
      store.dispatch(clickSquare(sq(uci.slice(2, 4))));
    }
    if (store.getState().board.engineHistory.length !== ply + 2) throw new Error(`not played: ${uci}`);
  }
}

describe("goHome", () => {
  it("ends a vs-Liem game and reopens the card with the picks kept", () => {
    const store = liemStore();
    store.dispatch(setStrength(1900));
    store.dispatch(setColorPick("black"));
    store.dispatch(startLiemGame());
    const gameId = store.getState().board.gameId;
    store.dispatch(goHome());
    const { board, match, review } = store.getState();
    expect(board).toMatchObject({ gameId: gameId + 1, isPlaying: false, humanColor: null });
    expect(match).toMatchObject({ mode: "liem", setupOpen: true, strength: 1900, colorPick: "black" });
    expect(review.open).toBe(false);
  });

  it("from two players returns to vs Liem with the card open", () => {
    const store = twoPlayerStore();
    playE4(store);
    store.dispatch(goHome());
    const { board, match } = store.getState();
    expect(match).toMatchObject({ mode: "liem", setupOpen: true });
    expect(board.engineHistory).toHaveLength(1);
  });
});

describe("replayLiemGame", () => {
  it("replay keeps level and color", () => {
    // White at Hard: the same level and color, a new game with the clocks running.
    const white = liemStore();
    white.dispatch(setStrength(1900));
    white.dispatch(startLiemGame());
    playE4(white);
    const gameId = white.getState().board.gameId;
    white.dispatch(replayLiemGame());
    let { board, match, view } = white.getState();
    expect(board.gameId).toBeGreaterThan(gameId);
    expect(board.isPlaying).toBe(true);
    expect(board.humanColor).toBe("white");
    expect(board.engineHistory).toHaveLength(1);
    expect(view.flipped).toBe(false);
    expect(match).toMatchObject({ mode: "liem", setupOpen: false, strength: 1900, colorPick: "white" });

    // Black: the board is flipped for the new game.
    const black = liemStore();
    black.dispatch(setColorPick("black"));
    black.dispatch(startLiemGame());
    black.dispatch(setFlipped(false));
    black.dispatch(replayLiemGame());
    ({ board, view } = black.getState());
    expect(board.humanColor).toBe("black");
    expect(view.flipped).toBe(true);

    // Random draws again through the injected random.
    const random = liemStore();
    random.dispatch(setColorPick("random"));
    random.dispatch(startLiemGame(() => 0.1));
    expect(random.getState().board.humanColor).toBe("white");
    const draw = vi.fn(() => 0.9);
    random.dispatch(replayLiemGame(draw));
    expect(draw).toHaveBeenCalledTimes(1);
    expect(random.getState().board.humanColor).toBe("black");
    expect(random.getState().view.flipped).toBe(true);
    expect(random.getState().match.colorPick).toBe("random");
  });

  it("replay from a finished game clears the review", () => {
    const store = liemStore();
    store.dispatch(startLiemGame());
    play(store, ["f2f3", "e7e5", "g2g4", "d8h4"]);
    store.dispatch(openReview());
    expect(store.getState().review.open).toBe(true);
    store.dispatch(replayLiemGame());
    const { board, review } = store.getState();
    expect(review.open).toBe(false);
    expect(review.gameId).toBeNull();
    expect(review.evals).toEqual([]);
    expect(board.isPlaying).toBe(true);
    expect(board.gameOver).toBe("Continue");
  });

  it("does nothing on home or in two-player mode", () => {
    const home = liemStore();
    const before = home.getState();
    home.dispatch(replayLiemGame());
    expect(home.getState()).toBe(before);

    const two = twoPlayerStore();
    playE4(two);
    const twoBefore = two.getState();
    two.dispatch(replayLiemGame());
    expect(two.getState()).toBe(twoBefore);
  });

  it("replay drops a stale answer", async () => {
    // As Black he moves first. His answer for the old game lands after New game.
    const asks: ((choice: MoveChoice) => void)[] = [];
    const opponent: LiemOpponent = {
      chooseMove: () => new Promise<MoveChoice>((resolve) => asks.push(resolve)),
      analyse: () => Promise.reject(new Error("unused")),
      newGame: () => undefined,
      dispose: () => undefined,
    };
    const store = liemStore();
    const controller = createLiemController(store.dispatch, () => Promise.resolve(opponent));
    const sync = () => syncLiemTurn(controller, store.getState().board, store.getState().match);
    const flush = async () => {
      for (let i = 0; i < 50; i++) await Promise.resolve();
    };
    const choice = (uci: string): MoveChoice => {
      const move = uciToMove(store.getState().board.engineHistory[0], uci);
      if (move === null) throw new Error(`illegal ${uci}`);
      return { move, uci, source: "engine", lookup: null };
    };

    store.dispatch(setColorPick("black"));
    store.dispatch(startLiemGame());
    sync();
    await flush();
    expect(asks).toHaveLength(1);

    store.dispatch(replayLiemGame());
    sync();
    await flush();
    const gameId = store.getState().board.gameId;

    asks[0](choice("e2e4"));
    await flush();
    expect(store.getState().board.engineHistory).toHaveLength(1);
    expect(store.getState().match.lastChoice).toBeNull();

    // Also a late answer sent straight to the board with the old game's id.
    store.dispatch(playOpponentMove({ gameId: gameId - 1, ply: 0, move: choice("e2e4").move }));
    expect(store.getState().board.engineHistory).toHaveLength(1);

    expect(asks).toHaveLength(2);
    asks[1](choice("d2d4"));
    await flush();
    const { board, match } = store.getState();
    expect(board.engineHistory).toHaveLength(2);
    expect(match.lastChoice).toMatchObject({ gameId, ply: 0, uci: "d2d4" });
    controller.dispose();
  });
});
