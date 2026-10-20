import { describe, expect, it } from "vitest";

import { avatarSrc } from "../components/avatar";
import { players } from "../../../game/players";
import leQuangLiem from "../../../assets/le-quang-liem.png";

// No default picture: a player without a known avatar gets a color disc (Player.tsx).
describe("avatarSrc", () => {
  it("returns null for null or an empty name", () => {
    expect(avatarSrc(null)).toBeNull();
    expect(avatarSrc("")).toBeNull();
  });

  it("returns the matching image for a known avatar name", () => {
    expect(avatarSrc("le-quang-liem.png")).toBe(leQuangLiem);
  });

  it("returns null for unknown, near-miss and object-key names", () => {
    for (const name of [
      "nobody.png",
      "Le-Quang-Liem.png",
      " le-quang-liem.png",
      "le-quang-liem",
      "../assets/le-quang-liem.png",
      "toString",
      "__proto__",
      "constructor",
    ]) {
      expect(avatarSrc(name), name).toBeNull();
    }
  });

  it("the board's own players have no photo", () => {
    expect(players.map((p) => p.avatar)).toEqual([null, null]);
  });
});
