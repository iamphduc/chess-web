import { describe, expect, it } from "vitest";

import { pickSound, SoundKind, soundToPlay } from "../sound";

type Flag = "gameEnd" | "check" | "promotion" | "castle" | "capture";

// Highest priority first, each with the kind it gives.
const ORDER: [Flag, SoundKind][] = [
  ["gameEnd", "game-end"],
  ["check", "check"],
  ["promotion", "promote"],
  ["castle", "castle"],
  ["capture", "capture"],
];

function flags(on: Flag[]) {
  return {
    gameEnd: on.includes("gameEnd"),
    check: on.includes("check"),
    promotion: on.includes("promotion"),
    castle: on.includes("castle"),
    capture: on.includes("capture"),
  };
}

describe("sound", () => {
  it("pickSound follows the priority", () => {
    expect(pickSound(flags([]))).toBe("move");

    for (const [flag, kind] of ORDER) {
      expect(pickSound(flags([flag])), flag).toBe(kind);
    }

    // Every pair (10 pairs of two different flags, plus each flag paired with itself
    // given twice, which is the same as alone): the higher one wins.
    let pairs = 0;
    for (let i = 0; i < ORDER.length; i++) {
      for (let j = i; j < ORDER.length; j++) {
        const [hi, kind] = ORDER[i];
        const [lo] = ORDER[j];
        expect(pickSound(flags([hi, lo])), `${hi}+${lo}`).toBe(kind);
        expect(pickSound(flags([lo, hi])), `${lo}+${hi}`).toBe(kind);
        pairs++;
      }
    }
    expect(pairs).toBe(15);

    // All flags at once: game end.
    expect(pickSound(flags(ORDER.map(([f]) => f)))).toBe("game-end");
  });

  it("soundToPlay plays each new ply once", () => {
    const first = { kind: "move" as const };
    const second = { kind: "move" as const };

    expect(soundToPlay(null, first, true)).toBe("move");
    expect(soundToPlay(first, second, true)).toBe("move");
    expect(soundToPlay(first, { kind: "capture" }, true)).toBe("capture");

    // The same object: no replay.
    expect(soundToPlay(first, first, true)).toBeNull();
    // No sound yet, or reset.
    expect(soundToPlay(null, null, true)).toBeNull();
    expect(soundToPlay(first, null, true)).toBeNull();
    // Sound off.
    expect(soundToPlay(first, second, false)).toBeNull();
    expect(soundToPlay(null, first, false)).toBeNull();
  });
});
