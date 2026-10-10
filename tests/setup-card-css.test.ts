import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CSS_PATH = join(__dirname, "..", "src", "features", "liem", "components", "SetupCard.css");
const source = () => readFileSync(CSS_PATH, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

// Splits the file into top-level text and the body of each @media block (one level of nesting).
function split(css: string): { top: string; media: { query: string; body: string }[] } {
  const media: { query: string; body: string }[] = [];
  let top = "";
  let i = 0;
  while (i < css.length) {
    const at = css.indexOf("@media", i);
    if (at === -1) {
      top += css.slice(i);
      break;
    }
    top += css.slice(i, at);
    const open = css.indexOf("{", at);
    let depth = 1;
    let j = open + 1;
    while (depth > 0 && j < css.length) {
      if (css[j] === "{") depth++;
      if (css[j] === "}") depth--;
      j++;
    }
    media.push({ query: css.slice(at, open).trim(), body: css.slice(open + 1, j - 1) });
    i = j;
  }
  return { top, media };
}

function rules(css: string): { selector: string; body: string }[] {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), body: m[2] }));
}

const normalize = (css: string) =>
  rules(css)
    .map((r) => `${r.selector.replace(/\s+/g, " ")}{${r.body.replace(/\s+/g, " ").trim()}}`)
    .join("\n");

const px = (body: string, prop: string): number | undefined => {
  const m = body.match(new RegExp(`(?:^|[;\\s])${prop}\\s*:\\s*([\\d.]+)px`));
  return m ? Number(m[1]) : undefined;
};

// Last rule in the block whose selector list ends in `.cls`.
const ruleFor = (css: string, cls: string) =>
  rules(css)
    .filter((r) => r.selector.split(",").some((s) => s.trim().endsWith(cls)))
    .map((r) => r.body)
    .join(";");

const narrow = () => {
  const block = split(source()).media.find((m) => /max-width:\s*599px/.test(m.query));
  expect(block, "a max-width: 599px block").toBeDefined();
  return block!.body;
};

// The desktop card as shipped before the phone fix; it must not change.
const DESKTOP = `.setup-card{box-sizing: border-box; width: 100%; max-width: 360px; text-align: left;}
.setup-card__strength{margin-top: 16px;}
.setup-card__strength-top{display: flex; align-items: baseline; justify-content: space-between; gap: 8px;}
.setup-card__label{font-size: 16px; font-weight: 700;}
.setup-card__value{display: inline-flex; align-items: baseline; gap: 8px;}
.setup-card__full{font-size: 16px; font-weight: 700; color: var(--liem-gold);}
.setup-card__actions{margin-top: 16px;}`;

describe("setup card CSS", () => {
  it("leaves the desktop card unchanged", () => {
    expect(normalize(split(source()).top)).toBe(DESKTOP);
  });

  it("tightens the card only under the narrow media query", () => {
    const body = narrow();
    for (const cls of [".setup-card", ".liem-card__title", ".liem-tile", ".liem-tile__glyph", ".liem-elo", ".liem-step"]) {
      expect(ruleFor(body, cls), `${cls} narrow rule`).not.toBe("");
    }
  });

  it("keeps narrow text at 14 px or more and the Elo at 24 px or more", () => {
    const body = narrow();
    for (const m of body.matchAll(/font-size\s*:\s*([\d.]+)px/g)) {
      expect(Number(m[1])).toBeGreaterThanOrEqual(14);
    }
    expect(px(ruleFor(body, ".liem-elo"), "font-size")).toBeGreaterThanOrEqual(24);
  });

  it("keeps narrow tap targets at least 40 px tall", () => {
    const body = narrow();
    expect(px(ruleFor(body, ".liem-step"), "height"), "strength step").toBeGreaterThanOrEqual(40);
    expect(px(ruleFor(body, ".button--play"), "min-height"), "Start game").toBeGreaterThanOrEqual(40);
  });
});
