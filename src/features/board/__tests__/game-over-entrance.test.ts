import { describe, expect, it } from "vitest";

import {
  ENTRANCE,
  ENTRANCE_TOTAL_MS,
  firstShownAt,
  gameOverEntrance,
} from "../gameOverEntrance";

describe("game-over entrance", () => {
  it("entrance timings", () => {
    expect(ENTRANCE).toEqual({
      pauseMs: 300,
      scrimMs: 200,
      cardMs: 250,
      risePx: 8,
      scaleFrom: 0.96,
      ease: "ease-out",
    });
    // The card is fully shown once the pause and the longer of the two fades are over.
    expect(ENTRANCE_TOTAL_MS).toBe(550);
  });

  it("plays once per game end", () => {
    // A fresh end: nothing was shown yet.
    expect(gameOverEntrance(false, null, 10_000)).toBe("animate");
    // StrictMode's second render, or any render within the entrance, still animates.
    expect(gameOverEntrance(false, 10_000, 10_000)).toBe("animate");
    expect(gameOverEntrance(false, 10_000, 10_549)).toBe("animate");
    // At 550 ms or later (back from the review), it shows at once.
    expect(gameOverEntrance(false, 10_000, 10_550)).toBe("instant");
    expect(gameOverEntrance(false, 10_000, 70_000)).toBe("instant");
    // A clock that went back never replays it.
    expect(gameOverEntrance(false, 10_000, 9_999)).toBe("instant");
  });

  it("reduced motion shows it at once", () => {
    for (const [first, now] of [
      [null, 0],
      [5_000, 5_000],
      [5_000, 5_100],
      [5_000, 9_000],
    ] as const) {
      expect(gameOverEntrance(true, first, now)).toBe("instant");
    }
  });

  it("remembers when each game end was first shown", () => {
    const end = {};
    const other = {};
    // The first call records the time and reports it was not shown before.
    expect(firstShownAt(end, 1_000)).toBeNull();
    // Later calls for the same end return that first time, never a newer one.
    expect(firstShownAt(end, 1_200)).toBe(1_000);
    expect(firstShownAt(end, 9_000)).toBe(1_000);
    // Another end (the next game) starts over.
    expect(firstShownAt(other, 9_000)).toBeNull();
    expect(firstShownAt(other, 9_100)).toBe(9_000);
  });
});
