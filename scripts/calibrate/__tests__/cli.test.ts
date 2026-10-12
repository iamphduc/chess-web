import { describe, expect, it } from "vitest";
import { STRENGTH_STEPS } from "../../../src/game/opponent/strength";
import { parseArgs, runCalibrate, type CalibrateDeps } from "../calibrate";

describe("calibrate CLI", () => {
  it("parses steps, anchors, games and seed", () => {
    expect(parseArgs([])).toEqual({
      steps: [...STRENGTH_STEPS],
      anchors: [-200, 0, 200],
      games: 4,
      anchorElos: null,
      seed: 1,
      jobs: expect.any(Number),
    });
    expect(
      parseArgs(["--steps", "1400,full,1900", "--anchors", "0,-200", "--games", "6", "--seed", "42", "--jobs", "2"])
    ).toEqual({ steps: [1400, 1900, "full"], anchors: [-200, 0], anchorElos: null, games: 6, seed: 42, jobs: 2 });
    // --anchor-elos: the same anchors for every step, clamped to Stockfish's range.
    expect(parseArgs(["--anchor-elos", "2400,1000,3500,2400"])).toMatchObject({ anchorElos: [1320, 2400, 3190] });
    // The same step twice runs once; --anchors none leaves only the next-step pairing.
    expect(parseArgs(["--steps", "1400,1400"])).toMatchObject({ steps: [1400] });
    expect(parseArgs(["--anchors", "none"])).toMatchObject({ anchors: [] });
    expect(parseArgs(["--steps=2100", "--games=2"])).toMatchObject({ steps: [2100], games: 2 });
  });

  it("rejects bad flags with a message", () => {
    const error = (argv: string[]) => {
      const parsed = parseArgs(argv);
      expect("error" in parsed, argv.join(" ")).toBe(true);
      return (parsed as { error: string }).error;
    };
    expect(error(["--games", "3"])).toMatch(/--games.*even/);
    expect(error(["--games", "0"])).toMatch(/--games/);
    expect(error(["--games", "two"])).toMatch(/--games/);
    expect(error(["--steps", "1500"])).toMatch(/unknown step "1500".*1400.*full/);
    expect(error(["--steps", ""])).toMatch(/--steps/);
    expect(error(["--anchors", "0,abc"])).toMatch(/--anchors/);
    expect(error(["--seed", "1.5"])).toMatch(/--seed/);
    expect(error(["--anchor-elos", "2400,x"])).toMatch(/--anchor-elos/);
    expect(error(["--jobs", "0"])).toMatch(/--jobs/);
    expect(error(["--games"])).toMatch(/--games needs a value/);
    expect(error(["--fast"])).toMatch(/unknown flag "--fast"/);
  });

  it("an odd --games or an unknown step exits with a message, before any engine starts", async () => {
    const out: string[] = [];
    let started = 0;
    const deps: CalibrateDeps = {
      log: (line) => out.push(line),
      error: (line) => out.push(`ERR ${line}`),
      startEngine: () => {
        started += 1;
        throw new Error("no engine in tests");
      },
      now: () => 0,
    };
    expect(await runCalibrate(["--games", "3"], deps)).toBe(1);
    expect(await runCalibrate(["--steps", "1500"], deps)).toBe(1);
    expect(started).toBe(0);
    expect(out.filter((l) => l.startsWith("ERR "))).toHaveLength(2);
    expect(out.join("\n")).toMatch(/usage: npm run calibrate/);
  });
});
