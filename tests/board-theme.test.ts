import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");
const indexCss = () => stripComments(readFileSync(join(__dirname, "..", "src", "index.css"), "utf8"));
const buttonCss = () =>
  stripComments(
    readFileSync(join(__dirname, "..", "src", "features", "board", "components", "Button.css"), "utf8")
  );

// Every custom property declared in any `:root { ... }` block, name -> raw values.
// A token declared twice (in one block or across blocks) shows up as two values.
function rootTokens(source: string): Record<string, string[]> {
  const tokens: Record<string, string[]> = {};
  for (const block of source.matchAll(/(^|[\s}]):root\s*\{([^}]*)\}/g)) {
    for (const m of block[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      (tokens[m[1]] ??= []).push(m[2].replace(/\s+/g, " ").trim());
    }
  }
  return tokens;
}

// Top-level rules (selector -> body), in source order. Bodies have no nested braces.
function rules(source: string): { selector: string; body: string }[] {
  return [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1].trim(),
    body: m[2],
  }));
}

function token(name: string): string {
  const values = rootTokens(indexCss())[name] ?? [];
  expect(values, `${name} declared once in :root`).toHaveLength(1);
  return values[0];
}

type RGBA = [number, number, number, number];

// Parses #RGB, #RRGGBB, rgb(...) and rgba(...) into 0-255 channels and 0-1 alpha.
function parseColor(value: string): RGBA {
  const v = value.trim();
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1) as RGBA;
  }
  const fn = v.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (fn) return [Number(fn[1]), Number(fn[2]), Number(fn[3]), fn[4] === undefined ? 1 : Number(fn[4])];
  throw new Error(`unsupported color: ${value}`);
}

// Paints `top` over an opaque `bottom`.
function over(top: RGBA, bottom: RGBA): RGBA {
  const a = top[3];
  return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a)).concat(1) as RGBA;
}

// WCAG 2.x relative luminance of an opaque color.
function luminance([r, g, b, a]: RGBA): number {
  if (a !== 1) throw new Error("luminance needs an opaque color; composite it first");
  const [R, G, B] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrast(a: RGBA, b: RGBA): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const WHITE: RGBA = [255, 255, 255, 1];
const PAGE: RGBA = parseColor("#333333");

const LOOK: Record<string, string> = {
  "--board-highlight": "rgba(255, 255, 51, 0.5)",
  "--board-hint": "rgba(0, 0, 0, 0.14)",
  "--board-check":
    "radial-gradient(circle, #ff0000 0%, rgba(231, 0, 0, 0.9) 25%, rgba(169, 0, 0, 0) 89%)",
  "--board-drop-edge": "rgba(255, 255, 255, 0.65)",
  "--board-light": "rgb(234, 240, 206)",
  "--board-dark": "rgb(187, 190, 100)",
  "--board-sound-on": "#059862",
  "--board-focus": "#FFFFFF",
};

describe("board theme", () => {
  it("board tokens have the Look values", () => {
    const tokens = rootTokens(indexCss());
    const boardNames = Object.keys(tokens).filter((n) => n.startsWith("--board-"));
    // exactly the eight contract tokens, each declared once in :root
    expect(boardNames.sort()).toEqual(Object.keys(LOOK).sort());
    for (const [name, value] of Object.entries(LOOK)) {
      expect(tokens[name], name).toHaveLength(1);
      // exact string: the check gradient must match the Look character for character (case aside)
      expect(tokens[name][0].toLowerCase(), name).toBe(value.toLowerCase());
    }
  });

  it("button text meets 4.5:1", () => {
    // the page is --dark-background painted over the white canvas
    const page = over(parseColor(token("--dark-background")), WHITE);
    expect(page.slice(0, 3).map(Math.round)).toEqual(PAGE.slice(0, 3));

    const button = rules(buttonCss()).find((r) => r.selector === ".button");
    expect(button, ".button rule").toBeDefined();
    const ink = button!.body.match(/(?:^|[;\s])color\s*:\s*([^;]+);/)?.[1].trim();
    expect(ink, ".button color").toBeDefined();
    expect(button!.body).toMatch(/background-color\s*:\s*var\(--dark-surface\)/);

    const surface = over(parseColor(token("--dark-surface")), page);
    expect(contrast(parseColor(ink!), surface)).toBeGreaterThanOrEqual(4.5);
  });

  it("focus ring and sound-on icon meet 3:1", () => {
    expect(contrast(parseColor(token("--board-focus")), PAGE)).toBeGreaterThanOrEqual(3);
    expect(contrast(WHITE, parseColor(token("--board-sound-on")))).toBeGreaterThanOrEqual(3);
  });

  it("buttons have the focus ring and icon style", () => {
    const all = rules(buttonCss());
    const focus = all.filter((r) =>
      r.selector.split(",").some((s) => s.trim() === ".button:focus-visible")
    );
    expect(focus, ".button:focus-visible rule").toHaveLength(1);
    const body = focus[0].body;
    // outline shorthand or longhands, either way: 3px, var(--board-focus), 2px offset
    const outline = body.match(/(?:^|[;\s])outline\s*:\s*([^;]+);/)?.[1] ?? "";
    const width = body.match(/outline-width\s*:\s*([^;]+);/)?.[1] ?? outline;
    const color = body.match(/outline-color\s*:\s*([^;]+);/)?.[1] ?? outline;
    expect(width).toMatch(/(^|\s)3px(\s|$)/);
    expect(color).toMatch(/var\(--board-focus\)/);
    expect(outline).not.toMatch(/\bnone\b/);
    expect(body).toMatch(/outline-offset\s*:\s*2px\s*;/);

    const icon = all.find((r) => r.selector.split(",").some((s) => s.trim() === ".button--icon"));
    expect(icon, ".button--icon rule").toBeDefined();
  });
});
