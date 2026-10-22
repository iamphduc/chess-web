import { describe, expect, it } from "vitest";

import { ButtonType } from "../components/Button";

describe("ButtonType", () => {
  it("ButtonType lists Play, Reset, Flip and Sound only", () => {
    expect(Object.values(ButtonType).sort()).toEqual(["Flip", "Play", "Reset", "Sound"]);
  });
});
