import { describe, expect, it } from "vitest";

import { avatarSrc } from "../components/avatar";
import { players } from "../../../game/players";
import defaultAvatar from "../../../assets/chess-player.png";
import leQuangLiem from "../../../assets/le-quang-liem.png";

describe("avatarSrc", () => {
  it("returns the default avatar for null", () => {
    expect(avatarSrc(null)).toBe(defaultAvatar);
  });

  it("returns the default avatar for an empty name", () => {
    expect(avatarSrc("")).toBe(defaultAvatar);
  });

  it("returns the matching image for a known avatar name", () => {
    expect(avatarSrc("le-quang-liem.png")).toBe(leQuangLiem);
    expect(avatarSrc("le-quang-liem.png")).not.toBe(defaultAvatar);
  });

  it("falls back to the default for an unknown avatar name", () => {
    expect(() => avatarSrc("nobody.png")).not.toThrow();
    expect(avatarSrc("nobody.png")).toBe(defaultAvatar);
  });

  it("falls back to the default for near-miss and object-key names", () => {
    for (const name of [
      "Le-Quang-Liem.png",
      " le-quang-liem.png",
      "le-quang-liem",
      "../assets/le-quang-liem.png",
      "toString",
      "__proto__",
      "constructor",
    ]) {
      expect(avatarSrc(name)).toBe(defaultAvatar);
    }
  });

  it("every configured player avatar is registered", () => {
    const named = players.filter((p) => p.avatar !== null);
    expect(named.length).toBeGreaterThan(0);
    for (const p of named) {
      const src = avatarSrc(p.avatar);
      expect(typeof src).toBe("string");
      expect(src).not.toBe("");
      expect(src).not.toBe(defaultAvatar);
    }
  });
});
