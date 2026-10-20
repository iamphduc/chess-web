import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Provider } from "react-redux";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createAppStore } from "app/store";
import { Board } from "features/board/Board";
import { clickSquare, playOpponentMove, stop } from "features/board/BoardSlice";
import { GameOverType } from "features/board/gameOverType";
import { replayLiemGame, startLiemGame, switchMode } from "features/liem/liemActions";
import { setColorPick } from "features/liem/matchSlice";
import { applyMove } from "game/engine/engine";
import { initialGameState } from "game/engine/game-state";
import { positionKey, uciToMove } from "game/opponent/position";
import type { Book, BookName } from "game/opponent/types";
import { backToGame, openReview } from "../reviewActions";
import { playAgain } from "../reviewLayout";
import { sheetClosed } from "../reviewSlice";
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
    expect(footLabels(mid)).toEqual(["New game", "Resign", "Flip board", "Sound"]);
    expect(mid).not.toMatch(/href="#\/review"/);

    // Before a game (the home state).
    expect(render(createAppStore())).not.toMatch(/href="#\/review"/);

    const twoPlayers = createAppStore();
    twoPlayers.dispatch(switchMode("two-player"));
    play(twoPlayers, FOOLS_MATE);
    const two = render(twoPlayers);
    expect(footLabels(two)).toEqual(["New game", "Flip board", "Sound"]);
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
  it("renders the graph, review board, card, accuracy line, move list and left-book line", () => {
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
    expect(html).toMatch(/class="review-summary__accuracy/);
    expect(html).not.toMatch(/accuracy-panel/);
    expect(html).toMatch(/class="move-list/);
    expect(html).toMatch(/Left his book at move 2/);
    expect(footLabels(html)).toEqual(["Play again", "Flip board", "Sound"]);
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

/** The page as a desktop (768 px and up, and 1200 px up) or a phone sees it. */
function onScreen(wide: boolean) {
  vi.stubGlobal("window", {
    matchMedia: () => ({ matches: wide, addEventListener: () => {}, removeEventListener: () => {} }),
  });
}

/** Where each of `marks` first appears in `html`, after `from`. */
function order(html: string, from: number, marks: readonly RegExp[]): number[] {
  return marks.map((m) => {
    const at = html.slice(from).search(m);
    return at === -1 ? -1 : at + from;
  });
}

const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;

function reviewed(): Store {
  const store = liemGame(FOOLS_MATE);
  store.dispatch(openReview());
  return store;
}

describe("review screen", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("review sidebar order", () => {
    onScreen(true);
    const html = render(reviewed());
    const sidebar = sidebarOf(html);
    // Exactly three cards: key moment, summary (graph and accuracy), Moves.
    const cards = cardsIn(sidebar);
    expect(cards.map((c) => c.kind)).toEqual(["moment", "summary", "moves"]);
    // The summary card holds the graph, then the accuracy line.
    expect(cards[1].html).toMatch(/data-review-graph=[\s\S]*review-summary__accuracy/);
    // The Moves card's list starts with the left-book line.
    expect(cards[2].html).toMatch(/class="move-list scoresheet"[^>]*>\s*<[^>]*data-left-book=/);
    // No accuracy card and no left-book card.
    expect(html).not.toMatch(/accuracy-panel|liem-note/);
    expect(count(html, /data-left-book=/g)).toBe(1);
    // The graph shows once, in the sidebar: no full-width strip above the board.
    expect(count(html, /data-review-graph=/g)).toBe(1);
    expect(html).not.toMatch(/review-top/);
    expect(html.search(/data-review-graph=/)).toBeGreaterThan(html.search(/class="board"/));
    // No phone sheet on desktop.
    expect(html).not.toMatch(/review-sheet/);
  });

  it("play again replays the level", () => {
    const store = reviewed();
    const html = render(store);
    const bar = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
    expect(bar).toMatch(/class="top-bar"/);
    expect(bar).toMatch(/<a class="button top-bar__home" href="#\/">← Home<\/a>/);
    // ← Home and the title only: Play again lives in the foot.
    expect(bar).toBe(
      '<header class="top-bar"><a class="button top-bar__home" href="#/">← Home</a>' +
        '<span class="top-bar__title">Review · vs Harder</span>'
    );
    expect(html).not.toMatch(/top-bar__action/);
    // One Play again, in the foot; nothing else plays again.
    expect(html.match(/>Play again</g)).toHaveLength(1);
    expect(html).not.toMatch(/>New game</);

    const { gameId } = store.getState().board;
    store.dispatch(playAgain());
    const { review, match, board } = store.getState();
    expect(review.open).toBe(false);
    expect(review.gameId).toBeNull();
    expect(match.setupOpen).toBe(false);
    expect(match.strength).toBe(2100);
    expect(board.gameId).toBeGreaterThan(gameId);
    expect(board.humanColor).toBe("white");
    const after = render(store);
    // The play screen's top bar is unchanged: no action on the right.
    const playBar = after.slice(after.indexOf("<header"), after.indexOf("</header>") + 9);
    expect(playBar).toMatch(
      /^<header class="top-bar"><a class="button top-bar__home" href="#\/">← Home<\/a><span class="top-bar__title">vs Harder · you play White<\/span><\/header>$/
    );
    expect(after).not.toMatch(/data-review-state=/);
    expect(after).not.toMatch(/data-review-graph/);
    expect(footLabels(after)).toEqual(["New game", "Resign", "Flip board", "Sound"]);
  });

  it("moves card foot in the review", () => {
    const html = render(reviewed());
    expect(footLabels(html)).toEqual(["Play again", "Flip board", "Sound"]);
    // A button with the play style; no link back to the game (the browser's Back still is one).
    expect(html).toMatch(/<button type="button" class="button button--play">Play again<\/button>/);
    expect(html).not.toMatch(/href="#\/play"/);
    expect(html).not.toMatch(/Back to game/);
    // The move list sits in the flush Moves card, as a scoresheet.
    const cardAt = html.search(/class="card card--flush[^"]*moves-card/);
    expect(cardAt).toBeGreaterThan(-1);
    expect(html.slice(cardAt)).toMatch(/^[^]*?class="move-list scoresheet"/);
  });

  it("phone sheet starts with the key moment", () => {
    onScreen(false);
    const store = reviewed();
    expect(store.getState().review.sheetOpen).toBe(true);
    const html = render(store);
    const sheetAt = html.search(/<section class="review-sheet/);
    expect(sheetAt).toBeGreaterThan(-1);
    const sheet = html.slice(sheetAt);
    expect(cardsIn(sheet).map((c) => c.kind)).toEqual(["moment", "summary"]);
    expect(sheet).toMatch(/data-review-graph=[\s\S]*review-summary__accuracy/);
    expect(count(html, /data-review-graph=/g)).toBe(1);
    // The sidebar holds only the Moves card while the sheet is up.
    expect(cardsIn(sidebarOf(html)).map((c) => c.kind)).toEqual(["moves"]);

    // Closed, the summary goes to the top of the sidebar, still once.
    store.dispatch(sheetClosed());
    const closed = render(store);
    expect(count(closed, /data-review-graph=/g)).toBe(1);
    expect(cardsIn(sidebarOf(closed)).map((c) => c.kind)).toEqual(["summary", "moves"]);
    expect(cardsIn(closed.slice(closed.search(/<section class="review-sheet/))).map((c) => c.kind)).toEqual([
      "moment",
    ]);
  });
});

/** The sidebar's markup: from `.sidebar` to the phone sheet, or to the end. */
function sidebarOf(html: string): string {
  const at = html.search(/class="sidebar[ "]/);
  expect(at, "a .sidebar").toBeGreaterThan(-1);
  const sheet = html.indexOf('<section class="review-sheet', at);
  return html.slice(at, sheet === -1 ? undefined : sheet);
}

/** Each `.card` in `html`, in order, with what kind of card it is. */
function cardsIn(html: string): { kind: string; html: string }[] {
  const starts = Array.from(html.matchAll(/<\w+ class="(?:[^"]* )?card(?: [^"]*)?"/g), (m) => m.index!);
  return starts.map((at, i) => {
    const part = html.slice(at, starts[i + 1]);
    const kind = /data-moment-status=/.test(part.slice(0, part.indexOf(">")))
      ? "moment"
      : /data-review-graph=/.test(part.slice(0, part.indexOf(">")))
        ? "summary"
        : /moves-card/.test(part.slice(0, part.indexOf(">")))
          ? "moves"
          : part.slice(0, part.indexOf(">") + 1);
    return { kind, html: part };
  });
}
