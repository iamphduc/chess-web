import { describe, expect, it } from "vitest";

import { declsFor, last, lookViolations, readCss, rules } from "./look-helpers";

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
});
