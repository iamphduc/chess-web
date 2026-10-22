/** The `localStorage` key for the Sound setting. Its value is "on" or "off". */
export const SOUND_STORAGE_KEY = "liem-sparring.sound";

/** The key used before the project was renamed (2026-10-21). Read only when the new key is unset. */
export const LEGACY_SOUND_STORAGE_KEY = "chess-web.sound";

/** The parts of `Storage` the setting uses. */
export interface SoundStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Returns the storage. It may throw (blocked site data) or return nothing (no storage). */
export type GetStorage = () => SoundStorage | null | undefined;

/** Sound is on unless the saved value (the new key, else the old one) is exactly "off". Never throws. */
export function loadSoundOn(getStorage: GetStorage): boolean {
  try {
    const storage = getStorage();
    const saved = storage?.getItem(SOUND_STORAGE_KEY) ?? storage?.getItem(LEGACY_SOUND_STORAGE_KEY);
    return saved !== "off";
  } catch {
    return true;
  }
}

/** Saves the setting. A missing or failing storage is ignored: nothing thrown, nothing logged. */
export function saveSoundOn(getStorage: GetStorage, on: boolean): void {
  try {
    getStorage()?.setItem(SOUND_STORAGE_KEY, on ? "on" : "off");
  } catch {
    // The in-memory setting still changes; it just isn't remembered.
  }
}

/** The browser's `localStorage`. Referencing it can throw, so call it through the functions above. */
export const browserStorage: GetStorage = () => window.localStorage;
