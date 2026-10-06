import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { SOUND_FILES, SoundKind } from "../src/features/board/sound";

const ROOT = join(__dirname, "..");
const SOUNDS = join(ROOT, "public", "sounds");
const VITE_BIN = join(ROOT, "node_modules", "vite", "bin", "vite.js");
const KINDS: SoundKind[] = ["game-end", "check", "promote", "castle", "capture", "move"];

let outDir: string;
let build: SpawnSyncReturns<string>;

beforeAll(() => {
  outDir = mkdtempSync(join(tmpdir(), "chess-web-sounds-"));
  build = spawnSync(process.execPath, [VITE_BIN, "build", "--outDir", outDir, "--emptyOutDir"], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, NODE_ENV: "production", VITEST: "" },
  });
}, 180_000);

afterAll(() => {
  rmSync(outDir, { recursive: true, force: true });
});

describe("sound files", () => {
  it("every sound kind ships a file", () => {
    expect(Object.keys(SOUND_FILES).sort()).toEqual([...KINDS].sort());

    const files = new Set<string>();
    for (const kind of KINDS) {
      const file = SOUND_FILES[kind];
      expect(file, kind).toMatch(/^[a-z0-9-]+\.(mp3|wav)$/);
      files.add(file);

      const path = join(SOUNDS, file);
      expect(existsSync(path), path).toBe(true);
      const size = statSync(path).size;
      expect(size, file).toBeGreaterThan(0);
      expect(size, file).toBeLessThan(100 * 1024);

      // The bytes match the extension: RIFF/WAVE, or an MP3 frame or ID3 tag.
      const head = readFileSync(path).subarray(0, 12);
      if (file.endsWith(".wav")) {
        expect(head.toString("latin1", 0, 4), file).toBe("RIFF");
        expect(head.toString("latin1", 8, 12), file).toBe("WAVE");
      } else {
        const id3 = head.toString("latin1", 0, 3) === "ID3";
        const frame = head[0] === 0xff && (head[1] & 0xe0) === 0xe0;
        expect(id3 || frame, file).toBe(true);
      }
    }
    // One distinct file per kind.
    expect(files.size).toBe(KINDS.length);

    const credits = readFileSync(join(SOUNDS, "CREDITS.md"), "utf8");
    expect(credits).toMatch(/CC0/);
    for (const file of files) expect(credits, file).toContain(file);

    // The build copies them to dist/sounds/.
    expect(build.status, `${build.stdout}\n${build.stderr}`).toBe(0);
    for (const file of files) {
      const built = join(outDir, "sounds", file);
      expect(existsSync(built), built).toBe(true);
      expect(statSync(built).size).toBe(statSync(join(SOUNDS, file)).size);
    }
  });
});
