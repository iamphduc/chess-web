import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "src");
const css = () => readFileSync(join(SRC, "index.css"), "utf8");

// Every .css file under a folder, recursively.
function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return cssFiles(path);
    return e.name.endsWith(".css") ? [path] : [];
  });
}

// The declarations inside the first top-level `:root { ... }` block.
function rootBlock(source: string): string {
  const match = source.match(/(^|\n):root\s*\{([^}]*)\}/);
  return match ? match[2] : "";
}

// Every `--clock-*` custom property in :root, name -> raw value.
// A token declared twice is reported as a list so the test can catch it.
function clockTokens(source: string): Record<string, string[]> {
  const tokens: Record<string, string[]> = {};
  for (const m of rootBlock(source).matchAll(/(--clock-[\w-]+)\s*:\s*([^;]+);/g)) {
    (tokens[m[1]] ??= []).push(m[2].trim());
  }
  return tokens;
}

function token(name: string): string {
  const values = clockTokens(css())[name] ?? [];
  expect(values, `${name} declared once in :root`).toHaveLength(1);
  return values[0];
}

// WCAG 2.x relative luminance of a #RRGGBB color.
function luminance(hex: string): number {
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) throw new Error(`not a #RRGGBB color: ${hex}`);
  const [r, g, b] = m.slice(1).map((h) => {
    const c = parseInt(h, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const pair = (name: "waiting" | "running" | "low") =>
  contrast(token(`--clock-${name}-ink`), token(`--clock-${name}-bg`));

const LOOK: Record<string, string> = {
  "--clock-waiting-bg": "#474747",
  "--clock-waiting-ink": "#FFFFFF",
  "--clock-running-bg": "#FFFFFF",
  "--clock-running-ink": "#1C1C1C",
  "--clock-low-bg": "#D9534F",
  "--clock-low-ink": "#FFFFFF",
};

describe("theme", () => {
  it("clock tokens have the Look values", () => {
    const tokens = clockTokens(css());
    // exactly the six contract tokens, each declared once in :root
    expect(Object.keys(tokens).sort()).toEqual(Object.keys(LOOK).sort());
    for (const [name, value] of Object.entries(LOOK)) {
      expect(tokens[name], name).toHaveLength(1);
      expect(tokens[name][0].toLowerCase(), name).toBe(value.toLowerCase());
    }
  });

  it("normal clock pairs meet 4.5:1 contrast", () => {
    expect(pair("waiting")).toBeGreaterThanOrEqual(4.5);
    expect(pair("running")).toBeGreaterThanOrEqual(4.5);
  });

  it("low-time pair meets large-text contrast", () => {
    const low = pair("low");
    expect(low).toBeGreaterThanOrEqual(3);
    // documented: passes only as large text / non-text, not as normal text
    expect(low).toBeLessThan(4.5);
  });

  it("quicksand is served from the app", () => {
    const source = css().replace(/\/\*[\s\S]*?\*\//g, "");
    // no Google Fonts (or any other) @import
    expect(source).not.toMatch(/@import/);
    const faces = [...source.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);
    const prop = (body: string, name: string) =>
      body.match(new RegExp(`(?:^|[;\\s])${name}\\s*:\\s*([^;]+);`))?.[1].trim();
    const quicksand = faces.filter((f) => /^["']?Quicksand["']?$/.test(prop(f, "font-family") ?? ""));
    const weights = quicksand.flatMap((f) => (prop(f, "font-weight") ?? "").split(/\s+/).map(Number));
    // one face per weight, or one variable face whose range covers both
    const covers = (w: number) =>
      quicksand.some((f) => {
        const [lo, hi = lo] = (prop(f, "font-weight") ?? "").split(/\s+/).map(Number);
        return lo <= w && w <= hi;
      });
    expect(weights.length).toBeGreaterThan(0);
    expect(covers(500), "500").toBe(true);
    expect(covers(700), "700").toBe(true);
    for (const face of quicksand) {
      expect(prop(face, "font-display"), "font-display").toBe("swap");
      const urls = [...(prop(face, "src") ?? "").matchAll(/url\(["']?([^"')]+)["']?\)/g)].map((m) => m[1]);
      expect(urls.length, "src has a url()").toBeGreaterThan(0);
      for (const url of urls) {
        expect(url, "relative path").not.toMatch(/^([a-z]+:|\/\/)/i);
        expect(url, "woff2").toMatch(/\.woff2$/);
        const file = resolve(SRC, url);
        expect(file.startsWith(join(SRC, "assets", "fonts")), `${url} under src/assets/fonts/`).toBe(true);
        expect(existsSync(file), `${url} exists`).toBe(true);
      }
    }
    expect(existsSync(join(SRC, "assets", "fonts", "OFL.txt")), "OFL licence committed").toBe(true);
    // no CSS anywhere under src/ loads anything over http(s)
    for (const file of cssFiles(SRC)) {
      const text = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      expect(text, file).not.toMatch(/https?:\/\//i);
    }
  });
});
