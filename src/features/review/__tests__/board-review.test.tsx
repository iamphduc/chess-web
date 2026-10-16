import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Provider } from "react-redux";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { createAppStore } from "app/store";
import { Board } from "features/board/Board";
import { clickSquare, playOpponentMove } from "features/board/BoardSlice";
import { newLiemGame, startLiemGame, switchMode } from "features/liem/liemActions";
import { setColorPick } from "features/liem/matchSlice";
import { applyMove } from "game/engine/engine";
import { initialGameState } from "game/engine/game-state";
import { positionKey, uciToMove } from "game/opponent/position";
import type { Book, BookName } from "game/opponent/types";
import { backToGame, openReview } from "../reviewActions";
import { reviewBooks } from "../useGameReview";

/** His books: after 1.f3 he has played 1...e5 in 10 games, and nothing more. */
const AFTER_F3 = positionKey(applyMove(initialGameState(), uciToMove(initialGameState(), "f2f3")!));
const book = (name: BookName): Book => ({
  format: 1,
  player: "le-quang-liem",
  book: name,
  minGames: 1,
  games: 10,
  gamesBySource: { otb: 0, lichess: 0, chesscom: 10 },
  positions: { [AFTER_F3]: [["e7e5", 5, 1, 4, 0, 0, 10]] },
});

vi.mock("features/liem/liemOpponent", () => ({
  loadLiemBooks: () => Promise.resolve({ slow: book("slow"), online: book("online") }),
  loadLiemOpponent: () => Promise.reject(new Error("no engine in tests")),
}));

beforeAll(async () => {
  await reviewBooks.load();
});

type Store = ReturnType<typeof createAppStore>;

function render(store: Store): string {
  return renderToStaticMarkup(
    <Provider store={store}>
      <DndProvider backend={HTML5Backend}>
        <Board />
      </DndProvider>
    </Provider>
  );
}

/** The label of each button in the `.buttons` row. */
function buttonLabels(html: string): string[] {
  const at = html.indexOf('class="buttons"');
  if (at === -1) throw new Error("no .buttons");
  const row = html.slice(at, html.indexOf("</div>", at));
  return Array.from(row.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g), (m) => {
    const aria = m[1].match(/aria-label="([^"]*)"/)?.[1];
    return aria ?? m[2].replace(/<[^>]+>/g, "").trim();
  });
}

const sq = (name: string) => ({ y: 8 - Number(name[1]), x: "abcdefgh".indexOf(name[0]) });

function play(store: Store, ucis: readonly string[]): void {
  for (const uci of ucis) {
    const { board } = store.getState();
    const ply = board.engineHistory.length - 1;
    const state = board.engineHistory[ply];
    if (board.humanColor !== null && state.turn !== board.humanColor) {
      store.dispatch(playOpponentMove({ gameId: board.gameId, ply, move: uciToMove(state, uci)! }));
    } else {
      store.dispatch(clickSquare(sq(uci.slice(0, 2))));
      store.dispatch(clickSquare(sq(uci.slice(2, 4))));
    }
    if (store.getState().board.engineHistory.length !== ply + 2) throw new Error(`not played: ${uci}`);
  }
}

const FOOLS_MATE = ["f2f3", "e7e5", "g2g4", "d8h4"];

function liemGame(ucis: readonly string[]): Store {
  const store = createAppStore();
  store.dispatch(switchMode("liem"));
  store.dispatch(setColorPick("white"));
  store.dispatch(startLiemGame());
  play(store, ucis);
  return store;
}

describe("the Review game button", () => {
  it("shows after a finished vs-Liem game", () => {
    expect(buttonLabels(render(liemGame(FOOLS_MATE)))).toEqual(["Review game", "New game", "Flip board", "Sound"]);
  });

  it("never shows mid-game, with the card open, or in Two players", () => {
    expect(buttonLabels(render(liemGame(["f2f3", "e7e5"])))).not.toContain("Review game");

    const card = createAppStore();
    card.dispatch(switchMode("liem"));
    expect(buttonLabels(render(card))).not.toContain("Review game");

    const twoPlayers = createAppStore();
    play(twoPlayers, FOOLS_MATE);
    expect(buttonLabels(render(twoPlayers))).toEqual(["Play", "Reset", "Flip board", "Sound"]);
  });
});

describe("review layout", () => {
  it("renders the graph, review board, card, accuracy, move list and book note", () => {
    const store = liemGame(FOOLS_MATE);
    store.dispatch(openReview());
    const html = render(store);

    expect(html).toMatch(/data-review-state="analysing"/);
    expect(html).toMatch(/data-review-graph/);
    // The review board sits in .squares, in place of the game's squares.
    const squaresAt = html.search(/class="squares[ "]/);
    expect(squaresAt).toBeGreaterThan(-1);
    expect(html.slice(squaresAt)).toMatch(/^[^]*?class="review-board[ "]/);
    expect(html.match(/data-square="/g)).toHaveLength(64);
    expect(html).not.toMatch(/class="game-over"/);
    expect(html).toMatch(/aria-label="First move"/);
    expect(html).toMatch(/aria-label="Last move"/);
    expect(html).toMatch(/data-moment-status="waiting"/);
    expect(html).toMatch(/Analysing move \d+ of 2/);
    expect(html).toMatch(/class="accuracy-panel/);
    expect(html).toMatch(/class="move-list/);
    expect(html).toMatch(/Left his book at move 2/);
    expect(buttonLabels(html)).toEqual(["Back to game", "New game", "Flip board", "Sound"]);
    expect(html).not.toMatch(/Fallen Pieces/);
    expect(html).not.toMatch(/data-book-state=/);
  });

  it("Back to game restores the game layout", () => {
    const store = liemGame(FOOLS_MATE);
    const before = render(store);
    store.dispatch(openReview());
    expect(render(store)).not.toBe(before);
    store.dispatch(backToGame());
    expect(render(store)).toBe(before);
  });
});

describe("new game from the review", () => {
  it("clears the review and opens the setup card", () => {
    const store = liemGame(FOOLS_MATE);
    store.dispatch(openReview());
    const inReview = render(store);
    expect(inReview).toMatch(/data-review-state=/);
    expect(buttonLabels(inReview)).toContain("New game");
    store.dispatch(newLiemGame());
    const { review, match } = store.getState();
    expect(review.open).toBe(false);
    expect(review.gameId).toBeNull();
    expect(match.setupOpen).toBe(true);
    const html = render(store);
    expect(html).toMatch(/role="dialog" aria-label="Challenge Le Quang Liem"/);
    expect(html).not.toMatch(/data-review-state=/);
    expect(html).not.toMatch(/data-review-graph/);
  });
});
