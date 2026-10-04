import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const ROOT = join(__dirname, "..");
const read = (file: string) => readFileSync(join(ROOT, file), "utf8");
const structure = () => read("docs/codebase-structure.md");

// The body of a "## <name>" section, up to the next "## " heading.
function section(doc: string, name: string): string {
  const lines = doc.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === `## ${name}`);
  if (start === -1) return "";
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^## /.test(l));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n");
}

describe("docs", () => {
  it("codebase-structure has no stale CRA or pre-cutover text", () => {
    const doc = structure();
    for (const stale of [
      "react-scripts",
      "--legacy-peer-deps",
      "not yet wired",
      "piece-moves.ts",
      "gh-pages.js",
      "npm run deploy",
      "loaded as CommonJS",
    ]) {
      expect(doc.includes(stale), stale).toBe(false);
    }
    expect(doc.toLowerCase().includes("localhost"), "localhost").toBe(false);
  });

  it("codebase-structure has the required sections", () => {
    const headings = structure()
      .split(/\r?\n/)
      .filter((l) => l.startsWith("## "))
      .map((l) => l.trim());
    for (const h of ["## Stack & conventions", "## Smoke recipe", "## CI"]) {
      expect(headings, h).toContain(h);
    }
  });

  it("smoke recipe matches the vite commands", () => {
    const recipe = section(structure(), "Smoke recipe");
    expect(recipe).toMatch(/Install:.*`npm install`/);
    const urls = recipe.match(/https?:\/\/[^\s`)*]+/g) ?? [];
    expect(urls.length).toBeGreaterThanOrEqual(2);
    for (const url of urls) {
      expect(url).toMatch(/^http:\/\/127\.0\.0\.1:[^/]+\/chess-web\/$/);
    }
    expect(recipe).toMatch(/\bPORT\b/);
    expect(recipe).toMatch(/Verification:/);
  });

  it("smoke recipe only names real scripts", () => {
    const recipe = section(structure(), "Smoke recipe");
    const scripts: Record<string, string> = JSON.parse(read("package.json")).scripts;
    const named = [...recipe.matchAll(/npm run ([\w:-]+)/g)].map((m) => m[1]);
    // npm's own shorthands for scripts: `npm test`, `npm start`, ...
    for (const m of recipe.matchAll(/\bnpm (test|start|stop|restart)\b/g)) named.push(m[1]);
    expect(named.length).toBeGreaterThan(0);
    const missing = named.filter((name) => scripts[name] === undefined);
    expect(missing).toEqual([]);
  });

  it("layout paths exist", () => {
    const layout = section(structure(), "Layout");
    const paths = [...layout.matchAll(/`(src\/[^`\s]*)`/g)].map((m) => m[1]);
    expect(paths.length).toBeGreaterThan(0);
    const broken = paths.filter((p) => {
      const asDir = p.endsWith("/*") || p.endsWith("/");
      const target = join(ROOT, p.replace(/\/\*$/, "").replace(/\/$/, ""));
      if (!existsSync(target)) return true;
      return asDir ? !statSync(target).isDirectory() : !statSync(target).isFile();
    });
    expect(broken).toEqual([]);
  });

  it("decisions records the vite switch", () => {
    // \bVite\b: "Vitest" in an older heading must not count.
    expect(read("docs/decisions.md")).toMatch(/^## .*\bVite\b/m);
  });

  it("CI section describes the workflow", () => {
    const ci = section(structure(), "CI");
    expect(ci.trim()).not.toMatch(/^None\b/);
    expect(ci).toContain(".github/workflows/pod-ci.yml");
    expect(existsSync(join(ROOT, ".github/workflows/pod-ci.yml"))).toBe(true);
    for (const text of ["pull_request", "main", "Node 24", "https://iamphduc.github.io/chess-web/"]) {
      expect(ci.includes(text), text).toBe(true);
    }
  });

  it("CI section lists the human setup", () => {
    const ci = section(structure(), "CI");
    expect(ci).toMatch(/Pages.*Source.*"GitHub Actions"/);
  });

  it("documented verification matches CI", () => {
    const recipe = section(structure(), "Smoke recipe");
    const m = /Verification:\*\*\s*`([^`]+)`/.exec(recipe);
    expect(m, "Verification: command in the smoke recipe").not.toBeNull();
    const workflow = parse(read(".github/workflows/pod-ci.yml"));
    const runs: string[] = (workflow.jobs.verify.steps as { run?: string }[])
      .filter((step) => typeof step.run === "string")
      .map((step) => step.run!.trim());
    expect(runs).toContain(m![1].trim());
  });

  it("decisions records the actions deploy", () => {
    expect(read("docs/decisions.md")).toMatch(/^## (?=.*GitHub Actions)(?=.*\bPages\b).*$/m);
  });

  it("engineAdapter header has no stale alias note", () => {
    const src = read("src/features/board/engineAdapter.ts");
    expect(src.includes("baseUrl"), "baseUrl").toBe(false);
    expect(src.includes("does not resolve"), "does not resolve").toBe(false);
  });
});
