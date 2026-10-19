import { describe, expect, it } from "vitest";

import { radioKeyIndex } from "../RadioGroup";

describe("radio group keys", () => {
  it("arrow keys move and wrap", () => {
    // Right and Down go forward, Left and Up go back.
    expect(radioKeyIndex(0, "ArrowRight", 7)).toBe(1);
    expect(radioKeyIndex(0, "ArrowDown", 7)).toBe(1);
    expect(radioKeyIndex(3, "ArrowLeft", 7)).toBe(2);
    expect(radioKeyIndex(3, "ArrowUp", 7)).toBe(2);
    // They wrap at both ends.
    expect(radioKeyIndex(6, "ArrowRight", 7)).toBe(0);
    expect(radioKeyIndex(6, "ArrowDown", 7)).toBe(0);
    expect(radioKeyIndex(0, "ArrowLeft", 7)).toBe(6);
    expect(radioKeyIndex(0, "ArrowUp", 7)).toBe(6);
    // Home and End jump to the ends.
    expect(radioKeyIndex(4, "Home", 7)).toBe(0);
    expect(radioKeyIndex(2, "End", 7)).toBe(6);
    expect(radioKeyIndex(1, "End", 3)).toBe(2);
    // A group of one stays put.
    expect(radioKeyIndex(0, "ArrowRight", 1)).toBe(0);
    expect(radioKeyIndex(0, "ArrowLeft", 1)).toBe(0);
  });

  it("other keys do nothing", () => {
    for (const key of ["Enter", " ", "Tab", "a", "PageDown"]) expect(radioKeyIndex(2, key, 7)).toBeNull();
  });
});
