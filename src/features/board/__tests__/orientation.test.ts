import { describe, expect, it } from "vitest";

import { displayOrder, promotionPlacement, squareLabels, toDisplay } from "../orientation";

/** Board coordinates of a square name, e.g. "e4" → [4, 4]. */
function sq(name: string): [number, number] {
  const x = name.charCodeAt(0) - 97;
  const y = 8 - Number(name[1]);
  return [y, x];
}

const ALL: [number, number][] = Array.from({ length: 64 }, (_, i) => [Math.floor(i / 8), i % 8]);

describe("orientation", () => {
  it("toDisplay maps and inverts", () => {
    expect(toDisplay(sq("a8"), false)).toEqual([0, 0]);
    expect(toDisplay(sq("a8"), true)).toEqual([7, 7]);
    expect(toDisplay(sq("e2"), false)).toEqual([6, 4]);
    expect(toDisplay(sq("e2"), true)).toEqual([1, 3]);

    for (const flipped of [false, true]) {
      for (const p of ALL) {
        expect(toDisplay(toDisplay(p, flipped), flipped)).toEqual(p);
      }
    }
  });

  it("displayOrder covers the board", () => {
    for (const flipped of [false, true]) {
      const order = displayOrder(flipped);
      expect(order).toHaveLength(64);
      expect(new Set(order.map(([y, x]) => `${y},${x}`)).size).toBe(64);
      // Render order walks display rows then columns.
      order.forEach((p, i) => {
        expect(toDisplay(p, flipped)).toEqual([Math.floor(i / 8), i % 8]);
      });
    }
    expect(displayOrder(false)[0]).toEqual(sq("a8"));
    expect(displayOrder(false)[63]).toEqual(sq("h1"));
    expect(displayOrder(true)[0]).toEqual(sq("h1"));
    expect(displayOrder(true)[63]).toEqual(sq("a8"));
  });

  it("labels sit on left and bottom edges", () => {
    const at = (name: string, flipped: boolean) => squareLabels(...sq(name), flipped);

    // Unflipped.
    expect(at("a8", false)).toEqual({ rank: "8", file: null });
    expect(at("h1", false)).toEqual({ rank: null, file: "h" });
    expect(at("a1", false)).toEqual({ rank: "1", file: "a" });
    expect(at("h8", false)).toEqual({ rank: null, file: null });
    expect(at("e4", false)).toEqual({ rank: null, file: null });

    // Flipped: display column 0 is the h-file, so flipped ranks sit on h1..h8.
    // (The sprint doc's example "a1 has rank 1" breaks its own rule; a1 is the
    // top-right square when flipped. h1, top-left, carries rank "1".)
    expect(at("h8", true)).toEqual({ rank: "8", file: "h" });
    expect(at("h1", true)).toEqual({ rank: "1", file: null });
    expect(at("a8", true)).toEqual({ rank: null, file: "a" });
    expect(at("a1", true)).toEqual({ rank: null, file: null });
    expect(at("e4", true)).toEqual({ rank: null, file: null });

    for (const flipped of [false, true]) {
      const labels = ALL.map(([y, x]) => squareLabels(y, x, flipped));
      const ranks = labels.map((l) => l.rank).filter((r): r is string => r !== null);
      const files = labels.map((l) => l.file).filter((f): f is string => f !== null);
      expect(ranks.sort()).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
      expect(files.sort()).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"]);
    }
  });

  it("promotion picker follows the flip", () => {
    expect(promotionPlacement(...sq("e8"), false, 60)).toEqual({
      left: "unset",
      right: 150,
      top: 60,
      bottom: "unset",
    });
    expect(promotionPlacement(...sq("e8"), true, 60)).toEqual({
      left: 150,
      right: "unset",
      top: "unset",
      bottom: 60,
    });
    // e1 mirrors both.
    expect(promotionPlacement(...sq("e1"), false, 60)).toEqual({
      left: "unset",
      right: 150,
      top: "unset",
      bottom: 60,
    });
    expect(promotionPlacement(...sq("e1"), true, 60)).toEqual({
      left: 150,
      right: "unset",
      top: 60,
      bottom: "unset",
    });
    // Unflipped a8 matches today's Promotion.tsx formula.
    expect(promotionPlacement(...sq("a8"), false, 60)).toEqual({
      left: -30,
      right: "unset",
      top: 60,
      bottom: "unset",
    });
  });
});
