import { describe, expect, it, vi } from "vitest";

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

  it("gameEnd.ts imports first without a crash", async () => {
    // A fresh module registry, so nothing the other tests loaded runs first.
    vi.resetModules();
    const end = await import("../gameEnd");
    await import("features/liem/liemTurn");
    await import("../components/Piece");
    const { GameOverType } = await import("../gameOverType");
    expect(GameOverType.Continue).toBe("Continue");
    expect(end.canResign({ isPlaying: true, gameOver: GameOverType.Continue })).toBe(true);
    const { createAppStore } = await import("app/store");
    expect(createAppStore().getState().board.gameOver).toBe(GameOverType.Continue);
  });
});
