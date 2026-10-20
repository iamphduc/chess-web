import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("GameOver import cycle", () => {
  it("only .tsx components import the GameOver component; plain modules take GameOverType from gameOverType", () => {
    const offenders = sourceFiles("src")
      .filter((file) => file.endsWith(".ts"))
      .filter((file) => /from\s+["'][^"']*components\/GameOver["']/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("exports GameOverType from its own module", async () => {
    const mod = await import("../gameOverType");
    expect(mod.GameOverType.Continue).toBe("Continue");
  });
});
