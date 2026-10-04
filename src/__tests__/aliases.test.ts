import { describe, expect, it } from "vitest";

// Dynamic imports keep each prefix's failure inside this test instead of
// failing the whole file at collection time.
describe("bare import prefixes", () => {
  it("resolves every bare import prefix", async () => {
    const game = await import("game/piece-type");
    const features = await import("features/board/BoardSlice");
    const app = await import("app/store");
    const hooks = await import("hooks/useMediaQuery");

    expect(game.PieceType.WhiteKing).toBe("WHITE_KING");
    expect(features.boardSlice.name).toBe("board");
    expect(typeof app.store.getState).toBe("function");
    expect(typeof hooks.useMediaQuery).toBe("function");
  });

  it("svg imports use the test mock", async () => {
    const bare = await import("assets/queen-white.svg");
    const relative = await import("../assets/king-black.svg");

    expect(bare.default).toBe("svg-mock");
    expect(relative.default).toBe("svg-mock");
  });
});
