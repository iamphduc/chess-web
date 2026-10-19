import { afterEach, describe, expect, it, vi } from "vitest";

import { createAppStore } from "app/store";
import { clickSquare, playOpponentMove, stop } from "features/board/BoardSlice";
import { GameOverType } from "features/board/components/GameOver";
import { startLiemGame, switchMode } from "features/liem/liemActions";
import { setColorPick, setStrength } from "features/liem/matchSlice";
import { openReview } from "features/review/reviewActions";
import { evalReceived } from "features/review/reviewSlice";
import { uciToMove } from "game/opponent/position";
import { arriveAt, followHash, goTo, hashFor, parseHash, type Screen } from "../route";

type Store = ReturnType<typeof createAppStore>;

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

const FOOLS_MATE = ["f2f3", "e7e5", "g2g4", "d8h4"];

/** A vs-Liem game started as `color`, with `ucis` played. */
function liemGame(color: "white" | "black", ucis: readonly string[] = []): Store {
  const store = createAppStore();
  store.dispatch(setColorPick(color));
  store.dispatch(startLiemGame());
  play(store, ucis);
  return store;
}

const arrive = (store: Store, screen: Screen | null): Screen => store.dispatch(arriveAt(screen));

/** The home state: mode liem, the card open, the review closed. */
function expectHomeState(store: Store) {
  const { match, review } = store.getState();
  expect(match.mode).toBe("liem");
  expect(match.setupOpen).toBe(true);
  expect(review.open).toBe(false);
}

describe("parseHash and hashFor", () => {
  it("parses hashes exactly", () => {
    expect(parseHash("")).toBe("home");
    expect(parseHash("#")).toBe("home");
    expect(parseHash("#/")).toBe("home");
    expect(parseHash("#/play")).toBe("play");
    expect(parseHash("#/two-players")).toBe("two-players");
    expect(parseHash("#/review")).toBe("review");
    for (const bad of ["#/play/", "#/PLAY", "#play", "#/x", "#//", "#/review?x", " #/play"]) {
      expect(parseHash(bad)).toBeNull();
    }
    const screens: Screen[] = ["home", "play", "two-players", "review"];
    for (const screen of screens) expect(parseHash(hashFor(screen))).toBe(screen);
    expect(hashFor("home")).toBe("#/");
  });
});

describe("arriveAt", () => {
  it("unknown hash goes home", () => {
    const store = createAppStore();
    const gameId = store.getState().board.gameId;
    expect(arrive(store, parseHash("#/x"))).toBe("home");
    expectHomeState(store);
    expect(store.getState().board.gameId).toBe(gameId);

    // An unknown hash mid-game ends it, like any way home.
    const playing = liemGame("white", ["e2e4"]);
    const id = playing.getState().board.gameId;
    expect(arrive(playing, null)).toBe("home");
    expectHomeState(playing);
    expect(playing.getState().board.gameId).toBe(id + 1);
  });

  it("play with no game goes home", () => {
    const store = createAppStore();
    const gameId = store.getState().board.gameId;
    expect(arrive(store, "play")).toBe("home");
    expectHomeState(store);
    expect(store.getState().board.gameId).toBe(gameId);
  });

  it("play keeps a game in progress", () => {
    const store = liemGame("white", ["e2e4"]);
    const board = store.getState().board;
    expect(arrive(store, "play")).toBe("play");
    expect(store.getState().board).toBe(board);
  });

  it("review needs a finished game", () => {
    const fresh = createAppStore();
    expect(arrive(fresh, "review")).toBe("home");
    expectHomeState(fresh);

    const running = liemGame("white", ["e2e4"]);
    const board = running.getState().board;
    expect(arrive(running, "review")).toBe("play");
    expect(running.getState().review.open).toBe(false);
    expect(running.getState().board).toBe(board);

    const over = liemGame("white", FOOLS_MATE);
    expect(arrive(over, "review")).toBe("review");
    const { review, board: overBoard } = over.getState();
    expect(review.open).toBe(true);
    expect(review.gameId).toBe(overBoard.gameId);
    expect(review.status).toBe("analysing");
  });

  it("review of a game over with no move of yours shows play", () => {
    // As Black, he plays 1.f3 and you lose on time before your first move.
    const store = liemGame("black", ["f2f3"]);
    store.dispatch(stop());
    expect(store.getState().board.gameOver).toBe(GameOverType.Win);
    expect(arrive(store, "review")).toBe("play");
    expect(store.getState().review.open).toBe(false);
  });

  it("back and forward between review and play", () => {
    const store = liemGame("white", FOOLS_MATE);
    expect(arrive(store, "review")).toBe("review");
    const gameId = store.getState().board.gameId;
    const evaluated = { score: { cp: 20 }, best: "e2e4" } as const;
    store.dispatch(evalReceived({ gameId, index: 0, eval: evaluated }));

    // Back: the review closes, its evals stay, the finished game shows.
    expect(arrive(store, "play")).toBe("play");
    let review = store.getState().review;
    expect(review.open).toBe(false);
    expect(review.evals[0]).toEqual(evaluated);
    expect(review.status).toBe("analysing");
    expect(store.getState().board.gameId).toBe(gameId);

    // Forward: the same review reopens and goes on with its pass.
    expect(arrive(store, "review")).toBe("review");
    review = store.getState().review;
    expect(review.open).toBe(true);
    expect(review.status).toBe("analysing");
    expect(review.evals[0]).toEqual(evaluated);
    expect(review.evals.slice(1).every((e) => e === null)).toBe(true);
  });

  it("home ends the game and keeps the picks", () => {
    for (const ucis of [["f2f3"], ["f2f3", "e7e5", "g2g4", "d8h4"]]) {
      const store = createAppStore();
      store.dispatch(setStrength(1900));
      store.dispatch(setColorPick("black"));
      store.dispatch(startLiemGame());
      play(store, ucis);
      const over = ucis.length === 4;
      if (over) {
        store.dispatch(openReview());
        expect(store.getState().review.open).toBe(true);
      }
      const gameId = store.getState().board.gameId;
      expect(arrive(store, "home")).toBe("home");
      const { board, match } = store.getState();
      expectHomeState(store);
      expect(board.gameId).toBe(gameId + 1);
      expect(board.isPlaying).toBe(false);
      expect(board.humanColor).toBeNull();
      expect(match.strength).toBe(1900);
      expect(match.colorPick).toBe("black");
    }
  });

  it("home is idempotent", () => {
    const store = createAppStore();
    store.dispatch(setStrength(1400));
    const before = store.getState();
    expect(arrive(store, "home")).toBe("home");
    expect(arrive(store, "home")).toBe("home");
    const after = store.getState();
    expect(after.board.gameId).toBe(before.board.gameId);
    expect(after.board).toBe(before.board);
    expect(after.match).toBe(before.match);

    // After a game ends by going home, a second arrival changes nothing more.
    const played = liemGame("white", ["e2e4"]);
    arrive(played, "home");
    const id = played.getState().board.gameId;
    arrive(played, "home");
    expect(played.getState().board.gameId).toBe(id);
  });

  it("two players and back", () => {
    const store = createAppStore();
    store.dispatch(setStrength(2300));
    store.dispatch(setColorPick("random"));
    const gameId = store.getState().board.gameId;

    expect(arrive(store, "two-players")).toBe("two-players");
    let { board, match } = store.getState();
    expect(match.mode).toBe("two-player");
    expect(board.gameId).toBe(gameId + 1);
    expect(board.engineHistory).toHaveLength(1);

    store.dispatch(clickSquare(sq("e2")));
    store.dispatch(clickSquare(sq("e4")));
    expect(store.getState().board.engineHistory).toHaveLength(2);
    expect(arrive(store, "two-players")).toBe("two-players");
    expect(store.getState().board.engineHistory).toHaveLength(2);

    expect(arrive(store, "home")).toBe("home");
    ({ board, match } = store.getState());
    expectHomeState(store);
    expect(board.engineHistory).toHaveLength(1);
    expect(match.strength).toBe(2300);
    expect(match.colorPick).toBe("random");
  });

  it("two players from a vs-Liem game gives a fresh board", () => {
    const store = liemGame("white", ["e2e4"]);
    expect(arrive(store, "two-players")).toBe("two-players");
    const { board, match } = store.getState();
    expect(match.mode).toBe("two-player");
    expect(board.engineHistory).toHaveLength(1);
    expect(board.humanColor).toBeNull();
  });

  it("play is vs Liem only", () => {
    const store = createAppStore();
    store.dispatch(switchMode("two-player"));
    play(store, ["e2e4"]);
    expect(arrive(store, "play")).toBe("home");
    expectHomeState(store);
    expect(store.getState().board.engineHistory).toHaveLength(1);

    const review = createAppStore();
    review.dispatch(switchMode("two-player"));
    expect(arrive(review, "review")).toBe("home");
    expectHomeState(review);
  });
});

describe("goTo", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("goTo without window", () => {
    expect(typeof window).toBe("undefined");
    expect(() => goTo("play")).not.toThrow();
  });

  it("goTo sets the hash", () => {
    const location = { hash: "" };
    vi.stubGlobal("window", { location });
    goTo("review");
    expect(location.hash).toBe("#/review");
    goTo("home");
    expect(location.hash).toBe("#/");
  });
});

describe("followHash", () => {
  function fakeWindow(hash: string) {
    const replaced: string[] = [];
    const win = {
      location: { hash },
      history: {
        state: null,
        replaceState: (_state: unknown, _title: string, url: string) => {
          replaced.push(url);
          win.location.hash = url;
        },
      },
    };
    return { win, replaced };
  }

  it("rewrites the hash to the screen shown, with no history entry", () => {
    const store = createAppStore();
    const { win, replaced } = fakeWindow("#/play");
    expect(followHash(store.dispatch, win)).toBe("home");
    expect(replaced).toEqual(["#/"]);
    expect(win.location.hash).toBe("#/");
  });

  it("leaves a matching hash alone", () => {
    const store = liemGame("white", ["e2e4"]);
    const { win, replaced } = fakeWindow("#/play");
    expect(followHash(store.dispatch, win)).toBe("play");
    expect(replaced).toEqual([]);

    const home = fakeWindow("#/");
    expect(followHash(createAppStore().dispatch, home.win)).toBe("home");
    expect(home.replaced).toEqual([]);
  });

  it("an empty hash shows home as #/", () => {
    const { win, replaced } = fakeWindow("");
    expect(followHash(createAppStore().dispatch, win)).toBe("home");
    expect(replaced).toEqual(["#/"]);
  });
});

/**
 * A browser's hash history: setting `location.hash` pushes an entry, and every
 * hash move but `replaceState` fires hashchange, which runs `followHash` as
 * useHashRoute does.
 */
function browserHistory(store: Store, hash: string) {
  const entries: { hash: string; state: unknown }[] = [{ hash, state: null }];
  let index = 0;
  const current = () => entries[index];
  const change = (from: string) => followHash(store.dispatch, win, from);
  const win = {
    location: {
      get hash() {
        return current().hash;
      },
      set hash(next: string) {
        const from = current().hash;
        if (next === from) return;
        entries.splice(index + 1);
        entries.push({ hash: next, state: null });
        index += 1;
        change(from);
      },
      replace(url: string) {
        const from = current().hash;
        entries[index] = { hash: url, state: null };
        if (url !== from) change(from);
      },
    },
    history: {
      get state() {
        return current().state;
      },
      replaceState(state: unknown, _unused: string, url: string) {
        entries[index] = { hash: url, state };
      },
      back() {
        if (index === 0) throw new Error("left the app");
        const from = current().hash;
        index -= 1;
        change(from);
      },
    },
  };
  followHash(store.dispatch, win); // the load
  return { win, hashes: () => entries.map((e) => e.hash), at: () => index };
}

describe("browser Back after Play again", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("one Back from the board after Play again goes home", async () => {
    const { playAgain } = await import("features/review/reviewLayout");
    // Home, then Play: #/play over #/.
    const store = createAppStore();
    const browser = browserHistory(store, "#/");
    vi.stubGlobal("window", browser.win);
    store.dispatch(setColorPick("white"));
    store.dispatch(startLiemGame());
    browser.win.location.hash = "#/play";
    play(store, FOOLS_MATE);

    // Review game (a link to #/review), then Play again.
    browser.win.location.hash = "#/review";
    expect(store.getState().review.open).toBe(true);
    store.dispatch(playAgain());
    expect(browser.win.location.hash).toBe("#/play");
    expect(store.getState().review.open).toBe(false);
    expect(store.getState().match.setupOpen).toBe(false);
    expect(store.getState().board.engineHistory).toHaveLength(1);

    // One Back leaves the board for home, as Back from #/play does.
    browser.win.history.back();
    expect(browser.win.location.hash).toBe("#/");
    expectHomeState(store);
  });

  it("Back to game, Review game again, then Play again: one Back still goes home", async () => {
    const { playAgain } = await import("features/review/reviewLayout");
    const store = createAppStore();
    const browser = browserHistory(store, "#/");
    vi.stubGlobal("window", browser.win);
    store.dispatch(startLiemGame());
    browser.win.location.hash = "#/play";
    play(store, FOOLS_MATE);
    browser.win.location.hash = "#/review";
    browser.win.history.back(); // the browser's Back to the game
    expect(browser.win.location.hash).toBe("#/play");
    browser.win.location.hash = "#/review"; // Review game again

    store.dispatch(playAgain());
    expect(browser.win.location.hash).toBe("#/play");
    browser.win.history.back();
    expect(browser.win.location.hash).toBe("#/");
    expectHomeState(store);
  });

  it("a review with no #/play under it is replaced by #/play, adding no entry", async () => {
    const { playAgain } = await import("features/review/reviewLayout");
    // A finished game reached at #/review straight from home (a typed hash).
    const store = liemGame("white", FOOLS_MATE);
    const browser = browserHistory(store, "#/");
    vi.stubGlobal("window", browser.win);
    // Home ended the game on load, so start and finish another, staying on #/.
    store.dispatch(startLiemGame());
    play(store, FOOLS_MATE);
    browser.win.location.hash = "#/review";
    expect(browser.hashes()).toEqual(["#/", "#/review"]);

    store.dispatch(playAgain());
    expect(browser.hashes()).toEqual(["#/", "#/play"]);
    expect(browser.at()).toBe(1);
  });
});
