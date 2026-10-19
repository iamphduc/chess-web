import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Plan sparring-ladder, ## Look: the vs-Liem look with no new colors or fonts,
// plus the ♞ sparring avatar (.liem-sparring-avatar).

const SRC = join(__dirname, "..", "src");
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");
const readSrc = (...parts: string[]) => stripComments(readFileSync(join(SRC, ...parts), "utf8"));
const indexCss = () => readSrc("index.css");
const liemCss = () => readSrc("styles", "liem.css");

// Every .css file under a folder, recursively.
function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return cssFiles(path);
    return e.name.endsWith(".css") ? [path] : [];
  });
}

// Every custom property declared in any `:root { ... }` block, name -> raw values.
function rootTokens(source: string): Record<string, string[]> {
  const tokens: Record<string, string[]> = {};
  for (const block of source.matchAll(/(^|[\s}]):root\s*\{([^}]*)\}/g)) {
    for (const m of block[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      (tokens[m[1]] ??= []).push(m[2].trim());
    }
  }
  return tokens;
}

function token(name: string): string {
  const values = rootTokens(indexCss())[name] ?? [];
  expect(values, `${name} declared once in :root`).toHaveLength(1);
  return values[0];
}

// Innermost rules (selector -> body), including those inside @media blocks.
function rules(source: string): { selector: string; body: string }[] {
  return [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1].trim(),
    body: m[2],
  }));
}

function declarations(body: string): [string, string][] {
  return body
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => {
      const i = d.indexOf(":");
      return [d.slice(0, i).trim().toLowerCase(), d.slice(i + 1).trim()];
    });
}

// WCAG 2.x relative luminance of a #RRGGBB color.
function luminance(hex: string): number {
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) throw new Error(`not a #RRGGBB color: ${hex}`);
  const [r, g, b] = m.slice(1).map((h) => {
    const c = parseInt(h, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// The :root tokens on the day the plan started (2026-10-18). The Look rules out new ones.
const TODAYS_TOKENS = [
  "--background",
  "--text",
  "--dark-background",
  "--dark-text",
  "--dark-title",
  "--dark-surface",
  "--clock-waiting-bg",
  "--clock-waiting-ink",
  "--clock-running-bg",
  "--clock-running-ink",
  "--clock-low-bg",
  "--clock-low-ink",
  "--board-light",
  "--board-dark",
  "--board-highlight",
  "--board-hint",
  "--board-check",
  "--board-drop-edge",
  "--board-sound-on",
  "--board-focus",
  "--liem-card",
  "--liem-note",
  "--liem-text",
  "--liem-text-soft",
  "--liem-red",
  "--liem-gold",
  "--liem-gold-tint",
  "--liem-badge-bg",
  "--liem-line",
  "--liem-start",
  "--book-bar",
  "--grade-inaccuracy",
  "--grade-mistake",
  "--grade-blunder",
  "--grade-best",
  "--grade-book",
  "--grade-ink",
  "--review-page",
  "--review-scrim",
];

// Properties that paint a color.
const COLOR_PROPS =
  /^(color|background|background-color|border|border-(top|right|bottom|left)(-color)?|border-color|outline|outline-color|box-shadow|text-shadow|fill|stroke|text-decoration(-color)?|caret-color|accent-color|-webkit-text-fill-color)$/;
const NOT_A_COLOR = /^(-?[\d.]+(px|em|rem|%)?|solid|dashed|dotted|inset|none|transparent|inherit|initial|unset)$/i;

const AVATAR = ".liem-sparring-avatar";

// Every rule whose selector names the avatar class (alone, in a list, or with a pseudo part).
function avatarRules() {
  return rules(liemCss()).filter((r) =>
    r.selector.split(",").some((s) => new RegExp(`\\${AVATAR}(?![\\w-])`).test(s))
  );
}

describe("ladder look", () => {
  it("token values", () => {
    expect(token("--liem-card").toUpperCase()).toBe("#1F1F1F");
    expect(token("--liem-text").toUpperCase()).toBe("#FFFFFF");
    expect(token("--liem-text-soft").toUpperCase()).toBe("#B8B8B8");
    expect(token("--liem-gold").toUpperCase()).toBe("#FFCD00");
  });

  it("text contrast on the card", () => {
    const card = token("--liem-card");
    for (const fg of ["--liem-text-soft", "--liem-text", "--liem-gold"]) {
      expect(contrast(token(fg), card), `${fg} on --liem-card`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("no new tokens", () => {
    // index.css declares exactly today's set, each once
    const tokens = rootTokens(indexCss());
    expect(Object.keys(tokens).sort()).toEqual([...TODAYS_TOKENS].sort());
    for (const [name, values] of Object.entries(tokens)) expect(values, `${name} declared once`).toHaveLength(1);
    // and no other stylesheet under src/ declares a :root token of its own
    for (const file of cssFiles(SRC)) {
      if (resolve(file) === resolve(join(SRC, "index.css"))) continue;
      const own = Object.keys(rootTokens(stripComments(readFileSync(file, "utf8"))));
      expect(own, `${file} declares :root tokens`).toEqual([]);
    }
  });

  it("sparring avatar style", () => {
    const all = avatarRules();
    expect(all.length, `${AVATAR} defined`).toBeGreaterThan(0);
    const base = all.filter((r) => r.selector.split(",").some((s) => s.trim() === AVATAR));
    expect(base, `${AVATAR} has a base rule`).toHaveLength(1);
    const d = declarations(base[0].body);
    const get = (p: string) => d.find(([k]) => k === p)?.[1];

    // the 40 x 40 box the image avatar fills, kept at 40 in a flex row
    expect(get("width")).toBe("40px");
    expect(get("height")).toBe("40px");
    expect(get("flex-shrink")).toBe("0");
    for (const p of ["min-width", "max-width", "min-height", "max-height", "padding", "border"]) {
      expect(get(p), `${p} would change the 40 x 40 box`).toBeUndefined();
    }

    // the glyph is centred
    expect(get("display")).toMatch(/^(inline-)?(grid|flex)$/);
    const centred =
      get("place-items") === "center" ||
      (get("align-items") === "center" && get("justify-content") === "center");
    expect(centred, "glyph centred").toBe(true);

    // ♞ in --liem-text on --liem-card
    expect(get("color")).toBe("var(--liem-text)");
    expect(get("background-color")).toBe("var(--liem-card)");

    for (const { selector, body } of all) {
      // no image of any kind: the glyph is text
      expect(body, `${selector} has no image`).not.toMatch(/url\(|image|gradient\(/i);
      for (const [prop, value] of declarations(body)) {
        if (prop === "content") expect(value, `${selector} content`).toMatch(/^(none|normal|"[^"]*"(\s*\/\s*"[^"]*")?)$/);
        if (!COLOR_PROPS.test(prop)) continue;
        // every color is a --liem-* token; anything else is a size or a style
        for (const m of value.matchAll(/var\((--[\w-]+)\)/g)) {
          expect(m[1], `${selector} { ${prop}: ${value} }`).toMatch(/^--liem-/);
        }
        const rest = value.replace(/var\(--[\w-]+\)/g, "").split(/[\s,]+/).filter(Boolean);
        for (const word of rest) expect(word, `${selector} { ${prop}: ${value} }`).toMatch(NOT_A_COLOR);
      }
    }
  });

  it("fonts served from the app", () => {
    const source = indexCss();
    const faces = [...source.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => declarations(m[1]));
    const quicksand = faces.filter((d) => d.some(([p, v]) => p === "font-family" && /^["']?Quicksand["']?$/.test(v)));
    expect(quicksand.length, "Quicksand @font-face rules").toBeGreaterThan(0);
    const fontsDir = resolve(SRC, "assets", "fonts");
    for (const d of quicksand) {
      const src = d.find(([p]) => p === "src")?.[1] ?? "";
      const urls = [...src.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((m) => m[1]);
      expect(urls.length, "each face names a file").toBeGreaterThan(0);
      for (const url of urls) {
        const file = resolve(SRC, url);
        expect(dirname(file), `${url} is in src/assets/fonts`).toBe(fontsDir);
        expect(existsSync(file), `${url} exists`).toBe(true);
      }
    }
    // every font file the app names is its own: no CSS under src/ reaches out to the web
    for (const file of cssFiles(SRC)) {
      const css = stripComments(readFileSync(file, "utf8"));
      expect(css, `${file} names http(s)`).not.toMatch(/https?:/i);
      expect(css, `${file} has a protocol-relative url`).not.toMatch(/url\(\s*["']?\/\//i);
      expect(css, `${file} imports a stylesheet`).not.toMatch(/@import/i);
    }
  });
});
