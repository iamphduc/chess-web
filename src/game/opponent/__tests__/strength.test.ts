import { describe, expect, it } from "vitest";
import { STRENGTH_STEPS, strengthElo, strengthLabel } from "../strength";

describe("steps and full", () => {
  it("lists the steps in order, ending with full", () => {
    expect(STRENGTH_STEPS).toEqual([1400, 1700, 1900, 2100, 2300, 2500, "full"]);
  });

  it("maps each numeric step to itself", () => {
    for (const step of [1400, 1700, 1900, 2100, 2300, 2500] as const) {
      expect(strengthElo(step, 2732)).toBe(step);
    }
  });

  it('maps "full" to the given rating', () => {
    expect(strengthElo("full", 2732)).toBe(2732);
    expect(strengthElo("full", 2500)).toBe(2500);
  });
});

describe("strength labels", () => {
  it("labels each step as about its Elo", () => {
    expect(STRENGTH_STEPS.map((step) => strengthLabel(step, 2732))).toEqual([
      "about 1400",
      "about 1700",
      "about 1900",
      "about 2100",
      "about 2300",
      "about 2500",
      "about 2732",
    ]);
    // Full follows the rating it is given, not a fixed number.
    expect(strengthLabel("full", 2650)).toBe("about 2650");
  });
});
