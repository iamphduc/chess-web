import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Laptop and phone speakers play little below about 250 Hz. A sound whose energy sits
// down there (a bass thump) is silent on them, so every sound must carry most of its
// energy above 250 Hz during its loud part.
const SOUNDS = join(__dirname, "..", "public", "sounds");

// Thresholds. On 2026-10-06 the old capture.wav measured DC 0.18, 139 Hz, 91 % bass
// and the old castle.wav 70 % bass (both inaudible on small speakers); check.wav measured
// 2830 Hz and 4 % bass, promote.wav 1518 Hz and 5 % bass (both audible).
const MAX_DC = 0.15; // |mean| / RMS over the loud part
const MIN_CROSSING_HZ = 200; // zero crossings / 2 per second over the loud part
const MAX_BASS = 0.5; // share of loud-part energy below 250 Hz

type Wav = { rate: number; channels: number; samples: Float64Array };

function readWav(path: string): Wav {
  const b = readFileSync(path);
  let p = 12;
  let fmt: Buffer | undefined;
  let data: Buffer | undefined;
  while (p + 8 <= b.length) {
    const id = b.toString("latin1", p, p + 4);
    const size = b.readUInt32LE(p + 4);
    if (id === "fmt ") fmt = b.subarray(p + 8, p + 8 + size);
    if (id === "data") data = b.subarray(p + 8, p + 8 + size);
    p += 8 + size + (size % 2);
  }
  if (!fmt || !data) throw new Error(`${path}: no fmt or data chunk`);
  const channels = fmt.readUInt16LE(2);
  const rate = fmt.readUInt32LE(4);
  const bits = fmt.readUInt16LE(14);
  if (bits !== 16) throw new Error(`${path}: expected 16-bit PCM, got ${bits}`);
  // Mix to mono.
  const frames = Math.floor(data.length / 2 / channels);
  const samples = new Float64Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += data.readInt16LE((i * channels + c) * 2) / 32768;
    samples[i] = sum / channels;
  }
  return { rate, channels, samples };
}

/** Measures the loud part: the samples whose 10 ms RMS is at least a quarter of the loudest. */
function measure({ rate, samples: x }: Wav) {
  const w = Math.max(1, Math.round(rate * 0.01));
  const env = new Float64Array(x.length);
  let s = 0;
  for (let i = 0; i < x.length; i++) {
    s += x[i] * x[i];
    if (i >= w) s -= x[i - w] * x[i - w];
    env[i] = Math.sqrt(Math.max(0, s) / w);
  }
  let top = 0;
  for (const e of env) top = Math.max(top, e);

  const a = Math.exp((-2 * Math.PI * 250) / rate); // one-pole low-pass at 250 Hz
  let lp = 0;
  let low = 0;
  let all = 0;
  let sum = 0;
  let count = 0;
  let crossings = 0;
  for (let i = 0; i < x.length; i++) {
    lp = (1 - a) * x[i] + a * lp;
    if (top === 0 || env[i] < top * 0.25) continue;
    low += lp * lp;
    all += x[i] * x[i];
    sum += x[i];
    count++;
    if (i > 0 && x[i] >= 0 !== x[i - 1] >= 0) crossings++;
  }
  const rms = count ? Math.sqrt(all / count) : 0;
  return {
    dc: rms ? Math.abs(sum / count) / rms : 1,
    crossingHz: count ? (crossings / 2) * (rate / count) : 0,
    bass: all ? low / all : 1,
  };
}

const files = readdirSync(SOUNDS).filter((f) => f.endsWith(".wav"));

describe("sounds are audible on small speakers", () => {
  it("finds the sound files", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s has no large DC offset, crosses zero, and is mostly above 250 Hz", (file) => {
    const m = measure(readWav(join(SOUNDS, file)));
    const shown = `${file}: dc ${m.dc.toFixed(2)}, ${m.crossingHz.toFixed(0)} Hz, bass ${(m.bass * 100).toFixed(0)}%`;
    expect(m.dc, shown).toBeLessThan(MAX_DC);
    expect(m.crossingHz, shown).toBeGreaterThanOrEqual(MIN_CROSSING_HZ);
    expect(m.bass, shown).toBeLessThan(MAX_BASS);
  });

  it("a low thump fails and a 1 kHz tone passes (the check itself works)", () => {
    const rate = 22050;
    const tone = (hz: number, offset = 0) =>
      Float64Array.from({ length: rate / 4 }, (_, i) => offset + 0.5 * Math.sin((2 * Math.PI * hz * i) / rate));
    const thump = measure({ rate, channels: 1, samples: tone(80) });
    expect(thump.bass).toBeGreaterThanOrEqual(MAX_BASS);
    const offset = measure({ rate, channels: 1, samples: tone(1000, 0.4) });
    expect(offset.dc).toBeGreaterThanOrEqual(MAX_DC);
    const clean = measure({ rate, channels: 1, samples: tone(1000) });
    expect(clean.dc).toBeLessThan(MAX_DC);
    expect(clean.crossingHz).toBeGreaterThanOrEqual(MIN_CROSSING_HZ);
    expect(clean.bass).toBeLessThan(MAX_BASS);
  });
});
