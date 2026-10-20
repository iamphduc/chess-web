// Mounts the real Player with react-dom/client, so its effects and timers run.
// The project has no DOM test environment, so a tiny fake DOM stands in for it.
import React, { useEffect } from "react";
import { Provider } from "react-redux";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAppStore } from "app/store";
import { useAppDispatch, useAppSelector } from "app/hooks";
import { replayLiemGame, startLiemGame } from "features/liem/liemActions";
import { setColorPick, setStrength } from "features/liem/matchSlice";
import { uciToMove } from "game/opponent/position";
import { playOpponentMove } from "../BoardSlice";
import { Player } from "../components/Player";

/** Just enough DOM for react-dom/client to mount and update a tree. */
class FakeNode {
  childNodes: FakeNode[] = [];
  parentNode: FakeNode | null = null;
  attributes: Record<string, string> = {};
  style: Record<string, string> = {};
  ownerDocument: unknown = null;
  namespaceURI = "http://www.w3.org/1999/xhtml";
  constructor(public nodeType: number, public nodeName: string, public data = "") {}
  get tagName() {
    return this.nodeName;
  }
  get firstChild() {
    return this.childNodes[0] ?? null;
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
// Only setTimeout and Date are faked, so the clock's timers and reads follow fake time
// while React's scheduler (its own timers) keeps running on the real loop.
const realSetTimeout = setTimeout; // kept from before the fake is installed
const flushReact = () => new Promise((resolve) => realSetTimeout(resolve, 0));
/** Lets React finish mounting and the effects (his 1.e4, the clock restart) land at the current fake time. */
async function settle() {
  for (let i = 0; i < 5; i++) await flushReact();
}
/** Moves fake time forward by `ms`, in 100 ms steps, letting React render between steps. */
async function tick(ms: number) {
  await settle();
  for (let left = ms; left > 0; left -= 100) {
    await vi.advanceTimersByTimeAsync(Math.min(100, left));
    await flushReact();
  }
  await flushReact();
}

/** Plays his 1.e4 from an effect as soon as it's his first move, as the opponent controller does. */
function HisFirstMove() {
  const board = useAppSelector((state) => state.board);
  const dispatch = useAppDispatch();
  useEffect(() => {
    if (!board.isPlaying || board.humanColor !== "black" || board.engineHistory.length !== 1) return;
    const move = uciToMove(board.engineHistory[0], "e2e4");
    if (move) dispatch(playOpponentMove({ gameId: board.gameId, ply: 0, move }));
  });
  return null;
}

let root: Root | null = null;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
});

afterEach(() => {
  vi.useRealTimers();
  root?.unmount();
  root = null;
  delete globals.window;
  delete globals.document;
});

/** Your clock in a vs-Liem game at Easy as `color`, mounted for real. */
async function mountYourClock(color: "white" | "black") {
  globals.window = { document: fakeDocument, navigator: { userAgent: "node" }, HTMLIFrameElement: class {}, addEventListener() {}, removeEventListener() {} };
  globals.document = fakeDocument;
  const { createRoot } = await import("react-dom/client");
  const store = createAppStore();
  store.dispatch(setStrength(1400));
  store.dispatch(setColorPick(color));
  store.dispatch(startLiemGame());
  root = createRoot(fakeDocument.body as unknown as Element);
  root.render(
    <Provider store={store}>
      <Player name="You" title={null} avatar={null} isWhite={color === "white"} />
      <HisFirstMove />
    </Provider>
  );
  // Whole seconds on your clock (MM:SS, floored: a running clock reads 09:59 after 1 ms),
  // after the color disc and the name.
  const shown = () => {
    const [mm, ss] = fakeDocument.body.textContent.replace(/^[♔♚]?You/, "").split(":").map(Number);
    return mm * 60 + ss;
  };
  return { store, shown };
}

describe("New game restarts the clocks", () => {
  it("as Black, your clock starts again at 10:00 after his first move", { timeout: 10_000 }, async () => {
    const { store, shown } = await mountYourClock("black");
    await tick(2100); // your clock runs after his 1.e4
    expect(store.getState().board.engineHistory).toHaveLength(2);
    expect(shown()).toBeLessThanOrEqual(597); // 09:57 or less

    store.dispatch(replayLiemGame());
    await tick(50);
    // He has played 1.e4 again in the new game, and your clock runs from the full time.
    expect(store.getState().board.engineHistory).toHaveLength(2);
    expect(shown()).toBeGreaterThanOrEqual(599); // 09:59 or 10:00
    await tick(1100);
    expect(shown()).toBe(598); // and it is running
  });

  it("as White, your clock starts again at 10:00", { timeout: 10_000 }, async () => {
    const { store, shown } = await mountYourClock("white");
    await tick(2100);
    expect(shown()).toBeLessThanOrEqual(597);

    store.dispatch(replayLiemGame());
    await tick(50);
    expect(shown()).toBeGreaterThanOrEqual(599);
  });

  it("the first tick after New game lands when the digits change", { timeout: 10_000 }, async () => {
    const { store, shown } = await mountYourClock("white");
    await tick(2100); // the old game's timer is due again at about 3000 ms
    store.dispatch(replayLiemGame());
    await tick(300);
    // The new clock reads 09:59 a millisecond after it starts. The old game's timer would only
    // show it at about 3000 ms, so the restart has to schedule its own first tick.
    expect(shown()).toBe(599);
    await tick(1000);
    expect(shown()).toBe(598);
  });
});
