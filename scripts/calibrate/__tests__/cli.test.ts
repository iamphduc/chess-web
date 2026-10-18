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

  it("measure flags", () => {
    const sparring = STRENGTH_STEPS.filter((s) => s !== "full");
    // Defaults: the six sparring steps, 20 games each.
    expect(parseArgs(["--measure"])).toEqual({
      mode: "measure",
      steps: sparring,
      games: 20,
      seed: 1,
      jobs: expect.any(Number),
    });
    expect(
      parseArgs(["--measure", "--steps", "full,1400", "--games", "3", "--seed", "7", "--jobs", "2"])
    ).toEqual({ mode: "measure", steps: [1400, "full"], games: 3, seed: 7, jobs: 2 });
    // Any whole number of games from 1 up; the flag may come after the others.
    expect(parseArgs(["--games=1", "--measure"])).toMatchObject({ mode: "measure", games: 1 });
    const error = (argv: string[]) => {
      const parsed = parseArgs(argv);
      expect("error" in parsed, argv.join(" ")).toBe(true);
      return (parsed as { error: string }).error;
    };
    expect(error(["--measure", "--games", "0"])).toMatch(/--games.*1 or more/);
    expect(error(["--measure", "--games", "2.5"])).toMatch(/--games/);
    expect(error(["--measure", "--anchors", "0"])).toMatch(/--anchors.*--measure/);
    expect(error(["--anchors", "none", "--measure"])).toMatch(/--anchors.*--measure/);
    expect(error(["--measure", "--anchor-elos", "2400"])).toMatch(/--anchor-elos.*--measure/);
    expect(error(["--measure=yes"])).toMatch(/--measure takes no value/);
    // Old flags parse as before: no mode key, even games only.
    expect(parseArgs(["--games", "2"])).not.toHaveProperty("mode");
    expect(error(["--games", "3"])).toMatch(/--games.*even/);
  });

  it("--measure with --anchors exits with a message, before any engine starts", async () => {
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
    expect(await runCalibrate(["--measure", "--anchors", "0"], deps)).toBe(1);
    expect(started).toBe(0);
    expect(out.join("\n")).toMatch(/ERR --anchors.*--measure/);
    expect(out.join("\n")).toMatch(/usage: npm run calibrate.*--measure/s);
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
