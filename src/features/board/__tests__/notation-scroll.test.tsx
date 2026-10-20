// A move must scroll only the Moves list's own box, never the page (plan ui-polish, S1).
// Mounts the real Notation with react-dom/client on a tiny fake DOM (the pattern from
// new-game-clock.test.tsx). The fake lays rows out 28 px apart in an 84 px box, so the
// box shows three rows, and every page-scroll call is a spy.
import React from "react";
import { Provider } from "react-redux";
import type { Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createAppStore } from "app/store";
import { replayLiemGame, startLiemGame } from "features/liem/liemActions";
import { setColorPick, setStrength } from "features/liem/matchSlice";
import { clickSquare, playOpponentMove } from "../BoardSlice";
import { Notation } from "../components/Notation";
import { listScrollTop } from "../listScroll";

const ROW = 28;
const BOX = 84;

/** Just enough DOM for react-dom/client to mount and update a tree, plus a fixed layout. */
class FakeNode {
  childNodes: FakeNode[] = [];
  parentNode: FakeNode | null = null;
  attributes: Record<string, string> = {};
  style: Record<string, string> = {};
  ownerDocument: unknown = null;
  namespaceURI = "http://www.w3.org/1999/xhtml";
  get className() {
    return this.attributes.class ?? "";
  }
  scrollTop = 0;
  constructor(public nodeType: number, public nodeName: string, public data = "") {}
  get tagName() {
    return this.nodeName;
  }
  get firstChild() {
    return this.childNodes[0] ?? null;
  }
  get lastElementChild(): FakeNode | null {
    const elements = this.childNodes.filter((c) => c.nodeType === 1);
    return elements[elements.length - 1] ?? null;
  }
  get nodeValue() {
    return this.data;
  }
  set nodeValue(value: string) {
    this.data = value;
  }
  get textContent(): string {
    return this.nodeType === 3 ? this.data : this.childNodes.map((c) => c.textContent).join("");
  }
  set textContent(value: string) {
    this.childNodes = [];
    if (value) this.appendChild(fakeText(value));
  }
  /** The scrolling box (`.notation`) this node sits in, if any. */
  get box(): FakeNode | null {
    let node: FakeNode | null = this.parentNode;
    while (node && node.className !== "notation") node = node.parentNode;
    return node;
  }
  get clientHeight() {
    return this.className === "notation" ? BOX : 0;
  }
  /** The box sits at the viewport top; its rows stack ROW apart and move up as it scrolls. */
  getBoundingClientRect() {
    if (this.className === "notation") return { top: 0, bottom: BOX, height: BOX };
    const rows = this.parentNode?.childNodes.filter((c) => c.nodeType === 1) ?? [];
    const top = rows.indexOf(this) * ROW - (this.box?.scrollTop ?? 0);
    return { top, bottom: top + ROW, height: ROW };
  }
  scrollIntoView() {}
  appendChild(child: FakeNode) {
    child.parentNode?.removeChild(child);
    this.childNodes.push(child);
    child.parentNode = this;
    return child;
  }
  insertBefore(child: FakeNode, ref: FakeNode | null) {
    if (!ref) return this.appendChild(child);
    child.parentNode?.removeChild(child);
    this.childNodes.splice(this.childNodes.indexOf(ref), 0, child);
    child.parentNode = this;
    return child;
  }
  removeChild(child: FakeNode) {
    this.childNodes.splice(this.childNodes.indexOf(child), 1);
    child.parentNode = null;
    return child;
  }
  setAttribute(name: string, value: string) {
    this.attributes[name] = String(value);
  }
  removeAttribute(name: string) {
    delete this.attributes[name];
  }
  getAttribute(name: string) {
    return this.attributes[name] ?? null;
  }
  addEventListener() {}
  removeEventListener() {}
}

const doc = new FakeNode(9, "#document");
doc.ownerDocument = doc;
const owned = (node: FakeNode) => Object.assign(node, { ownerDocument: doc });
const fakeText = (data: string) => owned(new FakeNode(3, "#text", data));
const fakeDocument = Object.assign(doc, {
  createElement: (tag: string) => owned(new FakeNode(1, tag.toUpperCase())),
  createElementNS: (ns: string, tag: string) => Object.assign(owned(new FakeNode(1, tag)), { namespaceURI: ns }),
  createTextNode: fakeText,
  body: owned(new FakeNode(1, "BODY")),
});

const globals = globalThis as Record<string, unknown>;
const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let root: Root | null = null;

afterEach(() => {
  root?.unmount();
  root = null;
  fakeDocument.body.childNodes = [];
  vi.restoreAllMocks();
  delete globals.window;
  delete globals.document;
});

/** Every element under `node`. */
function walk(node: FakeNode): FakeNode[] {
  return node.childNodes.flatMap((c) => [c, ...walk(c)]);
}

/** Algebraic square name to board coordinates (y = 0 is rank 8). */
const sq = (name: string): [number, number] => [8 - Number(name[1]), name.charCodeAt(0) - 97];

/** A wide screen (every media query matches), a vs-Liem game as White, and a mounted Notation. */
async function mountNotation() {
  const page = {
    scrollTo: vi.fn(),
    scrollBy: vi.fn(),
    matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  };
  globals.window = {
    document: fakeDocument,
    navigator: { userAgent: "node" },
    HTMLIFrameElement: class {},
    addEventListener() {},
    removeEventListener() {},
    ...page,
  };
  globals.document = fakeDocument;
  const intoView = vi.spyOn(FakeNode.prototype, "scrollIntoView");
  const { createRoot } = await import("react-dom/client");
  const store = createAppStore();
  store.dispatch(setStrength(1400));
  store.dispatch(setColorPick("white"));
  store.dispatch(startLiemGame());
  root = createRoot(fakeDocument.body as unknown as Element);
  root.render(
    <Provider store={store}>
      <Notation />
    </Provider>
  );
  await tick(20);

  const you = (from: string, to: string) => {
    const [y, x] = sq(from);
    const [ty, tx] = sq(to);
    store.dispatch(clickSquare({ y, x }));
    store.dispatch(clickSquare({ y: ty, x: tx }));
  };
  const him = (from: string, to: string) => {
    const { gameId, engineHistory } = store.getState().board;
    store.dispatch(playOpponentMove({ gameId, ply: engineHistory.length - 1, move: { from: sq(from), to: sq(to) } }));
  };
  const box = () => walk(fakeDocument.body).find((n) => n.className === "notation")!;
  const pageScrolls = () =>
    intoView.mock.calls.length + page.scrollTo.mock.calls.length + page.scrollBy.mock.calls.length;
  /** Elements other than the box whose scrollTop moved. */
  const otherScrolled = () => walk(fakeDocument.body).filter((n) => n !== box() && n.scrollTop !== 0);
  return { store, you, him, box, pageScrolls, otherScrolled };
}

// Four moves each: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6, which is four rows.
const GAME: [string, string][] = [
  ["e2", "e4"], ["e7", "e5"], ["g1", "f3"], ["b8", "c6"],
  ["f1", "c4"], ["f8", "c5"], ["c2", "c3"], ["g8", "f6"],
];

describe("listScrollTop keeps the last row in view", () => {
  it("aligns a last row below the view to the box bottom", () => {
    expect(listScrollTop({ scrollTop: 0, height: 84 }, { top: 84, height: 28 })).toBe(28);
    expect(listScrollTop({ scrollTop: 28, height: 84 }, { top: 196, height: 28 })).toBe(140);
  });

  it("aligns a row cut off by the box bottom to the box bottom", () => {
    expect(listScrollTop({ scrollTop: 0, height: 84 }, { top: 70, height: 28 })).toBe(14);
  });

  it("leaves the box unchanged when the row is already in view", () => {
    expect(listScrollTop({ scrollTop: 0, height: 84 }, { top: 56, height: 28 })).toBe(0);
    expect(listScrollTop({ scrollTop: 40, height: 84 }, { top: 56, height: 28 })).toBe(40);
  });

  it("brings a row above the view back to the box top", () => {
    expect(listScrollTop({ scrollTop: 100, height: 84 }, { top: 28, height: 28 })).toBe(28);
  });

  it("gives 0 for an empty list", () => {
    expect(listScrollTop({ scrollTop: 140, height: 84 }, null)).toBe(0);
  });
});

describe("Notation scrolls only its own box", () => {
  it("a move scrolls only the move list", { timeout: 10_000 }, async () => {
    const { you, him, box, pageScrolls, otherScrolled } = await mountNotation();
    for (let i = 0; i < GAME.length; i++) {
      if (i % 2 === 0) you(...GAME[i]);
      else him(...GAME[i]);
      await tick(20);
    }
    expect(pageScrolls()).toBe(0);
    // Four rows in a three-row box: the box scrolls one row, so the last row ends at its bottom.
    expect(box().scrollTop).toBe(ROW);
    expect(otherScrolled()).toEqual([]);
  });

  it("his reply and a new game don't scroll the page", { timeout: 10_000 }, async () => {
    const { store, you, him, box, pageScrolls, otherScrolled } = await mountNotation();
    for (let i = 0; i < GAME.length; i += 2) {
      // Your move and his reply land in the same tick, before React renders.
      you(...GAME[i]);
      him(...GAME[i + 1]);
      await tick(20);
    }
    expect(store.getState().board.notation).toHaveLength(8);
    expect(pageScrolls()).toBe(0);
    expect(box().scrollTop).toBe(ROW);

    store.dispatch(replayLiemGame());
    await tick(20);
    expect(store.getState().board.notation).toHaveLength(0);
    expect(box().scrollTop).toBe(0);
    expect(otherScrolled()).toEqual([]);
    expect(pageScrolls()).toBe(0);
  });
});
