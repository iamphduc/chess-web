// Review playback (plan ui-motion, sprint motion › P1): one step slides its move at
// the game board's speed; every other change of position snaps. Fake-DOM tests can't
// see motion, so a mocked motion.div records the props each piece gets.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { applyMove } from "game/engine/engine";
import { initialGameState, type GameState } from "game/engine/game-state";
import { uciToMove } from "game/opponent/position";
import { PieceType } from "game/piece-type";
import { PIECE_MOVE_TRANSITION, reviewStepMotion, type ReviewStep } from "features/board/pieceMotion";
import { ReviewBoard } from "../components/ReviewBoard";

const recorded = vi.hoisted(() => [] as Record<string, unknown>[]);

vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  const { forwardRef, createElement } = await import("react");
  const div = forwardRef<HTMLDivElement, Record<string, unknown>>((props, ref) => {
    recorded.push(props);
    const { className, style } = props as { className?: string; style?: object };
    return createElement("div", { ref, className, style, "data-layout-id": props.layoutId });
  });
  return { ...actual, motion: { div } };
});

/** 1.e4 d5 2.exd5 Qxd5 3.Nc3: positions 0 to 5. */
const MOVES = ["e2e4", "d7d5", "e4d5", "d8d5", "b1c3"];
const POSITIONS: GameState[] = MOVES.reduce(
  (all, uci) => [...all, applyMove(all[all.length - 1], uciToMove(all[all.length - 1], uci)!)],
  [initialGameState()]
);
const LAST = POSITIONS.length - 1;

const step = (ply: number, more: Partial<ReviewStep> = {}): ReviewStep => ({
  gameId: 7,
  ply,
  flipped: false,
  size: 64,
  ...more,
});

describe("reviewStepMotion", () => {
  it("one step slides, forward and back", () => {
    expect(reviewStepMotion(step(3), step(4))).toBe("slide");
    expect(reviewStepMotion(step(4), step(3))).toBe("slide");
  });

  it("a jump snaps", () => {
    expect(reviewStepMotion(null, step(3))).toBe("snap");
    expect(reviewStepMotion(step(3), step(5))).toBe("snap");
    expect(reviewStepMotion(step(5), step(0))).toBe("snap");
    expect(reviewStepMotion(step(0), step(LAST))).toBe("snap");
    expect(reviewStepMotion(step(3), step(4, { flipped: true }))).toBe("snap");
    expect(reviewStepMotion(step(3), step(4, { size: 48 }))).toBe("snap");
    expect(reviewStepMotion(step(3), step(4, { gameId: 8 }))).toBe("snap");
    // The same position again (a re-render) is not a step either.
    expect(reviewStepMotion(step(3), step(3))).toBe("snap");
  });
});

const board = (ply: number, more: { flipped?: boolean; size?: number; gameId?: number } = {}) => (
  <ReviewBoard
    state={POSITIONS[ply]}
    gameId={more.gameId ?? 7}
    ply={ply}
    flipped={more.flipped ?? false}
    size={more.size ?? 64}
    highlight={null}
    interactive={false}
    onMove={() => {}}
  />
);

/** The layout id of the piece standing on `square`, from the markup. */
function layoutIdOn(html: string, square: string): string | null {
  const start = html.indexOf(`data-square="${square}"`);
  expect(start, `square ${square}`).toBeGreaterThanOrEqual(0);
  const rest = html.slice(start + 1);
  const end = rest.indexOf("data-square=");
  return /data-layout-id="([^"]*)"/.exec(end < 0 ? rest : rest.slice(0, end))?.[1] ?? null;
}

describe("review pieces", () => {
  beforeEach(() => {
    recorded.length = 0;
  });

  it("review pieces carry their own layout ids", () => {
    const start = renderToStaticMarkup(board(0));
    expect(layoutIdOn(start, "e2")).toBe(`review-7-${PieceType.WhitePawnE}`);
    expect(layoutIdOn(start, "d7")).toBe(`review-7-${PieceType.BlackPawnD}`);
    // Every piece is a motion element with a review id: 32 at the start.
    expect(recorded).toHaveLength(32);
    expect(recorded.every((p) => String(p.layoutId).startsWith("review-7-"))).toBe(true);

    // 2.exd5 takes the d-pawn; ◀ from there brings it back on d5, with its own id.
    const taken = renderToStaticMarkup(board(3));
    expect(layoutIdOn(taken, "d5")).toBe(`review-7-${PieceType.WhitePawnE}`);
    const back = renderToStaticMarkup(board(2));
    expect(layoutIdOn(back, "d5")).toBe(`review-7-${PieceType.BlackPawnD}`);
    expect(layoutIdOn(back, "e4")).toBe(`review-7-${PieceType.WhitePawnE}`);
  });
});

/** Just enough DOM for react-dom/client to mount and update a tree. */
class FakeNode {
  childNodes: FakeNode[] = [];
  parentNode: FakeNode | null = null;
  attributes: Record<string, string> = {};
  style: Record<string, unknown> = {
    setProperty(this: Record<string, unknown>, name: string, value: string) {
      this[name] = value;
    },
  };
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
const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

let root: Root | null = null;

afterEach(() => {
  root?.unmount();
  root = null;
  delete globals.window;
  delete globals.document;
});

/** Mounts the board for real, so it remembers the last position between renders. */
async function mount() {
  globals.window = {
    document: fakeDocument,
    navigator: { userAgent: "node" },
    HTMLIFrameElement: class {},
    addEventListener() {},
    removeEventListener() {},
  };
  globals.document = fakeDocument;
  const { createRoot } = await import("react-dom/client");
  root = createRoot(fakeDocument.body as unknown as Element);
  return async (node: React.ReactElement) => {
    recorded.length = 0;
    root!.render(node);
    await flush();
    const transitions = recorded.map((p) => JSON.stringify(p.transition));
    // Every piece in one render moves the same way.
    expect(new Set(transitions).size, "one transition per render").toBe(1);
    return recorded[recorded.length - 1].transition;
  };
}

const SLIDE = PIECE_MOVE_TRANSITION;
const SNAP = { duration: 0 };

describe("ReviewBoard motion", () => {
  it("a snap uses no transition time", async () => {
    const show = await mount();
    // Opening the review snaps.
    expect(await show(board(3))).toEqual(SNAP);
    // ▶ and ◀ slide.
    expect(await show(board(4))).toEqual(SLIDE);
    expect(await show(board(3))).toEqual(SLIDE);
    // A far move in the list, First and Last snap.
    expect(await show(board(5))).toEqual(SNAP);
    expect(await show(board(0))).toEqual(SNAP);
    expect(await show(board(LAST))).toEqual(SNAP);
    // A flip, a new square size and another game snap, even one ply away.
    expect(await show(board(LAST - 1))).toEqual(SLIDE);
    expect(await show(board(LAST - 2, { flipped: true }))).toEqual(SNAP);
    expect(await show(board(LAST - 1, { flipped: true, size: 48 }))).toEqual(SNAP);
    expect(await show(board(LAST, { flipped: true, size: 48, gameId: 8 }))).toEqual(SNAP);
  });

  it("a re-render keeps the step's motion", async () => {
    // The evals arrive while a step slides: the same position again must not cut it short.
    const show = await mount();
    await show(board(2));
    expect(await show(board(3))).toEqual(SLIDE);
    expect(await show(board(3))).toEqual(SLIDE);
    expect(await show(board(1))).toEqual(SNAP);
    expect(await show(board(1))).toEqual(SNAP);
  });
});
