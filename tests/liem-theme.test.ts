import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  contrast,
  declarations,
  declsFor,
  last,
  lookViolations,
  readCss,
  rules,
  SRC,
  stripComments,
  token,
} from "./look-helpers";

// His player card and book note in the Look (plan ui-refresh, sprint refresh slice P1).

const FILES = {
  "Player.css": ["features", "board", "components", "Player.css"],
  "Board.css": ["features", "board", "Board.css"],
  "liem.css": ["styles", "liem.css"],
  "BookNote.css": ["features", "liem", "components", "BookNote.css"],
} as const;

const css = (file: keyof typeof FILES) => readCss(...FILES[file]);
const playerCss = () => css("Player.css");
const liemCss = () => css("liem.css");

/** A token's color, following var() links to the hex. */
function resolve(value: string): string {
  const m = value.trim().match(/^var\((--[\w-]+)\)$/);
  return m ? resolve(token(m[1])) : value.trim();
}

/** The `@media` block bodies whose condition matches `when`, joined. */
function mediaBlocks(source: string, when: RegExp): string {
  let out = "";
  for (const m of source.matchAll(/@media([^{]*)\{/g)) {
    if (!when.test(m[1])) continue;
    let depth = 1;
    let i = m.index! + m[0].length;
    const start = i;
    for (; i < source.length && depth > 0; i++) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") depth--;
    }
    out += source.slice(start, i - 1) + "\n";
  }
  return out;
}

/** The source with every `@media` block taken out. */
function outsideMedia(source: string): string {
  let out = source;
  for (;;) {
    const m = out.match(/@media[^{]*\{/);
    if (!m) return out;
    let depth = 1;
    let i = m.index! + m[0].length;
    for (; i < out.length && depth > 0; i++) {
      if (out[i] === "{") depth++;
      else if (out[i] === "}") depth--;
    }
    out = out.slice(0, m.index) + out.slice(i);
  }
}

/** Hidden from sight but still read out: the whole line stays for screen readers. */
function visuallyHidden(d: [string, string][]): boolean {
  const has = (p: string, v: string) => d.some(([k, x]) => k === p && x === v);
  return (
    has("position", "absolute") &&
    has("width", "1px") &&
    has("height", "1px") &&
    has("overflow", "hidden") &&
    has("clip-path", "inset(50%)") &&
    has("white-space", "nowrap")
  );
}

describe("liem theme", () => {
  it("player cards and book note follow the Look", () => {
    for (const file of Object.keys(FILES) as (keyof typeof FILES)[]) {
      const source = css(file);
      expect(lookViolations(source), file).toEqual([]);
      expect(source, `${file} uses no --liem-* token`).not.toMatch(/--liem-|--book-bar/);
      for (const { selector, body } of rules(source)) {
        for (const [prop, value] of declarations(body)) {
          if (prop === "color") expect(value, `${file}: ${selector} { color }`).not.toMatch(/--gold/);
        }
        // the dead tab, setup card, tile, step, star and dimmed rules are gone
        expect(selector, file).not.toMatch(/\.(liem-tabs?|liem-tiles?|liem-steps?|liem-card|liem-elo|liem-star|setup-card|liem-dimmed)\b/);
      }
    }

    // the stylesheet is still loaded by the app
    expect(stripComments(readFileSync(join(SRC, "index.tsx"), "utf8"))).toMatch(/import\s+["']\.\/styles\/liem\.css["']/);

    // Every `.board > .player` rule moved from Board.css into Player.css.
    expect(css("Board.css")).not.toMatch(/\.player\b/);
    expect(rules(outsideMedia(playerCss())).some((r) => r.selector.startsWith(".board > .player"))).toBe(true);

    // The ♞ avatar sits on the raised cream.
    const avatar = declsFor(liemCss(), ".liem-sparring-avatar");
    expect(last(avatar, "background-color")).toBe("var(--surface-2)");
    expect(last(avatar, "color")).toBe("var(--ink)");

    // "★ Book · N": ink text with an ochre border.
    const badge = declsFor(liemCss(), ".liem-badge");
    expect(last(badge, "color")).toBe("var(--ink)");
    expect(last(badge, "border")).toBe("1px solid var(--gold)");

    // The Stockfish pill: soft text, a hairline border, and the badge's outer size.
    const pill = declsFor(liemCss(), ".liem-badge--engine");
    expect(last(pill, "color")).toBe("var(--soft)");
    expect(last(pill, "border-color")).toBe("var(--line)");
    for (const p of ["padding", "border-width", "border", "height", "font-size", "border-radius"]) {
      expect(last(pill, p), `the pill keeps the badge's ${p}`).toBeUndefined();
    }

    // The book note looks like a card, with a 3px ochre edge, red ink out of book, and ochre bars.
    const note = declsFor(liemCss(), ".liem-note");
    expect(last(note, "background-color")).toBe("var(--surface)");
    expect(last(note, "border")).toBe("1px solid var(--line)");
    expect(last(note, "border-radius")).toBe("var(--radius)");
    expect(last(note, "padding")).toBe("var(--space-4)");
    expect(last(note, "border-left")).toBe("3px solid var(--gold)");
    const order = note.map(([p]) => p);
    expect(order.lastIndexOf("border-left"), "the edge comes after the border").toBeGreaterThan(order.lastIndexOf("border"));
    expect(last(declsFor(liemCss(), ".liem-note--out"), "border-left-color")).toBe("var(--accent)");
    expect(last(declsFor(liemCss(), ".liem-note__bar"), "background-color")).toBe("var(--gold)");

    // The GM tag: red ink with cream text.
    const gm = declsFor(playerCss(), ".player__title");
    expect(last(gm, "background-color")).toBe("var(--accent)");
    expect(last(gm, "color")).toBe("var(--surface)");

    // The phone rules still hide "Plays " / "GM · " and the badge count below 768px, and only there.
    const card = ".board > .player";
    const phone = mediaBlocks(playerCss(), /max-width:\s*767px/);
    expect(visuallyHidden(declsFor(phone, `${card} .liem-detail__lead`)), "lead hidden on phones").toBe(true);
    expect(visuallyHidden(declsFor(phone, `${card} .liem-badge__count`)), "count hidden on phones").toBe(true);
    expect(visuallyHidden(declsFor(phone, `${card} .liem-detail__short`)), "short part stays").toBe(false);
    const wide = outsideMedia(playerCss());
    for (const part of [".liem-detail__lead", ".liem-detail__short", ".liem-badge__count"]) {
      expect(visuallyHidden(declsFor(wide, `${card} ${part}`)), `${part} shows from 768px`).toBe(false);
    }
  });

  it("badge and GM tag contrast", () => {
    const gm = declsFor(playerCss(), ".player__title");
    const [gmInk, gmBack] = [last(gm, "color"), last(gm, "background-color")];
    expect(gmInk ?? "<unset>", "GM tag text is a token").toMatch(/^var\(--[\w-]+\)$/);
    expect(gmBack ?? "<unset>", "GM tag fill is a token").toMatch(/^var\(--[\w-]+\)$/);
    expect(contrast(resolve(gmInk!), resolve(gmBack!))).toBeGreaterThanOrEqual(4.5);

    // The badge, the pill and "Thinking…" have no fill of their own: they read on the page and on a card.
    for (const sel of [".liem-badge", ".liem-badge--engine", ".liem-detail__thinking", ".liem-detail__sub"]) {
      const d = [...declsFor(liemCss(), sel), ...declsFor(css("BookNote.css"), sel)];
      const fg = resolve(last(d, "color") ?? last(declsFor(liemCss(), ".liem-badge"), "color")!);
      const bg = last(d, "background-color");
      expect(bg === undefined || bg === "transparent", `${sel} has no fill`).toBe(true);
      for (const back of ["--bg", "--surface", "--surface-2"]) {
        expect(contrast(fg, resolve(token(back))), `${sel} on ${back}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
