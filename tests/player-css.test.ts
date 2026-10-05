import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = () =>
  readFileSync(
    join(__dirname, "..", "src", "features", "board", "components", "Player.css"),
    "utf8"
  ).replace(/\/\*[\s\S]*?\*\//g, "");

interface Rule {
  selector: string;
  body: string;
  media: string | null;
}

// Top-level rules, plus rules one level inside @media blocks.
function rules(source: string): Rule[] {
  const out: Rule[] = [];
  const readRules = (text: string, media: string | null) => {
    for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      out.push({ selector: m[1].trim(), body: m[2], media });
    }
  };
  let i = 0;
  while (i < source.length) {
    const at = source.indexOf("@media", i);
    if (at === -1) {
      readRules(source.slice(i), null);
      break;
    }
    readRules(source.slice(i, at), null);
    const open = source.indexOf("{", at);
    const query = source.slice(at, open).trim();
    let depth = 1;
    let j = open + 1;
    while (j < source.length && depth > 0) {
      if (source[j] === "{") depth++;
      if (source[j] === "}") depth--;
      j++;
    }
    readRules(source.slice(open + 1, j - 1), query);
    i = j;
  }
  return out;
}

const isClockRule = (r: Rule) => /\.player__time|\.player__timer|\.clock-icon/.test(r.selector);

describe("Player.css", () => {
  it("clock styles use only the tokens", () => {
    const clock = rules(css()).filter(isClockRule);
    expect(clock.length).toBeGreaterThan(0);
    for (const r of clock) {
      expect(r.body, r.selector).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(r.body, r.selector).not.toMatch(/\b(rgba?|hsla?)\s*\(/i);
      for (const v of r.body.matchAll(/var\((--[\w-]+)/g)) {
        expect(v[1], r.selector).toMatch(/^--clock-/);
      }
    }
    const top = (sel: RegExp) => clock.find((r) => sel.test(r.selector) && r.media === null);
    const waiting = top(/^\.player__time$/);
    expect(waiting?.body).toMatch(/background-color:\s*var\(--clock-waiting-bg\)/);
    expect(waiting?.body).toMatch(/(^|[\s;])color:\s*var\(--clock-waiting-ink\)/);
    const running = top(/^\.player__time--running$/);
    expect(running?.body).toMatch(/background-color:\s*var\(--clock-running-bg\)/);
    expect(running?.body).toMatch(/(^|[\s;])color:\s*var\(--clock-running-ink\)/);
    const low = top(/\.player__time--low/);
    expect(low?.body).toMatch(/background-color:\s*var\(--clock-low-bg\)/);
    expect(low?.body).toMatch(/(^|[\s;])color:\s*var\(--clock-low-ink\)/);
  });

  it("hand jumps crisply and stays still with reduced motion", () => {
    const all = rules(css());
    const timer = all.find((r) => r.selector === ".player__timer" && r.media === null);
    expect(timer?.body).toMatch(/font-variant-numeric:\s*tabular-nums/);
    expect(timer?.body).toMatch(/font-weight:\s*700/);

    const hand = all.filter((r) => /\.clock-icon__hand/.test(r.selector));
    expect(hand.length).toBeGreaterThan(0);
    for (const r of hand) {
      expect(r.body, r.selector).not.toMatch(/transition|animation/);
    }
    expect(css()).not.toMatch(/@keyframes/);

    const still = all.find(
      (r) =>
        r.media !== null &&
        /prefers-reduced-motion:\s*reduce/.test(r.media) &&
        /\.clock-icon__hand/.test(r.selector)
    );
    expect(still?.body).toMatch(/transform:\s*none\s*!important/);
  });
});
