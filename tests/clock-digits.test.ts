import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { advanceWidths } from "./font-metrics";
import { declsFor, last, readCss, SRC, token } from "./look-helpers";

// The running clock's digits must hold still (plan ui-polish, Scope "Clocks"). The self-hosted
// Quicksand has no tabular figures, so `tabular-nums` does nothing: "1" is 0.39 em and "0" 0.61 em.
// Each digit sits in its own fixed cell instead, at least as wide as the widest digit.

const FONT_700 = join(SRC, "assets", "fonts", "quicksand-latin-700-normal.woff2");
const DIGITS = "0123456789";
const css = () => readCss("features", "board", "components", "Player.css");

/** A width in em from a declaration such as `0.62em`; NaN for anything else. */
const em = (value: string | undefined) => {
  const m = value?.trim().match(/^([\d.]+)em$/);
  return m ? Number(m[1]) : NaN;
};

describe("clock digits", () => {
  const widths = advanceWidths(FONT_700, `${DIGITS}:.`);

  it("the font's digits really differ in width", () => {
    // If this fails the font gained tabular figures, and the cells could go.
    const digit = DIGITS.split("").map((d) => widths[d]);
    expect(Math.max(...digit) - Math.min(...digit)).toBeGreaterThan(0.1);
  });

  it("each digit gets a fixed cell as wide as the widest digit", () => {
    const cell = declsFor(css(), ".player__timer-digit");
    expect(last(cell, "display")).toBe("inline-block");
    expect(last(cell, "text-align")).toBe("center");
    const width = em(last(cell, "width"));
    const widest = Math.max(...DIGITS.split("").map((d) => widths[d]));
    expect(width).toBeGreaterThanOrEqual(widest);
    expect(width).toBeLessThan(widest + 0.05); // no wide gaps between the digits
  });

  it("the colon and the tenths dot get one fixed cell", () => {
    const cell = declsFor(css(), ".player__timer-sep");
    expect(last(cell, "display")).toBe("inline-block");
    expect(last(cell, "text-align")).toBe("center");
    expect(em(last(cell, "width"))).toBeGreaterThanOrEqual(Math.max(widths[":"], widths["."]));
  });

  it("10:00 fits the 112 px pill", () => {
    const digit = em(last(declsFor(css(), ".player__timer-digit"), "width"));
    const sep = em(last(declsFor(css(), ".player__timer-sep"), "width"));
    const px = (name: string) => Number(token(name).replace(/px$/, ""));
    const fontPx = px("--text-title");
    // Padding (12 px a side), the 1 em icon and the 8 px gap, then four digits and the colon.
    const used = 2 * px("--space-3") + fontPx + px("--space-2") + (4 * digit + sep) * fontPx;
    expect(used).toBeLessThanOrEqual(112);
  });
});
