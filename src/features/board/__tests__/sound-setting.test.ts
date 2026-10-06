import { afterEach, describe, expect, it, vi } from "vitest";

import { loadSoundOn, saveSoundOn, SOUND_STORAGE_KEY } from "../soundSetting";

/** An in-memory Storage-like object. */
function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => (data.has(key) ? (data.get(key) as string) : null),
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
  };
}

const throwing = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("quota");
  },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sound setting", () => {
  it("loadSoundOn defaults to on", () => {
    expect(SOUND_STORAGE_KEY).toBe("chess-web.sound");

    expect(loadSoundOn(() => memory())).toBe(true);
    expect(loadSoundOn(() => memory({ [SOUND_STORAGE_KEY]: "on" }))).toBe(true);
    expect(loadSoundOn(() => memory({ [SOUND_STORAGE_KEY]: "junk" }))).toBe(true);
    expect(loadSoundOn(() => memory({ [SOUND_STORAGE_KEY]: "OFF" }))).toBe(true);
    expect(loadSoundOn(() => memory({ "other.key": "off" }))).toBe(true);
    expect(loadSoundOn(() => throwing)).toBe(true);
    expect(
      loadSoundOn(() => {
        throw new Error("SecurityError");
      })
    ).toBe(true);
    expect(loadSoundOn(() => undefined)).toBe(true);

    expect(loadSoundOn(() => memory({ [SOUND_STORAGE_KEY]: "off" }))).toBe(false);
  });

  it("saveSoundOn never throws", () => {
    const store = memory();
    saveSoundOn(() => store, false);
    expect(store.data.get(SOUND_STORAGE_KEY)).toBe("off");
    expect(loadSoundOn(() => store)).toBe(false);
    saveSoundOn(() => store, true);
    expect(store.data.get(SOUND_STORAGE_KEY)).toBe("on");
    expect(loadSoundOn(() => store)).toBe(true);

    const logs = [
      vi.spyOn(console, "error"),
      vi.spyOn(console, "warn"),
      vi.spyOn(console, "log"),
    ];
    expect(() => saveSoundOn(() => throwing, false)).not.toThrow();
    expect(() => saveSoundOn(() => undefined, true)).not.toThrow();
    expect(() =>
      saveSoundOn(() => {
        throw new Error("SecurityError");
      }, true)
    ).not.toThrow();
    for (const spy of logs) expect(spy).not.toHaveBeenCalled();
  });
});
