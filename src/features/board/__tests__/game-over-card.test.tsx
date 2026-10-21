import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it, vi } from "vitest";

import { configureStore } from "@reduxjs/toolkit";

import { createAppStore } from "app/store";
import { startLiemGame, switchMode } from "features/liem/liemActions";
import { matchSlice, setColorPick } from "features/liem/matchSlice";
import { PieceType } from "../../../game/piece-type";
import { boardSlice, clickSquare, movePiece, promotePawn, resign, selectPiece, start, stop } from "../BoardSlice";
import { GameOver } from "../components/GameOver";
import { PiecePromoted } from "../components/Promotion";
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

/** Freezes `Date.now()` at `ms`; React's scheduler keeps its real timers. */
function at(ms: number) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(ms);
}

/** The card's `data-entrance`, or null when no card renders. */
const entranceOf = (html: string) => html.match(/<div class="game-over" data-entrance="(\w+)">/)?.[1] ?? null;

/** Two players, Play pressed, 1.h4 g5 2.hxg5 h6 3.gxh6 Nf6 4.h7 Rg8 5.hxg8 with the piece not picked yet. */
function pickingPromotion(): Store {
  const { reducer } = boardSlice;
  type BoardState = ReturnType<typeof reducer>;
  const move = (s: BoardState, pieceType: PieceType, from: [number, number], to: [number, number]) =>
    reducer(reducer(s, selectPiece({ pieceType, y: from[0], x: from[1] })), movePiece({ to }));
  let s = reducer(reducer(undefined, { type: "@@INIT" }), start());
  s = move(s, PieceType.WhitePawnH, [6, 7], [4, 7]);
  s = move(s, PieceType.BlackPawnG, [1, 6], [3, 6]);
  s = move(s, PieceType.WhitePawnH, [4, 7], [3, 6]);
  s = move(s, PieceType.BlackPawnH, [1, 7], [2, 7]);
  s = move(s, PieceType.WhitePawnH, [3, 6], [2, 7]);
  s = move(s, PieceType.BlackKingKnight, [0, 6], [2, 5]);
  s = move(s, PieceType.WhitePawnH, [2, 7], [1, 7]);
  s = move(s, PieceType.BlackKingRook, [0, 7], [0, 6]);
  s = move(s, PieceType.WhitePawnH, [1, 7], [0, 6]);
  const match = { ...matchSlice.reducer(undefined, { type: "@@INIT" }), mode: "two-player" as const, setupOpen: false };
  return configureStore({
    reducer: { board: reducer, match: matchSlice.reducer },
    preloadedState: { board: s, match },
  }) as unknown as Store;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

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
      '<div class="game-over" data-entrance="animate">',
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
    expect(html.startsWith('<div class="game-over" data-entrance="animate"><div class="game-over__card">')).toBe(true);
    expect(html.endsWith("</div></div></div>")).toBe(true);

    // Two players, over: New game only.
    two.dispatch(resign());
    const twoHtml = markup(two);
    expect(twoHtml).toContain('<p class="game-over__title">Black wins</p>');
    expect(twoHtml).toContain('<p class="game-over__reason">Resigned</p>');
    expect(entranceOf(twoHtml)).toBe("animate");
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

  it("reduced motion renders the card at once", () => {
    const asked: string[] = [];
    vi.stubGlobal("window", {
      matchMedia: (query: string) => {
        asked.push(query);
        return { matches: query === "(prefers-reduced-motion: reduce)", addEventListener() {}, removeEventListener() {} };
      },
    });
    const live = liemGame();
    live.dispatch(resign());
    expect(entranceOf(markup(live))).toBe("instant");
    expect(asked).toContain("(prefers-reduced-motion: reduce)");

    // The same end with no reduced motion asked for would have animated.
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    });
    const other = liemGame();
    other.dispatch(resign());
    expect(entranceOf(markup(other))).toBe("animate");
  });

  it("new game during the pause cancels the entrance", () => {
    at(100_000);
    const liem = liemGame();
    liem.dispatch(resign());
    expect(entranceOf(markup(liem))).toBe("animate");

    // New game 100 ms after the end, inside the 300 ms pause: no card, now or later.
    at(100_100);
    liem.dispatch(gameOverNewGame("liem"));
    expect(markup(liem)).toBe("");
    at(100_600);
    expect(markup(liem)).toBe("");

    // The next game's end gets its own entrance, even soon after the last one.
    liem.dispatch(resign());
    expect(entranceOf(markup(liem))).toBe("animate");
  });

  it("plays once: a later mount for the same end shows the card at once", () => {
    at(200_000);
    const two = twoPlayers();
    two.dispatch(start());
    two.dispatch(resign());
    expect(entranceOf(markup(two))).toBe("animate");
    // StrictMode's second render, a moment later, still animates.
    at(200_010);
    expect(entranceOf(markup(two))).toBe("animate");
    // Back from the review: the same end mounts again and shows at once.
    at(201_000);
    expect(entranceOf(markup(two))).toBe("instant");
  });

  it("the pause starts when the card is due, after a pending promotion pick", () => {
    at(300_000);
    const store = pickingPromotion();
    store.dispatch(stop()); // White's flag falls with the picker open
    expect(markup(store)).toBe("");
    // The pick comes 5 s later; only then is the card due, and it animates.
    at(305_000);
    store.dispatch(promotePawn({ piecePromoted: PiecePromoted.Queen }));
    expect(entranceOf(markup(store))).toBe("animate");
  });
});
