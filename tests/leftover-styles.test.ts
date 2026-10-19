import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import { SRC, cssFiles, lookViolations, rootTokens, stripComments } from "./look-helpers";

// The guard over all of src/ once the Look is in (plan ui-refresh, sprint refresh C1):
// no old token survives, every token used is declared, and every stylesheet keeps the Look's rules.

/** Every file under src/ with one of these extensions, recursively. Tests are left out. */
function sourceFiles(exts: string[], dir: string = SRC): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" ? [] : sourceFiles(exts, path);
    return exts.some((x) => e.name.endsWith(x)) && !/\.test\.tsx?$/.test(e.name) ? [path] : [];
  });
}

const rel = (file: string) => relative(SRC, file).replace(/\\/g, "/");
const INDEX = join(SRC, "index.css");

// The old dark-theme tokens. `--background` and `--text` count only bare, so `--text-body`
// and the other type tokens don't match.
const OLD_TOKEN = /--(?:dark-[\w-]*|liem-[\w-]*|book-bar|review-page|board-sound-on|background|text)(?![\w-])/g;

describe("leftover styles", () => {
  it("no old tokens", () => {
    const found = sourceFiles([".css", ".ts", ".tsx"]).flatMap((file) =>
      [...stripComments(readFileSync(file, "utf8")).matchAll(OLD_TOKEN)].map((m) => `${rel(file)}: ${m[0]}`)
    );
    expect(found).toEqual([]);
  });

  it("every token used is defined", () => {
    const declared = new Set(Object.keys(rootTokens()));
    // A custom property a component sets inline (style={{ "--square-size": ... }}) is defined there.
    const files = sourceFiles([".css", ".ts", ".tsx"]);
    for (const file of files.filter((f) => f.endsWith(".tsx"))) {
      for (const m of readFileSync(file, "utf8").matchAll(/["'](--[\w-]+)["']\s*:/g)) declared.add(m[1]);
    }
    const missing = files.flatMap((file) =>
      [...stripComments(readFileSync(file, "utf8")).matchAll(/var\(\s*(--[\w-]+)/g)]
        .map((m) => m[1])
        .filter((name) => !declared.has(name))
        .map((name) => `${rel(file)}: ${name}`)
    );
    expect(missing).toEqual([]);
  });

  it("every stylesheet follows the Look", () => {
    // index.css is where the literal values live; every other stylesheet names tokens only.
    const files = cssFiles().filter((f) => f !== INDEX);
    expect(files.length).toBeGreaterThan(10);
    const found = files.flatMap((file) =>
      lookViolations(readFileSync(file, "utf8")).map((v) => `${rel(file)}: ${v}`)
    );
    expect(found).toEqual([]);
    // index.css itself: only :root and @font-face hold literals; body and the rest use tokens.
    const outsideRoot = stripComments(readFileSync(INDEX, "utf8")).replace(/(^|[\s}]):root\s*\{[^}]*\}/g, "$1");
    expect(lookViolations(outsideRoot)).toEqual([]);
  });
});
