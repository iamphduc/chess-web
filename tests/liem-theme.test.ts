import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "src");
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), "utf8");
const indexCss = () => stripComments(read("index.css"));
const liemCssPath = join(SRC, "styles", "liem.css");
const liemCss = () => {
  expect(existsSync(liemCssPath), "src/styles/liem.css exists").toBe(true);
  return stripComments(readFileSync(liemCssPath, "utf8"));
};

// Every custom property declared in any `:root { ... }` block, name -> raw values.
// A token declared twice (in one block or across blocks) shows up as two values.
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

// Top-level rules (selector -> body). Bodies have no nested braces.
function rules(source: string): { selector: string; body: string }[] {
  return [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1].trim(),
    body: m[2],
  }));
}

// Declarations of a rule body, property -> value.
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

const LOOK: Record<string, string> = {
  "--liem-card": "#1F1F1F",
  "--liem-note": "#262626",
  "--liem-text": "#FFFFFF",
  "--liem-text-soft": "#B8B8B8",
  "--liem-red": "#DA251D",
  "--liem-gold": "#FFCD00",
  "--liem-gold-tint": "#2F2A14",
  "--liem-badge-bg": "#3A3214",
  "--liem-line": "#474747",
  "--liem-start": "#059862",
  "--book-bar": "#BBBE64",
};

// The page: body's rgba(0, 0, 0, 0.8) over the white canvas.
const PAGE = "#333333";

const CONTRACT_CLASSES = [
  "liem-tabs",
  "liem-tab",
  "liem-card",
  "liem-card__title",
  "liem-star",
  "liem-card__sub",
  "liem-tiles",
  "liem-tile",
  "liem-tile__glyph",
  "liem-steps",
  "liem-step",
  "liem-step--lit",
  "liem-elo",
  "liem-badge",
  "liem-note",
  "liem-note--out",
  "liem-note__row",
  "liem-note__row--played",
  "liem-note__bar",
  "liem-note__count",
  "liem-dimmed",
];

// Properties that paint a color. Their values must come from tokens.
const COLOR_PROPS =
  /^(color|background|background-color|border|border-(top|right|bottom|left)(-color)?|border-color|outline|outline-color|box-shadow|text-shadow|fill|stroke|text-decoration(-color)?|caret-color|accent-color)$/;
// Values that are fine without a token: no color at all, or "use what's inherited".
const COLOR_KEYWORDS = /^(none|0|transparent|currentcolor|inherit|initial|unset)$/i;

describe("liem theme", () => {
  it("liem tokens have the Look values", () => {
    const tokens = rootTokens(indexCss());
    const liem = Object.keys(tokens).filter((n) => n.startsWith("--liem-") || n === "--book-bar");
    expect(liem.sort()).toEqual(Object.keys(LOOK).sort());
    for (const [name, value] of Object.entries(LOOK)) {
      expect(tokens[name], `${name} declared once in :root`).toHaveLength(1);
      expect(tokens[name][0].toLowerCase(), name).toBe(value.toLowerCase());
    }
  });

  it("text pairs meet 4.5:1", () => {
    const text = token("--liem-text");
    const soft = token("--liem-text-soft");
    const gold = token("--liem-gold");
    for (const bg of [token("--liem-card"), token("--liem-note"), PAGE]) {
      expect(contrast(text, bg), `text on ${bg}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(soft, bg), `soft text on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(gold, token("--liem-card")), "gold on card").toBeGreaterThanOrEqual(4.5);
    expect(contrast(gold, token("--liem-badge-bg")), "gold on badge bg").toBeGreaterThanOrEqual(4.5);
    expect(contrast(text, token("--liem-gold-tint")), "text on gold tint").toBeGreaterThanOrEqual(4.5);
  });

  it("start pair matches the Play green", () => {
    const start = token("--liem-start");
    const button = stripComments(read("features", "board", "components", "Button.css"));
    const play = rules(button).find((r) => r.selector === ".button--play");
    const playBg = declarations(play?.body ?? "").find(([p]) => p === "background-color")?.[1];
    expect(playBg?.toLowerCase()).toBe(start.toLowerCase());
    const ratio = contrast(token("--liem-text"), start);
    expect(ratio).toBeGreaterThanOrEqual(3);
    // documented: like today's Play button, it passes only for large or bold text, not 4.5:1
    expect(ratio).toBeLessThan(4.5);
  });

  it("base control styles use only tokens", () => {
    const source = liemCss();
    const all = rules(source);
    const defined = new Set(all.flatMap((r) => [...r.selector.matchAll(/\.([\w-]+)/g)].map((m) => m[1])));
    for (const cls of CONTRACT_CLASSES) expect(defined.has(cls), `.${cls} defined`).toBe(true);

    // no color literals anywhere in the file
    expect(source).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(source).not.toMatch(/\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i);

    for (const { selector, body } of all) {
      for (const [prop, value] of declarations(body)) {
        if (!COLOR_PROPS.test(prop)) continue;
        if (COLOR_KEYWORDS.test(value)) continue;
        expect(value, `${selector} { ${prop} } uses a token`).toMatch(/var\(--/);
      }
    }

    // the stylesheet is loaded by the app
    expect(read("index.tsx")).toMatch(/import\s+["']\.\/styles\/liem\.css["']/);
  });

  it("red is never a text color", () => {
    for (const { selector, body } of rules(liemCss())) {
      for (const [prop, value] of declarations(body)) {
        if (prop === "color" || prop === "-webkit-text-fill-color") {
          expect(value, `${selector} { ${prop} }`).not.toMatch(/--liem-red/);
        }
      }
    }
  });

  it("selected tab and tile follow the Look", () => {
    const all = rules(liemCss());
    const body = (sel: string) =>
      declarations(all.filter((r) => r.selector.split(",").map((s) => s.trim()).includes(sel)).map((r) => r.body).join(";"));
    const tab = body('.liem-tab[aria-selected="true"]');
    expect(tab).toContainEqual(["color", "var(--liem-text)"]);
    expect(tab.find(([p]) => p === "border-bottom-color")?.[1]).toBe("var(--liem-red)");
    const tile = body('.liem-tile[aria-checked="true"]');
    expect(tile).toContainEqual(["border-color", "var(--liem-gold)"]);
    expect(tile).toContainEqual(["background-color", "var(--liem-gold-tint)"]);
    expect(body(".liem-dimmed")).toContainEqual(["filter", "brightness(0.45)"]);
  });

  it("type sizes follow the Look", () => {
    const all = rules(liemCss());
    const font = (sel: string) => {
      const d = declarations(all.filter((r) => r.selector === sel).map((r) => r.body).join(";"));
      return {
        size: d.find(([p]) => p === "font-size")?.[1],
        weight: d.find(([p]) => p === "font-weight")?.[1],
      };
    };
    expect(font(".liem-card__title")).toEqual({ size: "22px", weight: "700" });
    expect(font(".liem-elo")).toEqual({ size: "28px", weight: "700" });
    expect(font(".liem-tab")).toEqual({ size: "16px", weight: "700" });
    expect(font(".liem-card__sub")).toEqual({ size: "16px", weight: "500" });
    expect(font(".liem-note__count").size).toBe("15px");
    expect(font(".liem-badge").size).toBe("14px");
  });

  it("controls get the focus ring and no browser defaults", () => {
    const all = rules(liemCss());
    const focus = all.filter((r) => /:focus-visible/.test(r.selector));
    for (const cls of [".liem-tab", ".liem-tile", ".liem-step"]) {
      const rule = focus.find((r) => r.selector.split(",").some((s) => s.trim() === `${cls}:focus-visible`));
      expect(rule, `${cls}:focus-visible`).toBeDefined();
      expect(declarations(rule!.body)).toContainEqual(["outline", "3px solid var(--board-focus)"]);
    }
    for (const cls of [".liem-tab", ".liem-tile", ".liem-step"]) {
      const d = declarations(all.filter((r) => r.selector.split(",").some((s) => s.trim() === cls)).map((r) => r.body).join(";"));
      expect(d, `${cls} resets appearance`).toContainEqual(["appearance", "none"]);
      expect(d.find(([p]) => p === "font")?.[1] ?? d.find(([p]) => p === "font-family")?.[1], `${cls} font`).toMatch(
        /inherit|Quicksand/
      );
    }
  });
});
