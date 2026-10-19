import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Provider } from "react-redux";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { createAppStore } from "app/store";
import { Board } from "features/board/Board";
import { clickSquare, playOpponentMove, stop } from "features/board/BoardSlice";
import { GameOverType } from "features/board/components/GameOver";
import { replayLiemGame, startLiemGame, switchMode } from "features/liem/liemActions";
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

/** The label of each control in the Moves card's foot (the game layout). */
function footLabels(html: string): string[] {
  const at = html.search(/class="card [^"]*moves-card/);
  if (at === -1) throw new Error("no .moves-card");
  const footAt = html.indexOf('class="card__foot"', at);
  if (footAt === -1) throw new Error("no .card__foot");
  const foot = html.slice(footAt, html.indexOf("</div>", footAt));
  return Array.from(foot.matchAll(/<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/g), (m) => {
    const aria = m[2].match(/aria-label="([^"]*)"/)?.[1];
    return aria ?? m[3].replace(/<[^>]+>/g, "").trim();
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

describe("the Review game link", () => {
  it("shows after a finished vs-Liem game", () => {
    const html = render(liemGame(FOOLS_MATE));
    expect(footLabels(html)).toEqual(["Review game", "New game", "Flip board", "Sound"]);
    // A link: the route opens the review.
    expect(html).toMatch(/<a class="button button--play" href="#\/review">Review game<\/a>/);
  });

  it("never shows mid-game, before a game, or in Two players", () => {
    const mid = render(liemGame(["f2f3", "e7e5"]));
    expect(footLabels(mid)).toEqual(["New game", "Flip board", "Sound"]);
    expect(mid).not.toMatch(/href="#\/review"/);

    // Before a game (the home state).
    expect(render(createAppStore())).not.toMatch(/href="#\/review"/);

    const twoPlayers = createAppStore();
    twoPlayers.dispatch(switchMode("two-player"));
    play(twoPlayers, FOOLS_MATE);
    const two = render(twoPlayers);
    expect(footLabels(two)).toEqual(["Play", "New game", "Flip board", "Sound"]);
    expect(two).not.toMatch(/href="#\/review"/);
  });

  it("a game over with no move of yours has no link", () => {
    // As Black, he moves first; with no move of yours there is nothing to review.
    const store = createAppStore();
    store.dispatch(setColorPick("black"));
    store.dispatch(startLiemGame());
    store.dispatch(stop());
    expect(store.getState().board.gameOver).not.toBe(GameOverType.Continue);
    expect(render(store)).not.toMatch(/href="#\/review"/);
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
  it("clears the review and replays the level", () => {
    const store = liemGame(FOOLS_MATE);
    const { gameId } = store.getState().board;
    store.dispatch(openReview());
    const inReview = render(store);
    expect(inReview).toMatch(/data-review-state=/);
    expect(buttonLabels(inReview)).toContain("New game");
    store.dispatch(replayLiemGame());
    const { review, match, board } = store.getState();
    expect(review.open).toBe(false);
    expect(review.gameId).toBeNull();
    expect(match.setupOpen).toBe(false);
    expect(board.gameId).toBeGreaterThan(gameId);
    expect(board.humanColor).toBe("white");
    const html = render(store);
    expect(html).not.toMatch(/data-review-state=/);
    expect(html).not.toMatch(/data-review-graph/);
    expect(html).not.toMatch(/role="dialog"/);
    expect(footLabels(html)).toEqual(["New game", "Flip board", "Sound"]);
  });
});
