import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { SRC, contrast, cssFiles, declarations, indexCss, rootTokens, stripComments, token } from "./look-helpers";

// The clock pairs name Look tokens: waiting on the raised cream, running in ink, low time in red ink.
const CLOCKS: Record<string, string> = {
  "--clock-waiting-bg": "var(--surface-2)",
  "--clock-waiting-ink": "var(--soft)",
  "--clock-running-bg": "var(--ink)",
  "--clock-running-ink": "var(--bg)",
  "--clock-low-bg": "var(--accent)",
  "--clock-low-ink": "var(--surface)",
};

// The color a token ends up as, following var() links.
function resolved(name: string): string {
  const value = token(name);
  const link = value.match(/^var\((--[\w-]+)\)$/);
  return link ? resolved(link[1]) : value;
}

const pair = (name: "waiting" | "running" | "low") =>
  contrast(resolved(`--clock-${name}-ink`), resolved(`--clock-${name}-bg`));

describe("theme", () => {
  it("clock tokens have the Look values", () => {
    const tokens = rootTokens();
    const clocks = Object.keys(tokens).filter((n) => n.startsWith("--clock-"));
    // exactly the six contract tokens, each declared once in :root
    expect(clocks.sort()).toEqual(Object.keys(CLOCKS).sort());
    for (const [name, value] of Object.entries(CLOCKS)) {
      expect(tokens[name], name).toHaveLength(1);
      expect(tokens[name][0], name).toBe(value);
    }
  });

  it("clock pairs meet 4.5:1", () => {
    expect(pair("waiting"), "waiting").toBeGreaterThanOrEqual(4.5);
    expect(pair("running"), "running").toBeGreaterThanOrEqual(4.5);
    expect(pair("low"), "low time").toBeGreaterThanOrEqual(4.5);
  });

  it("quicksand is served from the app", () => {
    const source = indexCss();
    // no Google Fonts (or any other) @import
    expect(source).not.toMatch(/@import/);
    const faces = [...source.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => declarations(m[1]));
    const prop = (d: [string, string][], name: string) => d.find(([p]) => p === name)?.[1];
    const quicksand = faces.filter((d) => /^["']?Quicksand["']?$/.test(prop(d, "font-family") ?? ""));
    // one face per weight, or one variable face whose range covers both
    const covers = (w: number) =>
      quicksand.some((d) => {
        const [lo, hi = lo] = (prop(d, "font-weight") ?? "").split(/\s+/).map(Number);
        return lo <= w && w <= hi;
      });
    expect(quicksand.length).toBeGreaterThan(0);
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
    // the font token names the self-hosted family
    expect(token("--font")).toBe('"Quicksand", sans-serif');
    // no CSS anywhere under src/ loads anything over http(s), a protocol-relative url or an @import
    for (const file of cssFiles()) {
      const text = stripComments(readFileSync(file, "utf8"));
      expect(text, file).not.toMatch(/https?:\/\//i);
      expect(text, `${file} has a protocol-relative url`).not.toMatch(/url\(\s*["']?\/\//i);
      expect(text, `${file} imports a stylesheet`).not.toMatch(/@import/i);
    }
  });
});
