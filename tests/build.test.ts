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
    // 6 piece kinds x 2 colours, emitted as files or inlined as data URLs
    const emitted = readdirSync(join(outDir, "assets")).filter((f) => f.endsWith(".svg")).length;
    const inlined = (js.match(/data:image\/svg\+xml/g) ?? []).length;
    expect(emitted + inlined).toBeGreaterThanOrEqual(12);
  });
});
