import { describe, expect, it } from "vitest";

import { contrast, declsFor, last, lookViolations, readCss, rules, token } from "./look-helpers";

const COMPONENTS = ["features", "board", "components"];
const files = ["Square.css", "Overlay.css", "Piece.css", "Promotion.css", "GameOver.css"];
const read = (name: string) => readCss(...COMPONENTS, name);

/** Follows `var(--x)` through the :root tokens to a literal color. */
function resolve(value: string): string {
  const m = value.trim().match(/^var\((--[\w-]+)\)$/);
  return m ? resolve(token(m[1])) : value.trim();
}

describe("board CSS", () => {
  it("board styles follow the Look", () => {
    for (const name of files) {
      const source = read(name);
      expect(lookViolations(source), `${name} follows the Look`).toEqual([]);
      expect(source, `${name} has no drop-shadow`).not.toMatch(/drop-shadow/);
    }

    const all = files.map(read).join("\n");
    for (const name of [
      "--board-highlight",
      "--board-hint",
      "--board-check",
      "--board-drop-edge",
      "--board-light",
      "--board-dark",
    ]) {
      expect(all, `uses var(${name})`).toContain(`var(${name})`);
    }

    // Every color a square label can take reads at 4.5:1 on both square colors.
    const square = read("Square.css");
    const labelColors = rules(square)
      .filter((r) => r.selector.includes(".square__label"))
      .flatMap((r) => declsFor(square, r.selector))
      .filter(([p]) => p === "color")
      .map(([, v]) => v);
    expect(labelColors.length, "labels set a color").toBeGreaterThan(0);
    for (const color of labelColors) {
      for (const bg of ["--board-light", "--board-dark"]) {
        expect(contrast(resolve(color), token(bg)), `${color} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("promotion picker is a card", () => {
    const css = read("Promotion.css");
    const box = declsFor(css, ".promotion");
    expect(last(box, "background-color")).toBe("var(--surface)");
    expect(last(box, "border")).toBe("1px solid var(--line)");
    expect(last(box, "border-radius")).toBe("var(--radius)");
    expect(last(declsFor(css, ".promotion__piece:hover"), "background-color")).toBe("var(--surface-2)");
  });

  it("game-over notice is a card with a 20px title", () => {
    const css = read("GameOver.css");
    const card = declsFor(css, ".game-over__card");
    expect(last(card, "background-color")).toBe("var(--surface)");
    expect(last(card, "border")).toBe("1px solid var(--line)");
    expect(last(card, "border-radius")).toBe("var(--radius)");
    const title = declsFor(css, ".game-over__title");
    expect(last(title, "font-size")).toBe("var(--text-title)");
    expect(last(title, "color")).toBe("var(--ink)");
  });
});
