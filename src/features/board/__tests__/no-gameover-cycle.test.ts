import { describe, expect, it } from "vitest";

const sources = import.meta.glob(["/src/**/*.ts", "!/src/**/__tests__/**"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

describe("GameOver import cycle", () => {
  it("plain .ts modules never import the GameOver component; they take GameOverType from gameOverType", () => {
    const offenders = Object.entries(sources)
      .filter(([, text]) => /from\s+["'][^"']*components\/GameOver["']/.test(text))
      .map(([file]) => file);
    expect(Object.keys(sources).length).toBeGreaterThan(10);
    expect(offenders).toEqual([]);
  });

  it("exports GameOverType from its own module", async () => {
    const mod = await import("../gameOverType");
    expect(mod.GameOverType.Continue).toBe("Continue");
  });
});
