// Mounts the real ResignButton with react-dom/client, so its timer runs.
// The project has no DOM test environment, so a tiny fake DOM stands in for it
// (the same one as new-game-clock.test.tsx).
import React from "react";
import { Provider } from "react-redux";
import type { Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { createAppStore } from "app/store";
import { replayLiemGame, startLiemGame, switchMode } from "features/liem/liemActions";
import { setColorPick } from "features/liem/matchSlice";
import { gameEnd } from "../gameEnd";
import { reset, start, stop } from "../BoardSlice";
import { ResignButton } from "../components/ResignButton";

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
const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let root: Root | null = null;

afterEach(() => {
  root?.unmount();
  root = null;
  delete globals.window;
  delete globals.document;
});

type Store = ReturnType<typeof createAppStore>;

async function mount(store: Store) {
  globals.window = { document: fakeDocument, navigator: { userAgent: "node" }, HTMLIFrameElement: class {}, addEventListener() {}, removeEventListener() {} };
  globals.document = fakeDocument;
  const { createRoot } = await import("react-dom/client");
  root = createRoot(fakeDocument.body as unknown as Element);
  root.render(
    <Provider store={store}>
      <ResignButton />
    </Provider>
  );
  await tick(20);
  /** The button, or null when none is shown. */
  const button = () => fakeDocument.body.childNodes.find((n) => n.nodeName === "BUTTON") ?? null;
  /** A press, as React's own click handler sees it. */
  const press = async () => {
    const node = button();
    if (!node) throw new Error("no button");
    const key = Object.keys(node).find((k) => k.startsWith("__reactProps$"));
    if (!key) throw new Error("no React props on the button");
    (node as unknown as Record<string, { onClick: () => void }>)[key].onClick();
    await tick(20);
  };
  return { button, press };
}

function liemGame(): Store {
  const store = createAppStore();
  store.dispatch(setColorPick("white"));
  store.dispatch(startLiemGame());
  return store;
}

describe("resign button", () => {
  it("turns back after 3 s and resigns on the second press", { timeout: 10_000 }, async () => {
    const store = liemGame();
    const { button, press } = await mount(store);

    const idle = button()!;
    expect(idle.textContent).toBe("Resign");
    expect(idle.getAttribute("class")).toBe("button resign-button");
    expect(idle.getAttribute("type")).toBe("button");
    expect(idle.getAttribute("data-confirm")).not.toBe("true");
    expect(idle.getAttribute("aria-label")).not.toBe("Confirm resign");

    await press();
    expect(button()!.textContent).toBe("Confirm");
    expect(button()!.getAttribute("data-confirm")).toBe("true");
    expect(button()!.getAttribute("aria-label")).toBe("Confirm resign");
    expect(gameEnd(store.getState().board)).toBeNull();

    await tick(3100);
    expect(button()!.textContent).toBe("Resign");
    expect(button()!.getAttribute("data-confirm")).not.toBe("true");
    expect(gameEnd(store.getState().board)).toBeNull();

    // A press after the turn-back confirms again; the next one resigns.
    await press();
    expect(button()!.textContent).toBe("Confirm");
    expect(gameEnd(store.getState().board)).toBeNull();
    await press();
    expect(gameEnd(store.getState().board)).toEqual({ winner: "black", reason: "resigned" });
    // The game is over, so the button is gone.
    expect(button()).toBeNull();
  });

  it("a new game or the end of the game turns Confirm back", { timeout: 10_000 }, async () => {
    const store = liemGame();
    const { button, press } = await mount(store);
    await press();
    expect(button()!.textContent).toBe("Confirm");

    store.dispatch(replayLiemGame());
    await tick(20);
    expect(button()!.textContent).toBe("Resign");

    // Two players: confirm, then the flag falls. Nothing to resign; after New game and Play it reads Resign.
    const two = createAppStore();
    two.dispatch(switchMode("two-player"));
    two.dispatch(start());
    root?.unmount();
    const second = await mount(two);
    await second.press();
    expect(second.button()!.textContent).toBe("Confirm");
    two.dispatch(stop()); // the flag falls
    await tick(20);
    expect(second.button()).toBeNull();
    two.dispatch(reset());
    await tick(20);
    expect(second.button()).toBeNull(); // clocks stopped: nothing to resign
    two.dispatch(start());
    await tick(20);
    expect(second.button()!.textContent).toBe("Resign");
    expect(gameEnd(two.getState().board)).toBeNull();
  });
});
