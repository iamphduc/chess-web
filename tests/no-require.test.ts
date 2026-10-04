import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return entry === "__tests__" || entry === "__mocks__" ? [] : sourceFiles(full);
    }
    const isSource = /\.tsx?$/.test(entry) && !entry.endsWith(".d.ts");
    const isTest = /\.(test|spec)\.tsx?$/.test(entry);
    return isSource && !isTest ? [full] : [];
  });
}

describe("no require()", () => {
  it("src contains no require calls", () => {
    const files = sourceFiles(SRC);
    expect(files.length).toBeGreaterThan(0);
    const offenders = files
      .filter((f) => /\brequire\s*\(/.test(readFileSync(f, "utf8")))
      .map((f) => relative(SRC, f));
    expect(offenders).toEqual([]);
  });
});
