import { describe, expect, it } from "vitest";

import { declsFor, last, lookViolations, readCss, rules } from "./look-helpers";

const css = () => readCss("features", "home", "Home.css");

describe("home css", () => {
  it("home follows the Look", () => {
    expect(lookViolations(css())).toEqual([]);
    // One centred column, at most 480px wide.
    const home = declsFor(css(), ".home");
    expect(last(home, "max-width")).toBe("480px");
    expect(last(home, "margin")).toMatch(/^(0 auto|var\(--space-\d\) auto)$/);
    // No width or min-width that could push a 375px phone into a sideways scroll.
    for (const { body } of rules(css())) {
      for (const m of body.matchAll(/(?:^|;)\s*(min-width|width)\s*:\s*(\d+)px/g)) {
        expect(Number(m[2]), `${m[1]}: ${m[2]}px`).toBeLessThanOrEqual(343);
      }
    }
  });

  it("only the Look's spacing and type tokens", () => {
    for (const { selector, body } of rules(css())) {
      for (const m of body.matchAll(/(?:^|;)\s*(gap|margin[\w-]*|padding[\w-]*|font-size)\s*:\s*([^;]+)/g)) {
        const raw = m[2].replace(/var\(--[\w-]+\)/g, "").replace(/\b0\b|auto/g, "").trim();
        expect(raw, `${selector} { ${m[1]}: ${m[2]} }`).toBe("");
      }
    }
  });
});
