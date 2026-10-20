import { describe, expect, it } from "vitest";

import { declsFor, last, lookViolations, readCss, rules } from "./look-helpers";

/** The bodies of the `@media` blocks in `source` whose query matches `query`. */
function media(source: string, query: RegExp): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(/@media([^{]*)\{/g)) {
    if (!query.test(m[1])) continue;
    let depth = 1;
    let i = m.index! + m[0].length;
    const start = i;
    for (; i < source.length && depth > 0; i++) {
      if (source[i] === "{") depth++;
      if (source[i] === "}") depth--;
    }
    out.push(source.slice(start, i - 1));
  }
  return out;
}

const css = () => readCss("features", "board", "components", "ResignButton.css");
const CONFIRM = '.resign-button[data-confirm="true"]';

describe("resign button css", () => {
  it("resign keeps one width", () => {
    const source = css();
    const base = declsFor(source, ".resign-button");
    expect(last(base, "width")).toBe("104px");
    expect(last(base, "white-space")).toBe("nowrap");
    // It never grows or shrinks in the foot's row.
    expect(last(base, "flex")).toBe("none");

    // The confirm rule only recolors: no width, padding, border width or font change.
    const confirm = declsFor(source, CONFIRM);
    expect(confirm.map(([p]) => p).sort()).toEqual(["border-color", "color"]);
    expect(last(confirm, "color")).toBe("var(--accent)");
    expect(last(confirm, "border-color")).toBe("var(--accent)");
    // No confirm rule (hover included) changes the box.
    for (const { selector, body } of rules(source)) {
      if (!selector.includes("data-confirm")) continue;
      expect({ selector, box: /width|padding|font|margin|border-width|border:/.test(body) }).toEqual({
        selector,
        box: false,
      });
    }

    expect(lookViolations(source)).toEqual([]);
    // Every color is a token.
    for (const { body } of rules(source)) {
      for (const m of body.matchAll(/(?:^|;)\s*(color|border-color|background(?:-color)?)\s*:\s*([^;]+)/g)) {
        expect(m[2].trim()).toMatch(/^var\(--[\w-]+\)$/);
      }
    }
  });

  it("every foot fits one row from 992 px", () => {
    // The sidebar is 380 px there, 346 px inside the foot. Review game (138) + New game (116)
    // + Flip and Sound (88) + two 8 px gaps is 358 px at 16 px button sides, so it wrapped;
    // at 12 px it's 342. The row also stops wrapping, so a wider font spills into the
    // foot's 16 px sides rather than onto a second line.
    const source = readCss("features", "board", "components", "BoardSidebar.css");
    const wide = media(source, /min-width:\s*992px/).join(" ");
    expect(wide).not.toBe("");
    expect(last(declsFor(wide, ".moves-card .card__foot"), "flex-wrap")).toBe("nowrap");
    const text = ".moves-card .card__foot > .button:not(.button--icon):not(.resign-button)";
    expect(last(declsFor(wide, text), "padding-inline")).toBe("var(--space-3)");
    expect(lookViolations(source)).toEqual([]);
  });
});
