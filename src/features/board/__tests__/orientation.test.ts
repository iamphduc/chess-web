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
    // Unflipped b8 keeps the half-square offset (a8 is clamped, see below).
    expect(promotionPlacement(...sq("b8"), false, 60)).toEqual({
      left: 30,
      right: "unset",
      top: 60,
      bottom: "unset",
    });
  });

  it("picker stays inside the board", () => {
    // The widest picker: the review board's four 0.8-square buttons plus its padding and border.
    const widest = (s: number) => 4 * 0.8 * s + 24;
    const corners = ["a8", "h8", "a1", "h1"];
    for (const s of [39, 52, 60, 78]) {
      for (const flipped of [false, true]) {
        // Every square a picker can open on: both back ranks.
        for (const file of "abcdefgh") {
          for (const rank of ["8", "1"]) {
            const name = `${file}${rank}`;
            const p = promotionPlacement(...sq(name), flipped, s);
            const horizontal = [p.left, p.right].filter((v): v is number => v !== "unset");
            const vertical = [p.top, p.bottom].filter((v): v is number => v !== "unset");
            expect(horizontal, `${name} flipped=${flipped} one side`).toHaveLength(1);
            expect(vertical, `${name} flipped=${flipped} one end`).toHaveLength(1);
            const [edge] = horizontal;
            expect(edge, `${name} flipped=${flipped} s=${s} near edge`).toBeGreaterThanOrEqual(0);
            expect(edge + widest(s), `${name} flipped=${flipped} s=${s} far edge`).toBeLessThanOrEqual(8 * s);
            expect(vertical[0]).toBeGreaterThanOrEqual(0);
            expect(vertical[0]).toBeLessThanOrEqual(7 * s);
          }
        }
        // The corners sit flush with the board's edge.
        for (const name of corners) {
          const p = promotionPlacement(...sq(name), flipped, s);
          const edge = p.left !== "unset" ? p.left : p.right;
          expect(edge, `${name} flipped=${flipped} s=${s}`).toBe(0);
        }
      }
    }
    // The e8 and e1 placements don't change (also pinned in "promotion picker follows the flip").
    expect(promotionPlacement(...sq("e8"), false, 52)).toEqual({ left: "unset", right: 130, top: 52, bottom: "unset" });
    expect(promotionPlacement(...sq("e1"), true, 52)).toEqual({ left: 130, right: "unset", top: 52, bottom: "unset" });
  });
});
