import { describe, expect, it } from "vitest";

import { ENTRANCE } from "../src/features/board/gameOverEntrance";
import { contrast, declarations, declsFor, last, lookViolations, readCss, rules, stripComments, token } from "./look-helpers";

const COMPONENTS = ["features", "board", "components"];
const files = ["Square.css", "Overlay.css", "Piece.css", "Promotion.css", "GameOver.css"];
const read = (name: string) => readCss(...COMPONENTS, name);

/** Each `@keyframes name { ... }` block, name -> its stops (selector -> declarations). */
function keyframes(css: string): Record<string, Record<string, [string, string][]>> {
  const out: Record<string, Record<string, [string, string][]>> = {};
  for (const m of stripComments(css).matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)) {
    out[m[1]] = Object.fromEntries(
      [...m[2].matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((stop) => [stop[1].trim(), declarations(stop[2])])
    );
  }
  return out;
}

const REDUCED_BLOCK =
  /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/;

/** The body of the `@media (prefers-reduced-motion: reduce)` block, or "" when missing. */
const reducedMotionBlock = (css: string) => stripComments(css).match(REDUCED_BLOCK)?.[1] ?? "";

/** An `animation` shorthand split into its name, duration and delay (ms) and timing function. */
function animation(value: string | undefined) {
  const v = value ?? "";
  const ms = [...v.matchAll(/(\d*\.?\d+)(ms|s)\b/g)].map((m) => Number(m[1]) * (m[2] === "s" ? 1000 : 1));
  const name = v.split(/\s+/).find((w) => /^[a-z][\w-]*$/i.test(w) && !/^(ease(-in|-out|-in-out)?|linear|both|forwards|backwards|none|normal|infinite)$/.test(w));
  return { name, duration: ms[0], delay: ms[1] ?? 0, timing: v };
}

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

  it("game-over entrance follows the Look", () => {
    const all = read("GameOver.css");
    // What runs when the system doesn't ask for reduced motion.
    const css = all.replace(REDUCED_BLOCK, "");
    const animate = '.game-over[data-entrance="animate"]';
    const frames = keyframes(css);

    // The scrim: a 300 ms pause, then a 200 ms ease-out fade from clear.
    const scrim = animation(last(declsFor(css, animate), "animation"));
    expect(scrim.duration).toBe(ENTRANCE.scrimMs);
    expect(scrim.delay).toBe(ENTRANCE.pauseMs);
    expect(scrim.timing).toMatch(/\bease-out\b/);
    expect(scrim.timing, "the pause holds the first frame").toMatch(/\b(both|backwards)\b/);
    const scrimFrames = frames[scrim.name ?? ""];
    expect(scrimFrames, "scrim keyframes").toBeDefined();
    expect(last(scrimFrames.from ?? scrimFrames["0%"], "opacity")).toBe("0");
    expect(last(scrimFrames.to ?? scrimFrames["100%"], "opacity")).toBe("1");

    // The card: the same pause, then 250 ms ease-out, fading in, rising 8 px and growing from 0.96.
    const card = animation(last(declsFor(css, `${animate} .game-over__card`), "animation"));
    expect(card.duration).toBe(ENTRANCE.cardMs);
    expect(card.delay).toBe(ENTRANCE.pauseMs);
    expect(card.timing).toMatch(/\bease-out\b/);
    expect(card.timing).toMatch(/\b(both|backwards)\b/);
    const cardFrames = frames[card.name ?? ""];
    expect(cardFrames, "card keyframes").toBeDefined();
    const from = cardFrames.from ?? cardFrames["0%"];
    const to = cardFrames.to ?? cardFrames["100%"];
    expect(last(from, "opacity")).toBe("0");
    expect(last(from, "transform")).toBe(`translateY(${ENTRANCE.risePx}px) scale(${ENTRANCE.scaleFrom})`);
    // Hidden during the pause, so its buttons can't be pressed unseen.
    expect(last(from, "visibility")).toBe("hidden");
    expect(last(to, "opacity")).toBe("1");
    expect(last(to, "transform")).toBe("none");
    expect(last(to, "visibility")).toBe("visible");
    // Two stops only, so nothing goes past its end value on the way.
    expect(Object.keys(cardFrames).length).toBe(2);
    expect(Object.keys(scrimFrames).length).toBe(2);

    // Ease-out only: no curve that passes its end (overshoot), no spring, no bounce.
    for (const m of css.matchAll(/cubic-bezier\(([^)]*)\)/g)) {
      const [, y1, , y2] = m[1].split(",").map(Number);
      expect(Math.max(y1, y2), m[0]).toBeLessThanOrEqual(1);
    }
    expect(css).not.toMatch(/spring|bounce|linear\(/i);
    for (const { body } of rules(css)) {
      for (const [prop, value] of declarations(body)) {
        if (/^(animation|transition)/.test(prop)) expect(value, prop).not.toMatch(/\bease-in\b|ease-in-out/);
      }
    }

    // Instant and reduced motion: no animation at all.
    for (const { selector, body } of rules(css)) {
      if (selector.includes('data-entrance="instant"')) {
        expect(declarations(body).filter(([p]) => p.startsWith("animation")), selector).toEqual([]);
      }
    }
    const reduced = reducedMotionBlock(all);
    expect(reduced, "has a reduced-motion rule").not.toBe("");
    for (const sel of [animate, `${animate} .game-over__card`]) {
      expect(last(declsFor(reduced, sel), "animation"), `${sel} under reduced motion`).toBe("none");
    }
  });
});
