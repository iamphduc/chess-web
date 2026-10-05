import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const VITE_BIN = join(ROOT, "node_modules", "vite", "bin", "vite.js");
let outDir: string;
let build: SpawnSyncReturns<string>;

beforeAll(() => {
  outDir = mkdtempSync(join(tmpdir(), "chess-web-build-"));
  build = spawnSync(process.execPath, [VITE_BIN, "build", "--outDir", outDir, "--emptyOutDir"], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, NODE_ENV: "production", VITEST: "" },
  });
}, 180_000);

afterAll(() => {
  rmSync(outDir, { recursive: true, force: true });
});

function jsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? jsFiles(join(dir, e.name)) : e.name.endsWith(".js") ? [join(dir, e.name)] : [],
  );
}

describe("production build", () => {
  it("production build uses the /chess-web/ base", () => {
    expect(build.status, `${build.stdout}\n${build.stderr}`).toBe(0);
    const html = readFileSync(join(outDir, "index.html"), "utf8");
    const urls = [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) expect(url).toMatch(/^\/chess-web\//);
    expect(urls).toContain("/chess-web/chess-icon.png");
    expect(urls).toContain("/chess-web/logo192.png");
    expect(urls).toContain("/chess-web/manifest.json");
    expect(urls.some((u) => /^\/chess-web\/assets\/.+\.js$/.test(u))).toBe(true);
    expect(html).not.toContain("%PUBLIC_URL%");
    expect(existsSync(join(outDir, "chess-icon.png"))).toBe(true);
  });

  it("production build bundles real svgs, not the test mock", () => {
    expect(build.status, `${build.stdout}\n${build.stderr}`).toBe(0);
    const files = jsFiles(outDir);
    expect(files.length).toBeGreaterThan(0);
    const js = files.map((f) => readFileSync(f, "utf8")).join("\n");
    expect(js).not.toContain("svg-mock");
    const emitted = readdirSync(join(outDir, "assets")).filter((f) => f.endsWith(".svg"));
    // 6 piece kinds x 2 colours
    expect(emitted).toHaveLength(12);
  });

  it("config loads as ESM without a CommonJS warning", () => {
    expect(build.status, `${build.stdout}\n${build.stderr}`).toBe(0);
    const lines = `${build.stdout}\n${build.stderr}`.split(/\r?\n/);
    expect(lines.filter((l) => l.includes("CommonJS") && l.includes("vite.config"))).toEqual([]);
  });

  it("svgs are emitted as files, never inlined as data URLs", () => {
    // Piece.tsx puts the URL in an unquoted CSS url(...); an inlined
    // data:image/svg+xml URL has quotes and spaces, so the piece renders blank.
    expect(build.status, `${build.stdout}\n${build.stderr}`).toBe(0);
    const js = jsFiles(outDir).map((f) => readFileSync(f, "utf8")).join("\n");
    expect(js).not.toContain("data:image/svg+xml");
  });
});
