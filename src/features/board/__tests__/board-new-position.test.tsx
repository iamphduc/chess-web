import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Provider } from "react-redux";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { describe, expect, it } from "vitest";

import { createAppStore } from "app/store";
import { uciToMove } from "game/opponent/position";
import { newLiemGame, startLiemGame, switchMode } from "features/liem/liemActions";
import { setColorPick } from "features/liem/matchSlice";
import { clickSquare, playOpponentMove, reset } from "../BoardSlice";
import { toggleFlip } from "../viewSlice";
import { Board } from "../Board";

type Store = ReturnType<typeof createAppStore>;

/** Two players, after one click on its tab (the page opens on vs Liem). */
function twoPlayers(): Store {
  const store = createAppStore();
  store.dispatch(switchMode("two-player"));
  return store;
}

function render(store: Store): string {
  return renderToStaticMarkup(
    <Provider store={store}>
      <DndProvider backend={HTML5Backend}>
        <Board />
      </DndProvider>
    </Provider>
  );
}

const VOID = new Set(["img", "input", "br", "hr", "meta", "link", "source", "area", "col", "wbr"]);

/**
 * Where React places the element whose opening tag contains `needle`: each
 * ancestor's tag and its index among its parent's elements, from the root down.
 * The same path in two renders means React keeps the same DOM node between them.
 */
function elementPath(html: string, needle: string): string {
  const stack: { tag: string; index: number; children: number }[] = [{ tag: "#root", index: 0, children: 0 }];
  const re = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const [whole, closing, tag, , selfClosing] = m;
    if (closing) {
      stack.pop();
      continue;
    }
    const parent = stack[stack.length - 1];
    const node = { tag, index: parent.children++, children: 0 };
    if (whole.includes(needle)) {
      return [...stack.slice(1), node].map((n) => `${n.tag}[${n.index}]`).join(" > ");
    }
    if (!selfClosing && !VOID.has(tag.toLowerCase())) stack.push(node);
  }
  throw new Error(`no element with ${needle}`);
}

const squarePath = (store: Store, square: string) => elementPath(render(store), `data-square="${square}"`);

/** The layout id of the piece standing on `square`. */
function layoutId(store: Store, square: string): string {
  const html = render(store);
  const start = html.indexOf(`data-square="${square}"`);
  expect(start, `square ${square}`).toBeGreaterThanOrEqual(0);
  const rest = html.slice(start + 1);
  const end = rest.indexOf("data-square=");
  const m = /data-layout-id="([^"]*)"/.exec(end < 0 ? rest : rest.slice(0, end));
  expect(m, `layout id of the piece on ${square}`).not.toBeNull();
  return m![1];
}

function click(store: Store, square: string) {
  const x = square.charCodeAt(0) - 97;
  const y = 8 - Number(square[1]);
  store.dispatch(clickSquare({ y, x }));
}

describe("a new position keeps the squares mounted", () => {
  it("opening and closing the setup card keeps the same square nodes", () => {
    const store = twoPlayers();
    const twoPlayerPath = squarePath(store, "e2");

    store.dispatch(switchMode("liem"));
    const cardOpen = squarePath(store, "e2");
    expect(render(store)).toMatch(/role="dialog"/);

    store.dispatch(setColorPick("white"));
    store.dispatch(startLiemGame());
    const inGame = squarePath(store, "e2");

    store.dispatch(newLiemGame());
    const reopened = squarePath(store, "e2");

    expect(cardOpen).toBe(twoPlayerPath);
    expect(inGame).toBe(cardOpen);
    expect(reopened).toBe(inGame);
  });

  it("the squares are dimmed only while the card is open", () => {
    const store = createAppStore();
    store.dispatch(switchMode("liem"));
    expect(render(store)).toMatch(/class="squares__grid liem-dimmed" aria-hidden="true"/);
    store.dispatch(setColorPick("white"));
    store.dispatch(startLiemGame());
    const html = render(store);
    expect(html).toMatch(/class="squares__grid"/);
    expect(html).not.toMatch(/liem-dimmed/);
    expect(html).not.toMatch(/class="squares__grid[^"]*" aria-hidden/);
  });
});

describe("each game has its own piece layout ids", () => {
  it("two-player Reset gives every piece a new layout id", () => {
    const store = twoPlayers();
    click(store, "e2");
    click(store, "e4");
    const before = layoutId(store, "a1");
    store.dispatch(reset());
    expect(layoutId(store, "a1")).not.toBe(before);
    expect(layoutId(store, "e2")).not.toBe(layoutId(store, "a1"));
  });

  it("mode switch, Start game and New game each start new layout ids", () => {
    const store = twoPlayers();
    const seen = [layoutId(store, "a1")];
    store.dispatch(switchMode("liem"));
    seen.push(layoutId(store, "a1"));
    store.dispatch(setColorPick("white"));
    store.dispatch(startLiemGame());
    seen.push(layoutId(store, "a1"));
    store.dispatch(newLiemGame());
    seen.push(layoutId(store, "a1"));
    store.dispatch(switchMode("two-player"));
    seen.push(layoutId(store, "a1"));
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("a move keeps the moved piece's layout id, so it slides", () => {
    const store = twoPlayers();
    const pawn = layoutId(store, "e2");
    click(store, "e2");
    click(store, "e4");
    expect(layoutId(store, "e4")).toBe(pawn);
  });

  it("his move keeps the moved piece's layout id", () => {
    const store = createAppStore();
    store.dispatch(switchMode("liem"));
    store.dispatch(setColorPick("black"));
    store.dispatch(startLiemGame());
    const pawn = layoutId(store, "e2");
    const { gameId, engineHistory } = store.getState().board;
    store.dispatch(playOpponentMove({ gameId, ply: 0, move: uciToMove(engineHistory[0], "e2e4")! }));
    expect(layoutId(store, "e4")).toBe(pawn);
  });

  it("a flip keeps every layout id", () => {
    const store = createAppStore();
    const rook = layoutId(store, "a1");
    store.dispatch(toggleFlip());
    expect(layoutId(store, "a1")).toBe(rook);
  });
});
