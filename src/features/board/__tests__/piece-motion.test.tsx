// Piece speed (plan ui-feel, sprint feel › M1): every piece move on the game board is
// a 200 ms ease-in-out tween, and the review's one-ply step keeps its 150 ms ease-out.
// Fake-DOM tests can't see motion, so a mocked motion.div records the props each piece
// gets, and a cubic-Bézier helper samples the curve.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Provider } from "react-redux";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAppStore } from "app/store";
import { PieceType } from "game/piece-type";
import { reset } from "../BoardSlice";
import { switchMode } from "features/liem/liemActions";
import * as pieceMotion from "../pieceMotion";
import { Piece } from "../components/Piece";

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

beforeEach(() => {
  recorded.length = 0;
});

function renderPiece(store: ReturnType<typeof createAppStore>, pieceType: PieceType) {
  return renderToStaticMarkup(
    <Provider store={store}>
      <DndProvider backend={HTML5Backend}>
        <Piece pieceType={pieceType} y={6} x={4} isWhiteTurn />
      </DndProvider>
    </Provider>
  );
}

/**
 * The progress of a CSS cubic-bezier(x1, y1, x2, y2) at time t (both 0 to 1): find the
 * curve parameter s whose x is t (x rises with s for x1, x2 in [0, 1]), then return y(s).
 */
function cubicBezier([x1, y1, x2, y2]: readonly number[], t: number): number {
  const at = (s: number, p1: number, p2: number) => 3 * (1 - s) * (1 - s) * s * p1 + 3 * (1 - s) * s * s * p2 + s * s * s;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (at(mid, x1, x2) < t) lo = mid;
    else hi = mid;
  }
  return at((lo + hi) / 2, y1, y2);
}

/** The game curve's control points; fails the test if the ease isn't four numbers. */
function gameCurve(): readonly number[] {
  const ease = (pieceMotion as Record<string, { ease?: unknown } | undefined>).GAME_MOVE_TRANSITION?.ease;
  expect(Array.isArray(ease) && ease.length === 4 && ease.every((n) => typeof n === "number"), "ease is 4 control points").toBe(true);
  return ease as number[];
}

describe("piece speed", () => {
  it("game-board moves use a 200 ms ease-in-out tween", () => {
    expect(pieceMotion.GAME_MOVE_TRANSITION).toEqual({ type: "tween", ease: [0.42, 0, 0.58, 1], duration: 0.2 });
  });

  it("the game curve starts gently and never overshoots", () => {
    const curve = gameCurve();
    const { duration } = pieceMotion.GAME_MOVE_TRANSITION;
    // The first frame (1/60 s) covers well under 20 % of the way.
    expect(cubicBezier(curve, 1 / 60 / duration)).toBeLessThan(0.05);
    // 101 evenly spaced samples: from 0 to 1, never down, never outside [0, 1].
    const samples = Array.from({ length: 101 }, (_, i) => cubicBezier(curve, i / 100));
    expect(samples[0]).toBeCloseTo(0, 6);
    expect(samples[100]).toBeCloseTo(1, 6);
    for (let i = 0; i < samples.length; i += 1) {
      expect(samples[i], `t=${i / 100} in range`).toBeGreaterThanOrEqual(-1e-9);
      expect(samples[i], `t=${i / 100} in range`).toBeLessThanOrEqual(1 + 1e-9);
      if (i > 0) expect(samples[i], `t=${i / 100} rises`).toBeGreaterThanOrEqual(samples[i - 1]);
    }
    // Symmetric: halfway in time is halfway along.
    expect(Math.abs(cubicBezier(curve, 0.5) - 0.5)).toBeLessThanOrEqual(0.01);
  });

  it("the game board's pieces use it", () => {
    const store = createAppStore();
    store.dispatch(switchMode("two-player"));
    store.dispatch(reset());
    const { gameId } = store.getState().board;
    renderPiece(store, PieceType.WhitePawnE);

    expect(recorded).toHaveLength(1);
    expect(pieceMotion.GAME_MOVE_TRANSITION).toBeDefined();
    expect(recorded[0].transition).toBe(pieceMotion.GAME_MOVE_TRANSITION);
    // The layout id is still one per piece per game.
    expect(recorded[0].layoutId).toBe(`${gameId}-${PieceType.WhitePawnE}`);
  });

  it("the review step keeps 150 ms ease-out", () => {
    expect(pieceMotion.REVIEW_STEP_TRANSITION).toEqual({ type: "tween", ease: "easeOut", duration: 0.15 });
    expect(pieceMotion.REVIEW_STEP_TRANSITION).not.toEqual(pieceMotion.GAME_MOVE_TRANSITION);
    expect(pieceMotion.transitionFor("slide")).toBe(pieceMotion.REVIEW_STEP_TRANSITION);
    expect(pieceMotion.transitionFor("snap")).toBe(pieceMotion.SNAP_TRANSITION);
  });
});
