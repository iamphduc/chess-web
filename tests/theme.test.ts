import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = () => readFileSync(join(__dirname, "..", "src", "index.css"), "utf8");

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

  it("quicksand loads 500 and 700", () => {
    const source = css();
    const imports = [...source.matchAll(/@import\s+url\(["']?([^"')]+)["']?\)/g)].map((m) => m[1]);
    expect(imports).toHaveLength(1);
    const url = new URL(imports[0]);
    expect(url.hostname).toBe("fonts.googleapis.com");
    expect(url.searchParams.get("family")).toBe("Quicksand:wght@500;700");
    expect(url.searchParams.get("display")).toBe("swap");
    // @import must come before any other rule or the browser drops it
    expect(source.trimStart().startsWith("@import")).toBe(true);
  });
});
