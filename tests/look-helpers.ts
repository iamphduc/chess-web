import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Shared helpers for the Look tests (plan ui-refresh, ## Look).
// Every slice's CSS test reads tokens and rules through these, and runs
// `lookViolations` on the CSS files it owns.

export const SRC = join(__dirname, "..", "src");

export const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");

/** A file under src/, with comments taken out. */
export const readCss = (...parts: string[]) => stripComments(readFileSync(join(SRC, ...parts), "utf8"));

/** src/index.css, with comments taken out. */
export const indexCss = () => readCss("index.css");

/** Every .css file under a folder (src/ by default), recursively. */
export function cssFiles(dir: string = SRC): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return cssFiles(path);
    return e.name.endsWith(".css") ? [path] : [];
  });
}

/**
 * Every custom property declared in any `:root { ... }` block, name -> raw values.
 * A token declared twice (in one block or across blocks) shows up as two values.
 * Reads src/index.css when no source is given.
 */
export function rootTokens(source: string = indexCss()): Record<string, string[]> {
  const tokens: Record<string, string[]> = {};
  for (const block of stripComments(source).matchAll(/(^|[\s}]):root\s*\{([^}]*)\}/g)) {
    for (const m of block[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      (tokens[m[1]] ??= []).push(m[2].replace(/\s+/g, " ").trim());
    }
  }
  return tokens;
}

/** The value of one :root token in src/index.css. Throws unless it's declared exactly once. */
export function token(name: string, source?: string): string {
  const values = rootTokens(source)[name] ?? [];
  if (values.length !== 1) throw new Error(`${name} is declared ${values.length} times in :root, not once`);
  return values[0];
}

/** Innermost rules (selector -> body), in source order, including those inside @media blocks. */
export function rules(source: string): { selector: string; body: string }[] {
  return [...stripComments(source).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1].trim(),
    body: m[2],
  }));
}

/** Declarations of a rule body, as [property, value] pairs in order. */
export function declarations(body: string): [string, string][] {
  return body
    .split(";")
    .map((d) => d.trim())
    .filter((d) => d.includes(":"))
    .map((d) => {
      const i = d.indexOf(":");
      return [d.slice(0, i).trim().toLowerCase(), d.slice(i + 1).trim()];
    });
}

/** Declarations of every rule that names `selector` (alone or in a comma list), in order. */
export function declsFor(source: string, selector: string): [string, string][] {
  return declarations(
    rules(source)
      .filter((r) => r.selector.split(",").map((s) => s.trim()).includes(selector))
      .map((r) => r.body)
      .join(";")
  );
}

/** The last value set for a property: what wins in the cascade. */
export const last = (d: [string, string][], prop: string) => [...d].reverse().find(([p]) => p === prop)?.[1];

type RGBA = [number, number, number, number];

/** Parses #RGB, #RRGGBB, rgb(...) and rgba(...) into 0-255 channels and a 0-1 alpha. */
export function parseColor(value: string): RGBA {
  const v = value.trim();
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1) as RGBA;
  }
  const fn = v.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (fn) return [Number(fn[1]), Number(fn[2]), Number(fn[3]), fn[4] === undefined ? 1 : Number(fn[4])];
  throw new Error(`unsupported color: ${value}`);
}

function luminance([r, g, b]: RGBA): number {
  const [R, G, B] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * WCAG 2.x contrast of `fg` on `bg`. A see-through `fg` is painted over `bg` first;
 * `bg` must be opaque.
 */
export function contrast(fg: string, bg: string): number {
  const back = parseColor(bg);
  if (back[3] !== 1) throw new Error(`background must be opaque: ${bg}`);
  const top = parseColor(fg);
  const a = top[3];
  const front = [0, 1, 2].map((i) => top[i] * a + back[i] * (1 - a)).concat(1) as RGBA;
  const [hi, lo] = [luminance(front), luminance(back)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Hue in degrees (0-360) of a #RRGGBB color. */
export function hue(value: string): number {
  const [r, g, b] = parseColor(value).map((c, i) => (i < 3 ? c / 255 : c));
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

/** The distance between two hues, in degrees (0-180). */
export const hueGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

const LITERAL_COLOR = /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;
const GRADIENT = /gradient\(/i;

/** A font-size value in px, or null when it isn't a fixed size this check can read. */
function fontSizePx(value: string): number | null {
  const m = value.trim().match(/^(-?[\d.]+)(px|rem|em)$/i);
  if (!m) return null;
  const n = Number(m[1]);
  return m[2].toLowerCase() === "px" ? n : n * 16;
}

/**
 * What breaks the Look's CSS rules in one stylesheet: a literal color (hex, rgb(), hsl() and
 * the like), a gradient, or a font-size under 14px. `transparent`, `currentColor` and
 * `inherit` are fine. Returns one line per problem, empty when the file is clean.
 */
export function lookViolations(css: string): string[] {
  const out: string[] = [];
  for (const { selector, body } of rules(css)) {
    if (/^@font-face$/i.test(selector)) continue;
    for (const [prop, value] of declarations(body)) {
      const where = `${selector} { ${prop}: ${value} }`;
      if (LITERAL_COLOR.test(value)) out.push(`literal color: ${where}`);
      if (GRADIENT.test(value)) out.push(`gradient: ${where}`);
      if (prop === "font-size" || prop === "font") {
        // in the shorthand, the size comes before an optional "/line-height"
        const sizes = prop === "font-size" ? [value] : value.split(/\s+/).map((s) => s.split("/")[0]);
        for (const size of sizes) {
          const px = fontSizePx(size);
          if (px !== null && px < 14) out.push(`font-size under 14px: ${where}`);
        }
      }
    }
  }
  return out;
}
