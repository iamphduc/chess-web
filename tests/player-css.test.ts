import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { lookViolations } from "./look-helpers";

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

/** Every top-level body for `selector`, joined. */
const bodyOf = (all: Rule[], selector: string) =>
  all
    .filter((r) => r.selector === selector && r.media === null)
    .map((r) => r.body)
    .join(";");

describe("Player.css", () => {
  it("clock styles use only the tokens", () => {
    const clock = rules(css()).filter(isClockRule);
    expect(clock.length).toBeGreaterThan(0);
    for (const r of clock) {
      expect(lookViolations(`${r.selector}{${r.body}}`), r.selector).toEqual([]);
      // Colors come only from the --clock-* tokens; sizes from the Look's space, radius and type.
      for (const v of r.body.matchAll(/var\((--[\w-]+)/g)) {
        expect(v[1], r.selector).toMatch(/^--(clock-|space-|radius$|text-)/);
      }
      for (const d of r.body.matchAll(/(?:^|;)\s*(color|background-color|fill|stroke)\s*:\s*([^;]+)/g)) {
        expect(d[2].trim(), `${r.selector} { ${d[1]} }`).toMatch(/^(var\(--clock-[\w-]+\)|currentColor|none)$/);
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
    // The Look's pill: its corner, and tabular figures so the digits don't shift.
    expect(waiting?.body).toMatch(/border-radius:\s*var\(--radius\)/);
    expect(top(/^\.player__timer$/)?.body).toMatch(/font-variant-numeric:\s*tabular-nums/);
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

  it("clock keeps one width", () => {
    const all = rules(css());
    const box = bodyOf(all, ".player__time");
    // A fixed box (the draft's 112 px), so 10:00, 09:59, 0:59 and the tenths never move it.
    expect(box).toMatch(/(^|[\s;])width:\s*112px/);
    expect(box).toMatch(/(^|[\s;])flex:\s*none/);
    expect(box).toMatch(/font-variant-numeric:\s*tabular-nums/);
    expect(box).not.toMatch(/min-width|max-width/);
    expect(bodyOf(all, ".player__timer")).toMatch(/font-variant-numeric:\s*tabular-nums/);
    // No rule elsewhere (a phone query, a state) changes its width. The digit cells inside it
    // have fixed widths of their own, checked against the font in tests/clock-digits.test.ts.
    const cell = /^\.player__timer-(digit|sep)$/;
    for (const r of all.filter((x) => /\.player__time/.test(x.selector) && x.selector !== ".player__time" && !cell.test(x.selector))) {
      expect(r.body, r.selector).not.toMatch(/(^|[\s;])(min-|max-)?width\s*:/);
    }
  });

  it("the material line never cuts +N", () => {
    const all = rules(css());
    const material = bodyOf(all, ".player__material");
    expect(material).toMatch(/(^|[\s;])color:\s*var\(--soft\)/);
    expect(material).toMatch(/font-size:\s*var\(--text-small\)/);
    // Every flex box from the card down to the glyphs may shrink below its content
    // (min-width: 0); one that can't keeps the glyphs whole, so their ellipsis never applies
    // and "+N" or the detail is pushed past the line's end, under the clock.
    for (const box of [".player__info", ".player__text", ".player__sub", ".player__material", ".player__captured"]) {
      expect(bodyOf(all, box), box).toMatch(/(^|[\s;])min-width:\s*0(;|\s|$)/);
    }
    // The material box doesn't clip, so "+N" is never cut even when the line is tight.
    expect(material).not.toMatch(/overflow\s*:\s*(hidden|clip)/);
    const plus = bodyOf(all, ".player__advantage");
    expect(plus).toMatch(/flex-shrink:\s*0/);
    expect(plus).toMatch(/white-space:\s*nowrap/);
    const glyphs = bodyOf(all, ".player__captured");
    expect(glyphs).toMatch(/overflow:\s*hidden/);
    expect(glyphs).toMatch(/text-overflow:\s*ellipsis/);
    expect(glyphs).toMatch(/white-space:\s*nowrap/);
    expect(glyphs).toMatch(/min-width:\s*0/);
    // His detail ("★ Book · N", "Thinking…") is never cut or wrapped either, and sits at the line's end.
    const detail = bodyOf(all, ".player__detail");
    expect(detail).toMatch(/flex:\s*none/);
    expect(detail).toMatch(/white-space:\s*nowrap/);
    expect(detail).toMatch(/margin-left:\s*auto/);
  });

  it("the row follows option C", () => {
    const all = rules(css());
    const row = bodyOf(all, ".player");
    // 16 px from the name side to the clock, 8 px above and below.
    expect(row).toMatch(/(^|[\s;])gap:\s*var\(--space-4\)/);
    expect(row).toMatch(/(^|[\s;])padding:\s*var\(--space-2\) 0(;|\s|$)/);
    // 12 px from the avatar to the name.
    expect(bodyOf(all, ".player__info")).toMatch(/(^|[\s;])gap:\s*var\(--space-3\)/);
    // No other rule (a phone query, a state) changes the row's gap or padding.
    for (const r of all.filter((x) => /^\.player(__info)?$/.test(x.selector) && x.media !== null)) {
      expect(r.body, `${r.media} ${r.selector}`).not.toMatch(/(^|[\s;])(gap|padding)\s*:/);
    }
  });

  it("avatars are 4 px squares", () => {
    const all = rules(css());
    for (const sel of [".player__disc", ".player__avatar"]) {
      const body = bodyOf(all, sel);
      expect(body, sel).toMatch(/border-radius:\s*var\(--radius\)/);
      expect(body, sel).toMatch(/(^|[\s;])width:\s*40px/);
      expect(body, sel).toMatch(/(^|[\s;])height:\s*40px/);
      expect(body, sel).not.toMatch(/50%/);
    }
    // No round corner is left anywhere in the card (the clock hand's 50% origin is not a corner).
    for (const r of all) {
      expect(r.body, r.selector).not.toMatch(/border-radius:\s*50%/);
    }
  });

  it("the second line sits 4 px under the name in a 60 px card", () => {
    const all = rules(css());
    const text = bodyOf(all, ".player__text");
    expect(text).toMatch(/flex-direction:\s*column/);
    expect(text).toMatch(/gap:\s*var\(--space-1\)/); // 4 px
    expect(text).toMatch(/min-width:\s*0/);
    // One reserved height, so the name line stays put when the material line appears.
    expect(text).toMatch(/(^|[\s;])height:\s*44px/);
    expect(bodyOf(all, ".player__sub")).toMatch(/display:\s*flex/);
    // The material box is the second line's own height (20 px), so its top is the 4 px gap.
    expect(bodyOf(all, ".player__sub")).toMatch(/(^|[\s;])height:\s*var\(--text-title\)/);
    const material = bodyOf(all, ".player__material");
    expect(material).toMatch(/align-self:\s*stretch/);
    expect(material).toMatch(/line-height:\s*1(;|\s|$)/);
    const card = bodyOf(all, ".board > .player");
    expect(card).toMatch(/(^|[\s;])height:\s*60px/);
    expect(card).toMatch(/box-sizing:\s*border-box/);
    // The two lines plus the gap fit inside the card's padding: 19.2 + 4 + 20 <= 60 - 2 * padding.
    const pad = bodyOf(all, ".player").match(/padding:\s*var\(--space-(\d)\)/);
    expect(pad).not.toBeNull();
    const px = [0, 4, 8, 12, 16, 24, 32][Number(pad![1])];
    expect(px).toBe(8);
    expect(Math.ceil(16 * 1.2) + 4 + 20).toBeLessThanOrEqual(60 - 2 * px);
  });
});
