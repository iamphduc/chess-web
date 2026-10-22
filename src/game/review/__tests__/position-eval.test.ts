import { describe, expect, it } from "vitest";

const sources = import.meta.glob(["/src/**/*.ts", "/src/**/*.tsx", "!/src/**/__tests__/**"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

describe("PositionEval", () => {
  it("PositionEval is declared once, in game/review/types.ts", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(10);
    const declares = Object.entries(sources)
      .filter(([, text]) => /\b(interface\s+PositionEval\b|type\s+PositionEval\s*=)/.test(text))
      .map(([file]) => file);
    expect(declares).toEqual(["/src/game/review/types.ts"]);
  });
});
