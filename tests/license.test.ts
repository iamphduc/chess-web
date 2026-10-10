import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const read = (file: string) => readFileSync(join(ROOT, file), "utf8");

// The licence the repo is offered under. Switch to "GPL-3.0-only" here and in
// package.json together if the human picks that.
const LICENSE_ID = "GPL-3.0-or-later";

describe("licence", () => {
  it("repo is GPL-3.0", () => {
    expect(existsSync(join(ROOT, "LICENSE")), "LICENSE exists").toBe(true);
    const text = read("LICENSE");
    const head = text.split(/\r?\n/).slice(0, 5).map((l) => l.trim());
    expect(head[0]).toBe("GNU GENERAL PUBLIC LICENSE");
    expect(head[1]).toBe("Version 3, 29 June 2007");
    expect(text).toContain("END OF TERMS AND CONDITIONS");
    // The verbatim text ends with the "How to Apply" appendix.
    expect(text).toContain("How to Apply These Terms to Your New Programs");

    const pkg = JSON.parse(read("package.json"));
    expect(pkg.license).toBe(LICENSE_ID);
  });

  it("README credits Stockfish and the game sources", () => {
    const readme = read("README.md");
    expect(readme).toMatch(/^## Credits\r?$/m);
    for (const needle of [
      "https://github.com/official-stockfish/Stockfish",
      "https://www.npmjs.com/package/stockfish",
      "Chess.com",
      "Lichess",
      "TWIC",
      "public/sounds/CREDITS.md",
    ]) {
      expect(readme, needle).toContain(needle);
    }
  });
});
