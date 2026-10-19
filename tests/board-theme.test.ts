import { describe, expect, it } from "vitest";

import { contrast, declarations, last, readCss, rootTokens, rules, token } from "./look-helpers";

const buttonCss = () => readCss("features", "board", "components", "Button.css");

// The board on wood (plan ui-refresh, ## Look).
const BOARD: Record<string, string> = {
  "--board-light": "#F0E3C8",
  "--board-dark": "#B98B5E",
  "--board-highlight": "rgba(204, 153, 26, 0.5)",
  "--board-hint": "rgba(0, 0, 0, 0.14)",
  "--board-drop-edge": "rgba(255, 255, 255, 0.65)",
  "--board-focus": "#1E1B16",
};

// Declarations of every rule naming exactly `selector` (alone or in a comma list), in order.
const decls = (source: string, selector: string) =>
  declarations(
    rules(source)
      .filter((r) => r.selector.split(",").map((s) => s.trim()).includes(selector))
      .map((r) => r.body)
      .join(";")
  );

// Properties that paint a color.
const COLOR_PROPS =
  /^(color|background|background-color|border|border-(top|right|bottom|left)(-color)?|border-color|outline|outline-color|box-shadow|fill|stroke)$/;

// The color tokens each button class may paint with.
const BUTTON_TOKENS: Record<string, string[]> = {
  ".button": ["--ink", "--line", "--surface-2"],
  ".button--play": ["--go", "--go-ink"],
  ".button--icon": ["--surface-2", "--ink", "--line"],
  ".button--sound-on": ["--go", "--go-ink"],
};

describe("board theme", () => {
  it("board tokens have the Look values", () => {
    const tokens = rootTokens();
    const boardNames = Object.keys(tokens).filter((n) => n.startsWith("--board-"));
    // the contract tokens plus the check tint, each declared once in :root
    expect(boardNames.sort()).toEqual([...Object.keys(BOARD), "--board-check"].sort());
    for (const [name, value] of Object.entries(BOARD)) {
      expect(tokens[name], name).toHaveLength(1);
      expect(tokens[name][0].toLowerCase(), name).toBe(value.toLowerCase());
    }
    // the check is a flat red-ink tint: no gradient, the --accent channels at some alpha
    const check = token("--board-check");
    expect(check).not.toMatch(/gradient\(/i);
    const tint = check.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/);
    expect(tint, "--board-check is rgba()").not.toBeNull();
    const accent = token("--accent").match(/^#(..)(..)(..)$/)!.slice(1).map((h) => parseInt(h, 16));
    expect(tint!.slice(1, 4).map(Number)).toEqual(accent);
    const alpha = Number(tint![4]);
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThan(1);
    // the focus ring is the ink
    expect(token("--board-focus").toLowerCase()).toBe(token("--ink").toLowerCase());
  });

  it("focus ring meets 3:1 on the page and the cards", () => {
    for (const bg of ["--bg", "--surface", "--surface-2", "--board-light", "--board-dark"]) {
      expect(contrast(token("--board-focus"), token(bg)), `ring on ${bg}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("buttons follow the Look", () => {
    const css = buttonCss();

    // the secondary button: no browser look, ink text, a line border, Look type and radius
    const base = decls(css, ".button");
    expect(last(base, "appearance"), ".button appearance").toBe("none");
    expect(last(base, "-webkit-appearance"), ".button -webkit-appearance").toBe("none");
    expect(last(base, "margin")).toBe("0");
    expect(last(base, "background-color") ?? last(base, "background")).toBe("transparent");
    expect(last(base, "color")).toBe("var(--ink)");
    expect(last(base, "border")).toBe("1px solid var(--line)");
    expect(last(base, "border-radius")).toBe("var(--radius)");
    expect(last(base, "font-family")).toBe("var(--font)");
    expect(last(base, "font-size")).toBe("var(--text-body)");
    expect(last(base, "font-weight")).toBe("700");
    expect(last(base, "cursor")).toBe("pointer");
    // a link with the class looks the same
    expect(last(base, "text-decoration")).toBe("none");
    expect(last(base, "display")).toBe("inline-flex");
    expect(contrast(token("--ink"), token("--surface"))).toBeGreaterThanOrEqual(4.5);

    // primary: ink fill, cream text
    const play = decls(css, ".button--play");
    expect(last(play, "background-color")).toBe("var(--go)");
    expect(last(play, "color")).toBe("var(--go-ink)");
    expect(last(play, "border-color")).toBe("var(--go)");

    // icon: 40 x 40 on the raised cream
    const icon = decls(css, ".button--icon");
    expect(last(icon, "width")).toBe("40px");
    expect(last(icon, "height")).toBe("40px");
    expect(last(icon, "padding")).toBe("0");
    expect(last(icon, "background-color")).toBe("var(--surface-2)");

    // sound on: the primary pair, no green
    const sound = decls(css, ".button--sound-on");
    expect(last(sound, "background-color")).toBe("var(--go)");
    expect(last(sound, "color")).toBe("var(--go-ink)");
    expect(last(sound, "border-color")).toBe("var(--go)");

    // no modifier brings the browser look back
    for (const cls of Object.keys(BUTTON_TOKENS)) {
      expect(last(decls(css, cls), "appearance") ?? "none", `${cls} appearance`).toBe("none");
    }

    // each class paints only with its own tokens
    for (const r of rules(css)) {
      const owner = Object.keys(BUTTON_TOKENS)
        .filter((cls) => new RegExp(`\\${cls}(?![\\w-])`).test(r.selector))
        .pop();
      if (!owner) continue;
      const allowed = [...BUTTON_TOKENS[owner], ...(owner === ".button" ? [] : BUTTON_TOKENS[".button"])];
      for (const [prop, value] of declarations(r.body)) {
        if (!COLOR_PROPS.test(prop) || prop === "outline" || prop === "outline-color") continue;
        for (const m of value.matchAll(/var\((--[\w-]+)\)/g)) {
          expect(owner === ".button" ? BUTTON_TOKENS[".button"] : allowed, `${r.selector} { ${prop}: ${value} }`).toContain(
            m[1]
          );
        }
      }
    }
    // the old greens are gone
    expect(css).not.toMatch(/--board-sound-on|--dark-|--liem-/);

    // the focus ring
    const focus = rules(css).filter((r) => r.selector.split(",").some((s) => s.trim() === ".button:focus-visible"));
    expect(focus, ".button:focus-visible rule").toHaveLength(1);
    const ring = declarations(focus[0].body);
    expect(last(ring, "outline")).toBe("3px solid var(--board-focus)");
    expect(last(ring, "outline-offset")).toBe("2px");

    // disabled controls are at 0.4
    const disabled = decls(css, ".button:disabled");
    expect(last(disabled, "opacity")).toBe("0.4");
    expect(last(disabled, "cursor")).toBe("not-allowed");
    expect(decls(css, '.button[aria-disabled="true"]')).toEqual(disabled);
  });
});
