import { SOUND_FILES, SoundKind } from "./sound";

/** The events that count as a user gesture for unlocking audio. */
export const GESTURE_EVENTS = ["pointerdown", "pointerup", "keydown", "touchend"] as const;

/** Volume of every move sound. */
const GAIN = 0.7;

/** The parts of an `AudioNode` the player uses. */
interface NodeLike {
  connect(destination: unknown): unknown;
}

interface GainLike extends NodeLike {
  gain: { value: number };
}

interface SourceLike extends NodeLike {
  buffer: unknown;
  start(): void;
}

/** The parts of an `AudioContext` the player uses. */
export interface AudioContextLike {
  readonly state: string;
  readonly destination: unknown;
  resume(): Promise<void>;
  decodeAudioData(data: ArrayBuffer): Promise<unknown>;
  createGain(): GainLike;
  createBufferSource(): SourceLike;
}

interface GestureTarget {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

export interface SoundPlayerDeps {
  /** Makes the audio context; `undefined` when the browser has no Web Audio. */
  createContext: (() => AudioContextLike) | undefined;
  /** Fetches a sound file's bytes; rejects on any failure. */
  fetchFile: (url: string) => Promise<ArrayBuffer>;
  /** The URL of a file in `public/sounds/`. */
  urlFor: (file: string) => string;
  /** Gets `data-last-sound` (the page's `<html>` element). */
  root: { setAttribute(name: string, value: string): void };
}

export interface SoundPlayer {
  /** Fetches every file and waits for the first gesture. Safe to call more than once. */
  install(target: GestureTarget): void;
  /** Starts a kind's sound if it's ready; otherwise does nothing. Never throws. */
  play(kind: SoundKind): void;
}

const KINDS = Object.keys(SOUND_FILES) as SoundKind[];

export function createSoundPlayer(deps: SoundPlayerDeps): SoundPlayer {
  let installed = false;
  let ctx: AudioContextLike | null = null;
  let gain: GainLike | null = null;
  let started = 0;
  let target: GestureTarget | null = null;
  const fetched = new Map<SoundKind, Promise<ArrayBuffer | null>>();
  const buffers = new Map<SoundKind, unknown>();

  const removeListeners = () => {
    if (!target) return;
    for (const type of GESTURE_EVENTS) target.removeEventListener(type, onGesture);
    target = null;
  };

  const removeIfRunning = () => {
    if (ctx?.state === "running") removeListeners();
  };

  /** Decodes each file once its fetch is done. Failures just leave that kind silent. */
  const decodeAll = (context: AudioContextLike) => {
    for (const kind of KINDS) {
      const data = fetched.get(kind) ?? Promise.resolve(null);
      data
        .then((bytes) => (bytes ? context.decodeAudioData(bytes) : null))
        .then((buffer) => {
          if (buffer) buffers.set(kind, buffer);
        })
        .catch(() => {});
    }
  };

  function onGesture() {
    if (!deps.createContext) return;
    try {
      if (!ctx) {
        ctx = deps.createContext();
        gain = ctx.createGain();
        gain.gain.value = GAIN;
        gain.connect(ctx.destination);
        decodeAll(ctx);
      }
      // resume() must be called inside the gesture to count.
      ctx.resume().then(removeIfRunning, () => {});
      removeIfRunning();
    } catch {
      // A context that can't be made or resumed: try again on the next gesture.
    }
  }

  return {
    install(gestureTarget) {
      if (installed) return;
      installed = true;
      // No Web Audio: nothing could ever play, so fetch nothing.
      if (!deps.createContext) return;
      for (const kind of KINDS) {
        const url = deps.urlFor(SOUND_FILES[kind]);
        const bytes = Promise.resolve()
          .then(() => deps.fetchFile(url))
          .catch(() => null);
        fetched.set(kind, bytes);
      }
      target = gestureTarget;
      for (const type of GESTURE_EVENTS) target.addEventListener(type, onGesture);
    },

    play(kind) {
      const buffer = buffers.get(kind);
      if (!ctx || !gain || !buffer) return;
      try {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(gain);
        source.start();
        started++;
        deps.root.setAttribute("data-last-sound", `${kind} ${started}`);
      } catch {
        // A sound that can't start is skipped.
      }
    },
  };
}

/** The browser wiring: Web Audio, `fetch`, the app's base URL and `<html>`. */
export function browserSoundDeps(): SoundPlayerDeps {
  const AudioContextClass: typeof AudioContext | undefined =
    typeof window === "undefined"
      ? undefined
      : window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return {
    createContext: AudioContextClass ? () => new AudioContextClass() : undefined,
    fetchFile: (url) =>
      fetch(url).then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(url)))),
    urlFor: (file) => `${import.meta.env.BASE_URL}sounds/${file}`,
    root: document.documentElement,
  };
}

let appPlayer: SoundPlayer | null = null;

/** The app's single player, made on first use. */
export function appSoundPlayer(): SoundPlayer {
  appPlayer ??= createSoundPlayer(browserSoundDeps());
  return appPlayer;
}
