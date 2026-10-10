import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Provider } from "react-redux";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { describe, expect, it, vi } from "vitest";

import { createAppStore } from "app/store";
import { LIEM } from "game/opponent/players";
import { uciToMove } from "game/opponent/position";
import type { MoveChoice } from "game/opponent/opponent";
import { newLiemGame, startLiemGame, switchMode } from "features/liem/liemActions";
import { setColorPick } from "features/liem/matchSlice";
import type { LiemOpponent } from "features/liem/opponentController";
import { createLiemController, liemGameId, syncLiemTurn } from "features/liem/useLiemOpponent";
import { Board } from "../Board";
import { avatarSrc } from "../components/avatar";
import { players } from "../../../game/players";

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

/** The whole `<div>` whose opening tag starts at `start` (divs only are counted). */
function outerDiv(html: string, start: number): string {
  const re = /<div\b|<\/div>/g;
  re.lastIndex = start;
  let depth = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[0] === "</div>" ? -1 : 1;
    if (depth === 0) return html.slice(start, m.index + m[0].length);
  }
  throw new Error("unbalanced markup");
}

/** The first `<div>` whose class list has `cls`. */
function divWithClass(html: string, cls: string): string {
  const m = new RegExp(`<div[^>]*class="(?:[^"]* )?${cls}(?: [^"]*)?"`).exec(html);
  if (!m) throw new Error(`no div.${cls}`);
  return outerDiv(html, m.index);
}

/** The text of each player card's name, in order. */
function playerNames(html: string): string[] {
  return Array.from(
    html.matchAll(/class="player__name">(?:<span class="player__title">[^<]*<\/span>)?([^<]*)/g),
    (m) => m[1].trim()
  );
}

/** The label of each button in the `.buttons` row. */
function buttonLabels(html: string): string[] {
  const row = divWithClass(html, "buttons");
  return Array.from(row.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g), (m) => {
    const aria = m[1].match(/aria-label="([^"]*)"/)?.[1];
    return aria ?? m[2].replace(/<[^>]+>/g, "").trim();
  });
}

/** Each `[data-color]` card in the sidebar, in order. */
function sidebarCards(html: string): { color: string; html: string }[] {
  const sidebar = divWithClass(html, "sidebar");
  return Array.from(sidebar.matchAll(/<div[^>]*data-color="(white|black)"/g), (m) => ({
    color: m[1],
    html: outerDiv(sidebar, m.index!),
  }));
}

function liemGameAs(color: "white" | "black"): Store {
  const store = createAppStore();
  store.dispatch(switchMode("liem"));
  store.dispatch(setColorPick(color));
  store.dispatch(startLiemGame());
  return store;
}

describe("board modes", () => {
  it("two-player layout unchanged", () => {
    const html = render(createAppStore());
    const board = divWithClass(html, "board");

    expect(board).toMatch(/role="tablist"/);
    expect(Array.from(board.matchAll(/role="tab"[^>]*>([^<]*)</g), (m) => m[1])).toEqual([
      "vs Liem",
      "Two players",
    ]);

    // The board's own two cards: black above the squares, white below.
    const squaresAt = board.indexOf('class="squares"');
    expect(squaresAt).toBeGreaterThan(-1);
    const [white, black] = players;
    expect(playerNames(board.slice(0, squaresAt))).toEqual([black.name]);
    expect(playerNames(board.slice(squaresAt))).toEqual([white.name]);

    expect(buttonLabels(html)).toEqual(["Play", "Reset", "Flip board", "Sound"]);
    expect(html).not.toMatch(/role="dialog"/);
    expect(html).not.toMatch(/data-book-state=/);
    expect(html).not.toMatch(/liem-dimmed/);
  });

  it("setup card over the dimmed board", () => {
    const store = createAppStore();
    store.dispatch(switchMode("liem"));
    const html = render(store);
    const board = divWithClass(html, "board");
    const squares = divWithClass(board, "squares");

    expect(board).toMatch(/role="tablist"/);
    expect(squares).toMatch(/role="dialog" aria-label="Challenge Le Quang Liem"/);
    // The squares are dimmed; the card on top of them is not.
    const dimmed = divWithClass(squares, "liem-dimmed");
    expect(dimmed.match(/data-square="/g)).toHaveLength(64);
    expect(dimmed).not.toMatch(/role="dialog"/);

    expect(playerNames(board)).toEqual([]);
    expect(buttonLabels(html)).not.toContain("Play");
    expect(buttonLabels(html)).not.toContain("Reset");
    expect(html).not.toMatch(/data-book-state=/);
  });

  it("vs-Liem sidebar order", () => {
    const html = render(liemGameAs("black"));
    const board = divWithClass(html, "board");
    const sidebar = divWithClass(html, "sidebar");

    // No cards around the board, and his name shows once.
    expect(playerNames(board)).toEqual([]);
    expect(html.split(LIEM.entry.name)).toHaveLength(2);

    const cards = sidebarCards(html);
    expect(cards.map((c) => c.color)).toEqual(["white", "black"]);
    const [his, yours] = cards;
    expect(playerNames(his.html)).toEqual([LIEM.entry.name]);
    expect(his.html).toContain(`<span class="player__title">${LIEM.entry.title}</span>`);
    expect(his.html).toContain(`src="${avatarSrc(LIEM.entry.avatar)}"`);
    expect(his.html).toMatch(/class="liem-detail"/);
    // White moves first and the clocks run at once, so his (White) clock is the running one.
    expect(his.html).toMatch(/player__time--running/);
    expect(playerNames(yours.html)).toEqual(["You"]);
    expect(yours.html).toContain(`src="${avatarSrc(null)}"`);
    expect(yours.html).not.toMatch(/player__time--running/);

    // His card, then the note, then yours.
    const hisAt = sidebar.indexOf(his.html);
    const noteAt = sidebar.indexOf("data-book-state=");
    const yoursAt = sidebar.indexOf(yours.html);
    expect(hisAt).toBeGreaterThan(-1);
    expect(noteAt).toBeGreaterThan(hisAt);
    expect(yoursAt).toBeGreaterThan(noteAt);

    // Then the buttons, Fallen Pieces and Notation.
    const buttonsAt = sidebar.indexOf('class="buttons"');
    expect(buttonsAt).toBeGreaterThan(yoursAt);
    expect(sidebar.indexOf("Fallen Pieces")).toBeGreaterThan(buttonsAt);
    expect(sidebar.indexOf("Notation")).toBeGreaterThan(sidebar.indexOf("Fallen Pieces"));
    expect(buttonLabels(html)).toEqual(["New game", "Flip board", "Sound"]);
  });

  it("vs-Liem as White puts him on Black", () => {
    const cards = sidebarCards(render(liemGameAs("white")));
    expect(cards.map((c) => c.color)).toEqual(["black", "white"]);
    expect(playerNames(cards[0].html)).toEqual([LIEM.entry.name]);
    expect(playerNames(cards[1].html)).toEqual(["You"]);
    expect(cards[1].html).toMatch(/player__time--running/);
  });
});

/** A fake opponent whose next choice the test resolves by hand. */
function fakeOpponent() {
  const pending: ((choice: MoveChoice) => void)[] = [];
  const opponent: LiemOpponent = {
    chooseMove: vi.fn(() => new Promise<MoveChoice>((resolve) => pending.push(resolve))),
    newGame: vi.fn(),
    dispose: vi.fn(),
  };
  return { opponent, answer: (choice: MoveChoice) => pending.shift()!(choice) };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function e2e4(store: Store): MoveChoice {
  const state = store.getState().board.engineHistory[0];
  return { move: uciToMove(state, "e2e4")!, uci: "e2e4", source: "engine", lookup: null };
}

describe("liem opponent wiring", () => {
  it("liemGameId is set only during a vs-Liem game", () => {
    const store = createAppStore();
    const id = () => liemGameId(store.getState().board, store.getState().match);
    expect(id()).toBeNull(); // two players
    store.dispatch(switchMode("liem"));
    expect(id()).toBeNull(); // card open
    store.dispatch(startLiemGame());
    expect(id()).toBe(store.getState().board.gameId);
    store.dispatch(newLiemGame());
    expect(id()).toBeNull();
  });

  it("his answer is played on the board and recorded", async () => {
    const store = liemGameAs("black");
    const { opponent, answer } = fakeOpponent();
    const controller = createLiemController(store.dispatch, () => Promise.resolve(opponent));

    syncLiemTurn(controller, store.getState().board, store.getState().match);
    await flush();
    expect(store.getState().match.opponentStatus).toBe("thinking");

    const { gameId } = store.getState().board;
    answer(e2e4(store));
    await flush();

    const { board, match } = store.getState();
    expect(board.engineHistory).toHaveLength(2);
    expect(board.notation[board.notation.length - 1]).toMatch(/e4/);
    expect(match.lastChoice).toEqual({ gameId, ply: 0, uci: "e2e4", source: "engine", lookup: null });
    expect(match.opponentStatus).toBe("idle");

    // Now it's the human's turn: syncing asks for nothing more.
    syncLiemTurn(controller, board, match);
    await flush();
    expect(opponent.chooseMove).toHaveBeenCalledTimes(1);
  });

  it("a stale answer after New game is not played", async () => {
    const store = liemGameAs("black");
    const { opponent, answer } = fakeOpponent();
    const controller = createLiemController(store.dispatch, () => Promise.resolve(opponent));

    syncLiemTurn(controller, store.getState().board, store.getState().match);
    await flush();
    const choice = e2e4(store);

    store.dispatch(newLiemGame());
    syncLiemTurn(controller, store.getState().board, store.getState().match);
    answer(choice);
    await flush();

    expect(store.getState().board.engineHistory).toHaveLength(1);
    expect(store.getState().match.lastChoice).toBeNull();
    expect(store.getState().match.opponentStatus).toBe("idle");
  });

  it("he loads only once a vs-Liem game asks him", async () => {
    const store = createAppStore();
    const load = vi.fn(() => Promise.resolve(fakeOpponent().opponent));
    const controller = createLiemController(store.dispatch, load);
    const sync = () => syncLiemTurn(controller, store.getState().board, store.getState().match);

    sync(); // two players
    store.dispatch(switchMode("liem"));
    sync(); // card open
    await flush();
    expect(load).not.toHaveBeenCalled();

    store.dispatch(setColorPick("black"));
    store.dispatch(startLiemGame());
    sync();
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
  });
});
