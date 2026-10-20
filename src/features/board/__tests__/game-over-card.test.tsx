import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { createAppStore } from "app/store";
import { startLiemGame, switchMode } from "features/liem/liemActions";
import { setColorPick } from "features/liem/matchSlice";
import { clickSquare, resign, start } from "../BoardSlice";
import { GameOver } from "../components/GameOver";
import { gameOverNewGame } from "../gameOverView";

type Store = ReturnType<typeof createAppStore>;

const markup = (store: Store) =>
  renderToStaticMarkup(
    <Provider store={store}>
      <GameOver />
    </Provider>
  );

function playOn(store: Store, from: [number, number], to: [number, number]) {
  store.dispatch(clickSquare({ y: from[0], x: from[1] }));
  store.dispatch(clickSquare({ y: to[0], x: to[1] }));
}

function liemGame(color: "white" | "black" = "white"): Store {
  const store = createAppStore();
  store.dispatch(setColorPick(color));
  store.dispatch(startLiemGame());
  return store;
}

function twoPlayers(): Store {
  const store = createAppStore();
  store.dispatch(switchMode("two-player"));
  return store;
}

/** The position of each needle in `html`, in the order given; -1 when missing. */
const positions = (html: string, needles: string[]) => needles.map((n) => html.indexOf(n));

describe("game-over card", () => {
  it("card markup", () => {
    // Mid-game nothing renders, in either mode.
    const live = liemGame();
    expect(markup(live)).toBe("");
    playOn(live, [6, 4], [4, 4]); // 1.e4
    expect(markup(live)).toBe("");
    const two = twoPlayers();
    expect(markup(two)).toBe("");
    two.dispatch(start());
    expect(markup(two)).toBe("");

    // vs Liem, over after a move of yours: scrim, card, title, reason, then Review game and New game.
    live.dispatch(resign());
    const html = markup(live);
    const order = positions(html, [
      '<div class="game-over">',
      '<div class="game-over__card">',
      '<p class="game-over__title">Black wins</p>',
      '<p class="game-over__reason">Resigned</p>',
      '<div class="game-over__actions">',
      '<a class="button button--play" href="#/review">Review game</a>',
      '<button type="button" class="button">New game</button>',
    ]);
    expect(order.every((at) => at >= 0), html).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // The scrim wraps the card, which wraps everything else.
    expect(html.startsWith('<div class="game-over"><div class="game-over__card">')).toBe(true);
    expect(html.endsWith("</div></div></div>")).toBe(true);

    // Two players, over: New game only.
    two.dispatch(resign());
    const twoHtml = markup(two);
    expect(twoHtml).toContain('<p class="game-over__title">Black wins</p>');
    expect(twoHtml).toContain('<p class="game-over__reason">Resigned</p>');
    expect(twoHtml).not.toContain("Review game");
    expect(twoHtml).not.toContain("#/review");
    expect(twoHtml).toContain('<div class="game-over__actions"><button type="button" class="button">New game</button></div>');
  });

  it("new game from the card", () => {
    // vs Liem as Black: the same level and color, a new gameId, the clocks running.
    const liem = liemGame("black");
    const before = liem.getState();
    liem.dispatch(resign());
    liem.dispatch(gameOverNewGame("liem"));
    const after = liem.getState();
    expect(after.board.gameId).toBeGreaterThan(before.board.gameId);
    expect(after.board.humanColor).toBe("black");
    expect(after.board.isPlaying).toBe(true);
    expect(after.board.result).toBeNull();
    expect(after.match).toMatchObject({ mode: "liem", setupOpen: false, strength: before.match.strength });
    expect(after.view.flipped).toBe(true);
    expect(markup(liem)).toBe("");

    // Two players: a fresh board with the clocks stopped.
    const two = twoPlayers();
    two.dispatch(start());
    playOn(two, [6, 4], [4, 4]);
    two.dispatch(resign());
    const id = two.getState().board.gameId;
    two.dispatch(gameOverNewGame("two-player"));
    const board = two.getState().board;
    expect(board.gameId).toBe(id + 1);
    expect(board.isPlaying).toBe(false);
    expect(board.result).toBeNull();
    expect(board.history.length).toBe(1);
    expect(two.getState().match.mode).toBe("two-player");
    expect(markup(two)).toBe("");
  });
});
