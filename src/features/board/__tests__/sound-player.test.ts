import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSoundPlayer, GESTURE_EVENTS } from "../soundPlayer";
import { SOUND_FILES, SoundKind } from "../sound";

const KINDS = Object.keys(SOUND_FILES) as SoundKind[];

/** A buffer that remembers which URL it was fetched from. */
const bytes = (url: string) => new TextEncoder().encode(url).buffer as ArrayBuffer;
const text = (buf: ArrayBuffer) => new TextDecoder().decode(buf);

type Resume = (ctx: FakeContext) => Promise<void>;

class FakeContext {
  state: "suspended" | "running" = "suspended";
  resumeCalls = 0;
  destination = { name: "destination" };
  gains: { gain: { value: number }; connect: ReturnType<typeof vi.fn> }[] = [];
  sources: {
    buffer: unknown;
    connect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
  }[] = [];
  /** URLs passed to decodeAudioData. */
  decoded: string[] = [];
  failDecode = new Set<string>();
  /** Decodes wait on this when set. */
  decodeGate: Promise<void> | null = null;

  constructor(private resumeImpl: Resume) {}

  resume() {
    this.resumeCalls++;
    return this.resumeImpl(this);
  }

  async decodeAudioData(data: ArrayBuffer) {
    const url = text(data);
    this.decoded.push(url);
    if (this.decodeGate) await this.decodeGate;
    if (this.failDecode.has(url)) throw new Error("decode failed");
    return { url };
  }

  createGain() {
    const gain = { gain: { value: 1 }, connect: vi.fn() };
    this.gains.push(gain);
    return gain;
  }

  createBufferSource() {
    const source = { buffer: null as unknown, connect: vi.fn(), start: vi.fn() };
    this.sources.push(source);
    return source;
  }
}

const runs: Resume = async (ctx) => {
  ctx.state = "running";
};

class FakeTarget {
  listeners = new Map<string, Set<() => void>>();
  addEventListener(type: string, fn: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }
  removeEventListener(type: string, fn: () => void) {
    this.listeners.get(type)?.delete(fn);
  }
  count() {
    let n = 0;
    for (const set of this.listeners.values()) n += set.size;
    return n;
  }
  fire(type: string) {
    for (const fn of [...(this.listeners.get(type) ?? [])]) fn();
  }
}

function setup(
  opts: {
    resume?: Resume;
    supported?: boolean;
    failFetch?: SoundKind[];
    fetchGate?: Promise<void>;
  } = {}
) {
  const contexts: FakeContext[] = [];
  const attrs = new Map<string, string>();
  const fetchFile = vi.fn(async (url: string) => {
    if (opts.fetchGate) await opts.fetchGate;
    if (opts.failFetch?.some((k) => url.endsWith(SOUND_FILES[k]))) throw new Error("404");
    return bytes(url);
  });
  const player = createSoundPlayer({
    createContext:
      opts.supported === false
        ? undefined
        : () => {
            const ctx = new FakeContext(opts.resume ?? runs);
            contexts.push(ctx);
            return ctx;
          },
    fetchFile,
    urlFor: (file) => `/base/sounds/${file}`,
    root: { setAttribute: (name, value) => attrs.set(name, value) },
  });
  const target = new FakeTarget();
  return { player, target, contexts, fetchFile, attrs };
}

/** Let pending promises (fetches, resumes, decodes) settle. */
async function settle() {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
}

const unhandled: unknown[] = [];
const onUnhandled = (reason: unknown) => unhandled.push(reason);
beforeEach(() => {
  unhandled.length = 0;
  process.on("unhandledRejection", onUnhandled);
});
afterEach(() => {
  process.off("unhandledRejection", onUnhandled);
});

describe("sound player", () => {
  it("context waits for the first gesture", async () => {
    const { player, target, contexts, fetchFile } = setup();

    player.install(target);
    player.install(target); // StrictMode mounts twice
    await settle();

    expect(contexts).toHaveLength(0);
    expect(fetchFile).toHaveBeenCalledTimes(KINDS.length);
    expect(fetchFile.mock.calls.map(([url]) => url).sort()).toEqual(
      KINDS.map((k) => `/base/sounds/${SOUND_FILES[k]}`).sort()
    );
    // One listener per gesture event, not two.
    expect(GESTURE_EVENTS).toEqual(["pointerdown", "pointerup", "keydown", "touchend"]);
    expect(target.count()).toBe(GESTURE_EVENTS.length);

    target.fire("pointerdown");
    await settle();
    expect(contexts).toHaveLength(1);
    const ctx = contexts[0];
    expect(ctx.resumeCalls).toBe(1);
    expect(ctx.decoded.sort()).toEqual(
      KINDS.map((k) => `/base/sounds/${SOUND_FILES[k]}`).sort()
    );

    // Running: the listeners are gone, and later gestures create nothing.
    expect(target.count()).toBe(0);
    for (const type of GESTURE_EVENTS) target.fire(type);
    player.install(target);
    await settle();
    expect(contexts).toHaveLength(1);
    expect(ctx.resumeCalls).toBe(1);
    expect(fetchFile).toHaveBeenCalledTimes(KINDS.length);
    expect(unhandled).toEqual([]);
  });

  it("resume retried on the next gesture", async () => {
    // First resume rejects, second leaves it suspended, third runs.
    let call = 0;
    const { player, target, contexts } = setup({
      resume: async (ctx) => {
        call++;
        if (call === 1) throw new Error("not allowed");
        if (call === 3) ctx.state = "running";
      },
    });
    player.install(target);
    await settle();

    target.fire("keydown");
    await settle();
    expect(contexts).toHaveLength(1);
    expect(contexts[0].resumeCalls).toBe(1);
    expect(target.count()).toBe(GESTURE_EVENTS.length);

    target.fire("touchend");
    await settle();
    expect(contexts).toHaveLength(1);
    expect(contexts[0].resumeCalls).toBe(2);
    expect(target.count()).toBe(GESTURE_EVENTS.length);

    target.fire("pointerup");
    await settle();
    expect(contexts).toHaveLength(1);
    expect(contexts[0].resumeCalls).toBe(3);
    expect(target.count()).toBe(0);

    // Files are decoded once, not once per gesture.
    expect(contexts[0].decoded).toHaveLength(KINDS.length);
    expect(unhandled).toEqual([]);
  });

  it("play skips what isn't ready", async () => {
    // Before any gesture: no context, nothing starts.
    const early = setup();
    early.player.install(early.target);
    await settle();
    expect(() => early.player.play("move")).not.toThrow();
    expect(early.contexts).toHaveLength(0);
    expect(early.attrs.size).toBe(0);

    // A failed fetch and a failed decode skip only those kinds.
    const broken = setup({ failFetch: ["capture"] });
    broken.player.install(broken.target);
    await settle();
    broken.target.fire("pointerdown");
    const ctx = broken.contexts[0];
    ctx.failDecode.add(`/base/sounds/${SOUND_FILES.check}`);
    await settle();
    expect(() => broken.player.play("capture")).not.toThrow();
    expect(() => broken.player.play("check")).not.toThrow();
    expect(ctx.sources).toHaveLength(0);
    broken.player.play("move");
    expect(ctx.sources).toHaveLength(1);
    expect(broken.attrs.get("data-last-sound")).toBe("move 1");

    // No Web Audio: install and gestures do nothing, and play never throws.
    const none = setup({ supported: false });
    expect(() => none.player.install(none.target)).not.toThrow();
    none.target.fire("pointerdown");
    await settle();
    expect(() => none.player.play("move")).not.toThrow();
    expect(none.attrs.size).toBe(0);

    expect(unhandled).toEqual([]);
  });

  it("play waits for a fetch that ends after the gesture", async () => {
    let open!: () => void;
    const gate = new Promise<void>((r) => (open = r));
    const slow = setup({ fetchGate: gate });
    slow.player.install(slow.target);
    slow.target.fire("pointerdown");
    await settle();
    const ctx = slow.contexts[0];

    // Still fetching: nothing to play yet.
    slow.player.play("move");
    expect(ctx.sources).toHaveLength(0);

    open();
    await settle();
    expect(ctx.decoded).toHaveLength(KINDS.length);
    slow.player.play("move");
    expect(ctx.sources).toHaveLength(1);
  });

  it("play starts the buffer and marks it", async () => {
    const { player, target, contexts, attrs } = setup();
    player.install(target);
    await settle();
    target.fire("pointerdown");
    await settle();
    const ctx = contexts[0];

    // One fixed gain node, wired to the speakers.
    expect(ctx.gains).toHaveLength(1);
    const gain = ctx.gains[0];
    expect(gain.connect).toHaveBeenCalledWith(ctx.destination);

    player.play("capture");
    expect(ctx.sources).toHaveLength(1);
    const first = ctx.sources[0];
    expect(first.buffer).toEqual({ url: `/base/sounds/${SOUND_FILES.capture}` });
    expect(first.connect).toHaveBeenCalledWith(gain);
    expect(first.start).toHaveBeenCalledTimes(1);
    expect(attrs.get("data-last-sound")).toBe("capture 1");

    // A second sound doesn't stop the first.
    player.play("check");
    expect(ctx.sources).toHaveLength(2);
    expect(attrs.get("data-last-sound")).toBe("check 2");
    player.play("check");
    expect(attrs.get("data-last-sound")).toBe("check 3");
    expect(ctx.gains).toHaveLength(1);

    // A play with no buffer leaves the mark alone.
    const other = setup({ failFetch: ["castle"] });
    other.player.install(other.target);
    other.target.fire("pointerdown");
    await settle();
    other.player.play("move");
    expect(other.attrs.get("data-last-sound")).toBe("move 1");
    other.player.play("castle");
    expect(other.attrs.get("data-last-sound")).toBe("move 1");
  });
});
