import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  SRC,
  contrast,
  cssFiles,
  declarations,
  declsFor,
  hue,
  hueGap,
  last,
  lookViolations,
  readCss,
  rootTokens,
  rules,
  stripComments,
  token,
} from "./look-helpers";

// Plan ui-refresh, ## Look: the scorebook palette set in Quicksand.

const LOOK: Record<string, string> = {
  "--bg": "#F4EFE4",
  "--surface": "#FBF8F1",
  "--surface-2": "#EFE8D8",
  "--line": "#DCD2BD",
  "--ink": "#1E1B16",
  "--soft": "#6B6457",
  "--accent": "#A8322B",
  "--gold": "#B8860B",
  "--go": "#1E1B16",
  "--go-ink": "#FBF8F1",
  "--board-light": "#F0E3C8",
  "--board-dark": "#B98B5E",
  "--space-1": "4px",
  "--space-2": "8px",
  "--space-3": "12px",
  "--space-4": "16px",
  "--space-5": "24px",
  "--space-6": "32px",
  "--radius": "4px",
  "--text-hero": "30px",
  "--text-title": "20px",
  "--text-body": "16px",
  "--text-small": "14px",
  "--font": '"Quicksand", sans-serif',
  // plan ui-polish ## Look: the game-over scrim is --ink at 40 %
  "--game-over-scrim": "rgba(30, 27, 22, 0.4)",
};

// The grade colors on the day the plan started, tuned for the old dark panels.
const TODAYS_GRADES: Record<string, string> = {
  inaccuracy: "#6CB4EE",
  mistake: "#FF9F43",
  blunder: "#FF7A70",
  best: "#4CC38A",
  book: "#BBBE64",
};

const lookCssPath = join(SRC, "styles", "look.css");
const lookCss = () => {
  expect(existsSync(lookCssPath), "src/styles/look.css exists").toBe(true);
  return stripComments(readFileSync(lookCssPath, "utf8"));
};
const buttonCss = () => readCss("features", "board", "components", "Button.css");

// A value with every var(--x) swapped for its :root token, so `var(--space-4)` reads as 16px.
const resolve = (value: string | undefined) =>
  value?.replace(/var\((--[\w-]+)\)/g, (_, name: string) => token(name)).replace(/\s+/g, " ").trim();

describe("look", () => {
  it("tokens have the Look values", () => {
    const tokens = rootTokens();
    for (const [name, value] of Object.entries(LOOK)) {
      expect(tokens[name], `${name} declared once in :root`).toHaveLength(1);
      expect(tokens[name][0].toLowerCase(), name).toBe(value.toLowerCase());
    }
    // the page itself uses them
    const body = declsFor(readCss("index.css"), "body");
    expect(last(body, "background-color") ?? last(body, "background")).toBe("var(--bg)");
    expect(last(body, "color")).toBe("var(--ink)");
    expect(last(body, "font-family")).toBe("var(--font)");
    expect(last(body, "font-size")).toBe("var(--text-body)");
  });

  it("the page has no margin, so nothing scrolls when it fits and the top bar runs edge to edge", () => {
    const body = declsFor(readCss("index.css"), "body");
    expect(last(body, "margin")).toBe("0");
  });

  it("text pairs meet 4.5:1", () => {
    for (const fg of ["--ink", "--soft"]) {
      for (const bg of ["--bg", "--surface", "--surface-2"]) {
        expect(contrast(token(fg), token(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(contrast(token("--go-ink"), token("--go")), "--go-ink on --go").toBeGreaterThanOrEqual(4.5);
    // plan ui-polish: Resign's Confirm is red ink on the card, the game-over reason is soft on the card
    expect(contrast(token("--accent"), token("--surface")), "--accent on --surface").toBeGreaterThanOrEqual(4.5);
    expect(contrast(token("--soft"), token("--surface")), "--soft on --surface").toBeGreaterThanOrEqual(4.5);
  });

  it("grades are retuned for cream", () => {
    for (const [grade, today] of Object.entries(TODAYS_GRADES)) {
      const value = token(`--grade-${grade}`);
      expect(contrast(value, token("--surface")), `${grade} on --surface`).toBeGreaterThanOrEqual(4.5);
      const onRaised = contrast(value, token("--surface-2"));
      expect(onRaised, `${grade} on --surface-2`).toBeGreaterThanOrEqual(4.5);
      // darkened just enough: not far past the line
      expect(onRaised, `${grade} on --surface-2`).toBeLessThan(5.5);
      expect(hueGap(hue(value), hue(today)), `${grade} keeps its hue`).toBeLessThanOrEqual(10);
      expect(contrast(token("--grade-ink"), value), `--grade-ink on ${grade}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(token("--grade-ink").toLowerCase(), "--grade-ink is the card color").toBe(token("--surface").toLowerCase());
  });

  it("ochre is never text", () => {
    const TEXT_PROPS = /^(color|-webkit-text-fill-color|caret-color)$/;
    const files = cssFiles();
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      for (const { selector, body } of rules(readFileSync(file, "utf8"))) {
        for (const [prop, value] of declarations(body)) {
          if (!TEXT_PROPS.test(prop)) continue;
          expect(value, `${file}: ${selector} { ${prop} }`).not.toMatch(/var\(--gold\)/);
        }
      }
    }
  });

  it("card style", () => {
    const css = lookCss();
    const card = declsFor(css, ".card");
    expect(last(card, "background-color") ?? last(card, "background")).toBe("var(--surface)");
    expect(resolve(last(card, "padding"))).toBe("16px");
    expect(resolve(last(card, "border"))?.toLowerCase()).toBe(`1px solid ${token("--line")}`.toLowerCase());
    expect(resolve(last(card, "border-radius"))).toBe("4px");

    expect(resolve(last(declsFor(css, ".card--flush"), "padding"))).toBe("0");
    expect(declsFor(css, ".card__head").length, ".card__head defined").toBeGreaterThan(0);

    const foot = declsFor(css, ".card__foot");
    expect(last(foot, "display")).toBe("flex");
    expect(resolve(last(foot, "gap"))).toBe("8px");
    expect(resolve(last(foot, "border-top"))?.toLowerCase()).toBe(`1px solid ${token("--line")}`.toLowerCase());

    const stack = declsFor(css, ".stack");
    expect(last(stack, "display")).toBe("flex");
    expect(last(stack, "flex-direction")).toBe("column");
    expect(resolve(last(stack, "gap"))).toBe("12px");

    // loaded by the app, after the tokens
    const entry = readFileSync(join(SRC, "index.tsx"), "utf8");
    expect(entry).toMatch(/import\s+["']\.\/styles\/look\.css["']/);
    expect(entry.indexOf("./styles/look.css")).toBeGreaterThan(entry.indexOf("./index.css"));
  });

  it("scoresheet style", () => {
    const css = lookCss();
    const alternate = rules(css).filter((r) => /^\.scoresheet__row:nth-child\((even|2n)\)$/.test(r.selector));
    expect(alternate, "alternate rows").toHaveLength(1);
    const alt = declarations(alternate[0].body);
    expect(last(alt, "background-color") ?? last(alt, "background")).toBe("var(--surface-2)");
    expect(last(declsFor(css, ".scoresheet__num"), "color")).toBe("var(--soft)");
    const current = declsFor(css, ".scoresheet__current");
    expect(last(current, "background-color")).toBe("var(--ink)");
    expect(last(current, "color")).toBe("var(--bg)");
    expect(contrast(token("--bg"), token("--ink"))).toBeGreaterThanOrEqual(4.5);
    expect(last(declsFor(css, ".scoresheet__mark"), "color")).toBe("var(--accent)");
  });

  it("every control shows the focus ring", () => {
    const css = lookCss();
    const ring = rules(css).find((r) => {
      const parts = r.selector.replace(/^:where\((.*)\)$/s, "$1").split(",").map((s) => s.trim());
      return ["button:focus-visible", "a:focus-visible", '[role="radio"]:focus-visible'].every((p) =>
        parts.includes(p)
      );
    });
    expect(ring, "a :focus-visible rule for button, a and [role=radio]").toBeDefined();
    const d = declarations(ring!.body);
    expect(last(d, "outline")).toBe("3px solid var(--board-focus)");
    expect(token("--board-focus").toLowerCase()).toBe(token("--ink").toLowerCase());
    for (const bg of ["--bg", "--surface", "--surface-2"]) {
      expect(contrast(token("--board-focus"), token(bg)), `ring on ${bg}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("look helper finds violations", () => {
    expect(lookViolations(".a { color: #A8322B; }")).toHaveLength(1);
    expect(lookViolations(".a { background: rgba(0, 0, 0, 0.5); }")).toHaveLength(1);
    expect(lookViolations(".a { background-image: linear-gradient(var(--bg), var(--ink)); }")).toHaveLength(1);
    expect(lookViolations(".a { font-size: 13px; }")).toHaveLength(1);
    expect(lookViolations(".a { font-size: 0.8rem; }")).toHaveLength(1);
    expect(lookViolations(".a { font: 700 12px/20px var(--font); }")).toHaveLength(1);
    expect(lookViolations("@media (max-width: 767px) { .a { color: hsl(0, 0%, 0%); } }")).toHaveLength(1);
    // token-only rules pass, and so do the no-color keywords and an id selector
    expect(
      lookViolations(
        "#root .a { color: var(--ink); background: transparent; border: 1px solid currentColor; " +
          "fill: inherit; font-size: 14px; font: 500 var(--text-small)/20px var(--font); }"
      )
    ).toEqual([]);
    // the two base stylesheets are clean
    expect(lookViolations(lookCss()), "look.css").toEqual([]);
    expect(lookViolations(buttonCss()), "Button.css").toEqual([]);
  });
});
