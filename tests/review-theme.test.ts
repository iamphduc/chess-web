import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { lookViolations, readCss, rules as lookRules } from "./look-helpers";

// The game-review look (plan post-game-review, ## Look): the grade and review
// tokens in src/index.css and the base classes in src/styles/review.css.

const SRC = join(__dirname, "..", "src");
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), "utf8");
const indexCss = () => stripComments(read("index.css"));
const reviewCssPath = join(SRC, "styles", "review.css");
const reviewCss = () => {
  expect(existsSync(reviewCssPath), "src/styles/review.css exists").toBe(true);
  return stripComments(readFileSync(reviewCssPath, "utf8"));
};

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

// Top-level rules (selector -> body). Bodies have no nested braces.
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

// Declarations of every rule that names `selector` (alone or in a comma list), in order.
function declsFor(source: string, selector: string): [string, string][] {
  return declarations(
    rules(source)
      .filter((r) => r.selector.split(",").map((s) => s.trim()).includes(selector))
      .map((r) => r.body)
      .join(";")
  );
}

// The last value set for a property: what wins in the cascade for that selector.
const last = (d: [string, string][], prop: string) => [...d].reverse().find(([p]) => p === prop)?.[1];

// The token a `var(--x)` value names.
const tokenOf = (value: string | undefined) => value?.match(/^var\((--[\w-]+)\)$/)?.[1];

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

/** A font size in px: a number, or a --text-* token. */
const sizePx = (v: string) => {
  const t = v.match(/^var\((--text-[\w-]+)\)$/);
  return parseFloat(t ? token(t[1]) : v);
};

const GRADES = ["inaccuracy", "mistake", "blunder", "best", "book"] as const;

// Grades retuned for cream (plan ui-refresh, ## Look): each is the old hue, darkened to reach
// 4.5:1 on --surface and --surface-2. --grade-ink is the --surface cream.
const LOOK: Record<string, string> = {
  "--grade-inaccuracy": "#146AB0",
  "--grade-mistake": "#A45000",
  "--grade-blunder": "#CF0F00",
  "--grade-best": "#27744F",
  "--grade-book": "#686A2D",
  "--grade-ink": "#FBF8F1",
};

const CONTRACT_CLASSES = [
  "review-card",
  "review-card--red",
  "review-card--gold",
  "review-card--olive",
  "review-card__title",
  ...GRADES.map((g) => `review-grade--${g}`),
  ...GRADES.map((g) => `review-chip--${g}`),
  "review-move",
  "review-move--selected",
  "review-star",
  "review-star--found",
  "review-step",
  "review-progress",
  "review-progress__bar",
  "review-accuracy",
  "review-sheet",
  "review-sheet--low",
  "review-sheet__grab",
  "review-sheet__close",
  "review-scrim",
];

const COLOR_PROPS =
  /^(color|background|background-color|border|border-(top|right|bottom|left)(-color)?|border-color|outline|outline-color|box-shadow|text-shadow|fill|stroke|text-decoration(-color)?|caret-color|accent-color|-webkit-text-fill-color)$/;
const NOT_A_COLOR = /^(-?[\d.]+(px|em|rem|%)?|solid|dashed|dotted|inset|none|transparent|currentcolor|inherit|initial|unset)$/i;

describe("review theme", () => {
  it("review tokens have the Look values", () => {
    const tokens = rootTokens(indexCss());
    const review = Object.keys(tokens).filter((n) => n.startsWith("--grade-") || n.startsWith("--review-"));
    expect(review.sort()).toEqual([...Object.keys(LOOK), "--review-scrim"].sort());
    for (const [name, value] of Object.entries(LOOK)) {
      expect(tokens[name], `${name} declared once in :root`).toHaveLength(1);
      expect(tokens[name][0].toLowerCase(), name).toBe(value.toLowerCase());
    }
    // the chip ink is the card color
    expect(token("--grade-ink").toLowerCase()).toBe(token("--surface").toLowerCase());
    // the scrim: black at 35 %
    const scrim = token("--review-scrim").match(/^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/);
    expect(scrim, "--review-scrim is rgba()").not.toBeNull();
    expect(scrim!.slice(1).map(Number)).toEqual([0, 0, 0, 0.35]);
  });

  it("grade text meets 4.5:1 on every surface", () => {
    const surfaces = { card: token("--surface"), raised: token("--surface-2") };
    expect(Object.values(surfaces).map((s) => s.toLowerCase())).toEqual(["#fbf8f1", "#efe8d8"]);
    for (const g of GRADES) {
      for (const [name, bg] of Object.entries(surfaces)) {
        expect(contrast(token(`--grade-${g}`), bg), `${g} on ${name}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    // and each grade's text class paints its own grade token
    const css = reviewCss();
    for (const g of GRADES) {
      expect(tokenOf(last(declsFor(css, `.review-grade--${g}`), "color")), `.review-grade--${g} color`).toBe(`--grade-${g}`);
    }
  });

  it("chips and the selected move meet 4.5:1", () => {
    const css = reviewCss();
    for (const g of GRADES) {
      const d = declsFor(css, `.review-chip--${g}`);
      const ink = tokenOf(last(d, "color"));
      const fill = tokenOf(last(d, "background-color"));
      expect(ink, `.review-chip--${g} ink`).toBe("--grade-ink");
      expect(fill, `.review-chip--${g} fill`).toBe(`--grade-${g}`);
      expect(contrast(token(ink!), token(fill!)), `ink on ${g}`).toBeGreaterThanOrEqual(4.5);
    }

    // a selected move is the scoresheet's ink chip: the cream grade ink on --ink
    const sel = declsFor(css, ".review-move--selected");
    expect(tokenOf(last(sel, "color")), "selected move ink").toBe("--grade-ink");
    expect(tokenOf(last(sel, "background-color")), "selected move fill").toBe("--ink");
    expect(contrast(token("--grade-ink"), token("--ink")), "cream on ink").toBeGreaterThanOrEqual(4.5);

    // its grade mark becomes a chip: ink on the grade color, never grade text on white
    for (const g of GRADES) {
      const mark = declsFor(css, `.review-move--selected .review-grade--${g}`);
      expect(tokenOf(last(mark, "color")), `selected ${g} mark ink`).toBe("--grade-ink");
      expect(tokenOf(last(mark, "background-color")), `selected ${g} mark fill`).toBe(`--grade-${g}`);
    }
  });

  it("review styles use only tokens and red is never text", () => {
    const source = reviewCss();
    const all = rules(source);
    const defined = new Set(all.flatMap((r) => [...r.selector.matchAll(/\.([\w-]+)/g)].map((m) => m[1])));
    for (const cls of CONTRACT_CLASSES) expect(defined.has(cls), `.${cls} defined`).toBe(true);

    expect(source).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(source).not.toMatch(/\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i);
    // no named colors either: every word left in a color property is a size, a style or a no-color keyword
    for (const { selector, body } of all) {
      for (const [prop, value] of declarations(body)) {
        if (!COLOR_PROPS.test(prop)) continue;
        const rest = value.replace(/var\(--[\w-]+\)/g, "").split(/[\s,]+/).filter(Boolean);
        for (const word of rest) expect(word, `${selector} { ${prop}: ${value} }`).toMatch(NOT_A_COLOR);
      }
    }

    // no old token: the review moved to the Look's palette
    expect(source).not.toMatch(/var\(--(dark-|liem-|book-bar|review-page)/);

    // the card edges: red ink on a moment, ochre when found, olive while waiting
    const edge = (sel: string) => {
      const d = declsFor(source, sel);
      return last(d, "border-left-color") ?? last(d, "border-left")?.match(/var\(--[\w-]+\)/)?.[0];
    };
    expect(edge(".review-card--red")).toBe("var(--accent)");
    expect(edge(".review-card--gold")).toBe("var(--gold)");
    expect(edge(".review-card--olive")).toBe("var(--grade-book)");
    // the found star is the shared SVG ★, filled ochre; ochre is never text
    expect(tokenOf(last(declsFor(source, ".review-star--found"), "fill"))).toBe("--gold");
    for (const { selector, body } of all) {
      for (const [prop, value] of declarations(body)) {
        if (/var\(--gold\)/.test(value)) expect(prop, `${selector} { ${prop}: ${value} }`).not.toBe("color");
      }
    }
    expect(tokenOf(last(declsFor(source, ".review-progress__bar"), "background-color"))).toBe("--grade-book");
    expect(tokenOf(last(declsFor(source, ".review-scrim"), "background-color"))).toBe("--review-scrim");
    // the sheet is a cream card with a hairline top
    expect(tokenOf(last(declsFor(source, ".review-sheet"), "background-color"))).toBe("--surface");
    expect(last(declsFor(source, ".review-sheet"), "border-top")).toBe("1px solid var(--line)");

    // the stylesheet is loaded by the app, after the base tokens
    const entry = read("index.tsx");
    expect(entry).toMatch(/import\s+["']\.\/styles\/review\.css["']/);
    expect(entry.indexOf("./styles/review.css")).toBeGreaterThan(entry.indexOf("./index.css"));
  });

  it("type sizes follow the Look", () => {
    const css = reviewCss();
    const font = (sel: string) => {
      const d = declsFor(css, sel);
      return { size: last(d, "font-size"), weight: last(d, "font-weight") };
    };
    expect(font(".review-card__title")).toEqual({ size: "var(--text-title)", weight: "700" });
    // The accuracy line is 16 px ink (plan ui-polish, ## Look): no hero number any more.
    expect(font(".review-accuracy")).toEqual({ size: "var(--text-body)", weight: "700" });
    expect(tokenOf(last(declsFor(css, ".review-accuracy"), "color"))).toBe("--ink");
    expect(font(".review-card")).toEqual({ size: "var(--text-body)", weight: "600" });
    expect(font(".review-move")).toEqual({ size: "var(--text-body)", weight: "600" });
    for (const g of GRADES) {
      const chip = font(`.review-chip--${g}`);
      const base = font(".review-chip");
      const size = sizePx(chip.size ?? base.size ?? "0");
      expect(size, `.review-chip--${g} label size`).toBeGreaterThanOrEqual(14);
      expect(size, `.review-chip--${g} label size`).toBeLessThanOrEqual(15);
      expect(chip.weight ?? base.weight, `.review-chip--${g} weight`).toBe("700");
      expect(font(`.review-grade--${g}`).weight, `.review-grade--${g} mark weight`).toBe("700");
    }
    // Quicksand only: nothing here sets another family
    for (const { selector, body } of rules(css)) {
      for (const [prop, value] of declarations(body)) {
        if (prop === "font-family") expect(value, selector).toMatch(/^(inherit|"?Quicksand"?(,\s*sans-serif)?)$/);
        if (prop === "font") expect(value, selector).toMatch(/^inherit$|Quicksand/);
      }
    }
  });

  it("controls get the focus ring and no browser defaults", () => {
    const css = reviewCss();
    const all = rules(css);
    const focus = all.filter((r) => /:focus-visible/.test(r.selector));
    const CONTROLS = [".review-step", ".review-sheet__close", ".review-sheet__grab", ".review-move"];
    for (const cls of CONTROLS) {
      const rule = focus.find((r) => r.selector.split(",").some((s) => s.trim() === `${cls}:focus-visible`));
      expect(rule, `${cls}:focus-visible`).toBeDefined();
      expect(declarations(rule!.body)).toContainEqual(["outline", "3px solid var(--board-focus)"]);
    }
    for (const cls of CONTROLS) {
      const d = declsFor(css, cls);
      expect(d, `${cls} resets appearance`).toContainEqual(["appearance", "none"]);
      expect(last(d, "margin"), `${cls} resets margin`).toBe("0");
      expect(last(d, "font") ?? last(d, "font-family"), `${cls} font`).toMatch(/inherit|Quicksand/);
      expect(last(d, "cursor"), `${cls} cursor`).toBe("pointer");
      const border = last(d, "border");
      expect(border, `${cls} sets its own border`).toBeDefined();
      const bg = last(d, "background") ?? last(d, "background-color");
      expect(bg, `${cls} sets its own background`).toBeDefined();
    }
    // the step buttons and the close are at least 44 px tap targets
    for (const cls of [".review-step", ".review-sheet__close"]) {
      const d = declsFor(css, cls);
      expect(parseFloat(last(d, "width") ?? last(d, "min-width") ?? "0"), `${cls} width`).toBeGreaterThanOrEqual(44);
      expect(parseFloat(last(d, "height") ?? last(d, "min-height") ?? "0"), `${cls} height`).toBeGreaterThanOrEqual(44);
    }
    // a disabled step is visibly off and not clickable-looking
    const disabled = declsFor(css, ".review-step:disabled");
    expect(last(disabled, "cursor")).toBe("not-allowed");
    expect(parseFloat(last(disabled, "opacity") ?? "1")).toBeLessThan(1);
  });

  it("review follows the Look", () => {
    // Every review stylesheet, plus the board screen's Board.css and App.css.
    const FILES = [
      ["styles", "review.css"],
      ["features", "review", "components", "ReviewGraph.css"],
      ["features", "review", "components", "BottomSheet.css"],
      ["features", "review", "components", "KeyMomentCard.css"],
      ["features", "review", "components", "MoveList.css"],
      ["features", "review", "components", "ReviewBoard.css"],
      ["features", "board", "Board.css"],
      ["features", "board", "components", "TopBar.css"],
      ["App.css"],
    ];
    for (const file of FILES) {
      const name = file.join("/");
      const source = readCss(...file);
      expect({ name, violations: lookViolations(source) }).toEqual({ name, violations: [] });
      expect({ name, old: /var\(--(dark-|liem-|book-bar|review-page|board-sound-on|background\)|text\))/.test(source) }).toEqual({
        name,
        old: false,
      });
      // No rule left for the old graph strip, the side switch, or the old board wrappers.
      const selectors = lookRules(source).map((r) => r.selector).join(",");
      expect({ name, selectors }).not.toEqual({
        name,
        selectors: expect.stringMatching(/\.(review-top|review-graph__sides|review-graph__side|squares__overlay|liem-side|buttons)/),
      });
    }

    // Red ink (--accent) is never text in the review: only the key-moment card's edge.
    for (const file of FILES) {
      for (const { selector, body } of lookRules(readCss(...file))) {
        for (const [prop, value] of declarations(body)) {
          if (/var\(--accent\)/.test(value)) {
            expect(prop, `${file.join("/")} ${selector} { ${prop}: ${value} }`).toMatch(/^border/);
          }
        }
      }
    }

    // The summary card: the accuracy line under the graph, 16 px ink, its marks in grade colors.
    const line = declarations(
      lookRules(readCss("features", "review", "components", "ReviewGraph.css"))
        .filter((r) => r.selector.split(",").map((x) => x.trim()).includes(".review-summary__accuracy"))
        .map((r) => r.body)
        .join(";")
    );
    expect(last(line, "font-size")).toBe("var(--text-body)");
    expect(last(line, "color")).toBe("var(--ink)");
    // The old accuracy card and left-book card rules are gone.
    const moveList = readCss("features", "review", "components", "MoveList.css");
    expect(lookRules(moveList).map((r) => r.selector).join(",")).not.toMatch(/accuracy-panel/);
    // The top bar has no action: Play again is in the review's Moves card foot,
    // so TopBar takes no action prop and no stylesheet keeps `.top-bar__action`.
    expect(readCss("features", "board", "Board.css")).not.toMatch(/top-bar__action/);
    expect(readCss("features", "board", "components", "TopBar.css")).not.toMatch(/top-bar__action/);
    expect(read("features", "board", "components", "TopBar.tsx")).not.toMatch(/action/);

    // At 375 px "Review · vs Medium" (149 px at 16 px) fits beside ← Home:
    // below 768 px the bar's gap and the Home button's sides are 8 px and the title is 14 px.
    const topBarCss = readCss("features", "board", "components", "TopBar.css");
    const phone = /@media[^{]*max-width:\s*767px[^{]*\{([\s\S]*?)\n\}/.exec(topBarCss)?.[1] ?? "";
    const inPhone = (sel: string) =>
      declarations(
        lookRules(phone)
          .filter((r) => r.selector.split(",").map((x) => x.trim()).includes(sel))
          .map((r) => r.body)
          .join(";")
      );
    expect(last(inPhone(".top-bar"), "gap")).toBe("var(--space-2)");
    expect(last(inPhone(".top-bar__title"), "font-size")).toBe("var(--text-small)");
    expect(last(inPhone(".top-bar__home"), "padding")).toBe("var(--space-2)");

    // The graph plot is 80 px tall, on a phone too.
    const graph = readCss("features", "review", "components", "ReviewGraph.css");
    const heights = lookRules(graph)
      .filter((r) => r.selector.split(",").map((x) => x.trim()).includes(".review-graph__plot"))
      .flatMap((r) => declarations(r.body).filter(([p]) => p === "height").map(([, v]) => v));
    expect(heights).toEqual(["80px"]);
  });
});
