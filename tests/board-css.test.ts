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

  it("game-over card dims the board", () => {
    const css = read("GameOver.css");
    expect(lookViolations(css)).toEqual([]);

    const scrim = declsFor(css, ".game-over");
    expect(last(scrim, "background-color")).toBe("var(--game-over-scrim)");
    expect(last(scrim, "pointer-events")).toBe("none");

    const card = declsFor(css, ".game-over__card");
    expect(last(card, "pointer-events")).toBe("auto");
    expect(last(card, "background-color")).toBe("var(--surface)");
    expect(last(card, "border")).toBe("1px solid var(--line)");
    expect(last(card, "border-radius")).toBe("var(--radius)");
    expect(last(card, "padding")).toBe("var(--space-5)");
    expect(token("--space-5")).toBe("24px");

    const title = declsFor(css, ".game-over__title");
    expect(last(title, "font-size")).toBe("var(--text-title)");
    expect(last(title, "color")).toBe("var(--ink)");
    const reason = declsFor(css, ".game-over__reason");
    expect(last(reason, "font-size")).toBe("var(--text-body)");
    expect(last(reason, "color")).toBe("var(--soft)");

    const actions = declsFor(css, ".game-over__actions");
    expect(last(actions, "display")).toBe("flex");
    expect(last(actions, "flex-wrap")).toBe("wrap");
    expect(last(actions, "gap")).toBe("var(--space-2)");
    expect(token("--space-2")).toBe("8px");

    // Tokens only: every color, size and space is a var(), never a literal (a 1px border aside).
    for (const { selector } of rules(css)) {
      for (const [prop, value] of declsFor(css, selector)) {
        if (/color|background|border$|font-size|padding|margin|gap/.test(prop)) {
          expect(value, `${selector} ${prop}`).not.toMatch(/#[0-9a-f]{3,6}\b|rgba?\(|\b([2-9]|\d{2,})px\b/i);
        }
      }
    }
  });
});
