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

  it("two players is a full-width 48 px button", () => {
    const button = declsFor(css(), ".home__two-players");
    expect(last(button, "width")).toBe("100%");
    expect(last(button, "min-height")).toBe("48px");
    expect(last(button, "margin-top")).toBe("var(--space-3)");
    // The same box as Play above it.
    const play = declsFor(css(), ".home__play");
    expect(last(play, "width")).toBe("100%");
    expect(last(play, "min-height")).toBe("48px");
    // It keeps the secondary .button look: no fill, color or border of its own.
    for (const [prop] of button) {
      expect(prop, `.home__two-players { ${prop} }`).not.toMatch(/^(color|background|border|text-decoration)/);
    }
    // The old link is gone.
    expect(css()).not.toMatch(/\.home__alt/);
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
