import { describe, expect, it } from "vitest";

import {
  LOW_TIME_MS,
  TENTHS_MS,
  TOTAL_MS,
  clockPhase,
  clockStage,
  formatClock,
  handAngle,
  initialClock,
  lowTimeAlert,
  pauseClock,
  remainingMs,
  startClock,
  tickInterval,
  type ClockPhase,
  type ClockState,
} from "../clock";

const T = 1_700_000_000_000; // a realistic Date.now() value

describe("clock", () => {
  it("initial clock is 10 minutes and paused", () => {
    expect(TOTAL_MS).toBe(600_000);
    expect(LOW_TIME_MS).toBe(20_000);
    expect(TENTHS_MS).toBe(10_000);
    expect(initialClock()).toEqual({ remainingMs: 600_000, startedAt: null });
    // a paused clock reads the same at any time
    expect(remainingMs(initialClock(), T)).toBe(600_000);
    expect(remainingMs(initialClock(), T + 123_456)).toBe(600_000);
    // each call gives a fresh object
    expect(initialClock()).not.toBe(initialClock());
  });

  it("countdown has no drift across late ticks", () => {
    const running = startClock(initialClock(), T);
    expect(running.startedAt).toBe(T);
    expect(remainingMs(running, T)).toBe(600_000);
    expect(remainingMs(running, T + 1000)).toBe(599_000);
    expect(remainingMs(running, T + 2350)).toBe(597_650);
    expect(remainingMs(running, T + 7999)).toBe(592_001);
    // reading again after many reads gives the same exact value
    for (let i = 0; i < 100; i++) remainingMs(running, T + i * 37);
    expect(remainingMs(running, T + 7999)).toBe(592_001);
  });

  it("turn switch does not count waiting time", () => {
    let clock = startClock(initialClock(), T);
    clock = pauseClock(clock, T + 3000);
    expect(clock).toEqual({ remainingMs: 597_000, startedAt: null });
    // the other side thinks for 50 s
    expect(remainingMs(clock, T + 53_000)).toBe(597_000);
    clock = startClock(clock, T + 53_000);
    expect(clock).toEqual({ remainingMs: 597_000, startedAt: T + 53_000 });
    expect(remainingMs(clock, T + 54_500)).toBe(595_500);
    clock = pauseClock(clock, T + 54_500);
    expect(clock).toEqual({ remainingMs: 595_500, startedAt: null });
  });

  it("start and pause are idempotent and pure", () => {
    const paused: ClockState = { remainingMs: 500_000, startedAt: null };
    const pausedCopy = { ...paused };
    const running = startClock(paused, T);
    expect(paused).toEqual(pausedCopy); // not mutated
    expect(running).not.toBe(paused);

    // start on a running clock: unchanged, does not restart the turn
    const runningCopy = { ...running };
    const again = startClock(running, T + 5000);
    expect(again).toEqual(runningCopy);
    expect(running).toEqual(runningCopy);
    expect(remainingMs(again, T + 5000)).toBe(495_000);

    // pause on a paused clock: unchanged
    const stillPaused = pauseClock(paused, T + 9000);
    expect(stillPaused).toEqual(pausedCopy);
    expect(paused).toEqual(pausedCopy);

    // pause on a running clock does not mutate the running one
    const stopped = pauseClock(running, T + 2000);
    expect(stopped).toEqual({ remainingMs: 498_000, startedAt: null });
    expect(running).toEqual(runningCopy);
  });

  it("remaining clamps at zero and ignores a clock moving back", () => {
    const running = startClock({ remainingMs: 5000, startedAt: null }, T);
    expect(remainingMs(running, T + 5000)).toBe(0);
    expect(remainingMs(running, T + 60_000)).toBe(0);
    expect(pauseClock(running, T + 60_000)).toEqual({ remainingMs: 0, startedAt: null });
    // now < startedAt: elapsed counts as 0
    expect(remainingMs(running, T - 10_000)).toBe(5000);
    expect(pauseClock(running, T - 10_000)).toEqual({ remainingMs: 5000, startedAt: null });
  });

  it("formats minutes, seconds and tenths", () => {
    const cases: Array<[number, string]> = [
      [600_000, "10:00"],
      [599_999, "09:59"],
      [61_000, "01:01"],
      [60_000, "01:00"],
      [59_999, "00:59"],
      [19_999, "00:19"],
      [10_000, "00:10"],
      [9999, "9.9"],
      [9800, "9.8"],
      [1000, "1.0"],
      [999, "0.9"],
      [99, "0.0"],
      [0, "0.0"],
      [-5, "0.0"],
    ];
    for (const [ms, text] of cases) expect(formatClock(ms), String(ms)).toBe(text);
  });

  it("stage thresholds at 20s and 10s", () => {
    expect(clockStage(600_000)).toBe("normal");
    expect(clockStage(20_000)).toBe("normal");
    expect(clockStage(19_999)).toBe("low");
    expect(clockStage(10_000)).toBe("low");
    expect(clockStage(9999)).toBe("critical");
    expect(clockStage(0)).toBe("critical");
    expect(clockStage(-1)).toBe("critical");
    // red starts exactly when the digits read 00:19
    expect(formatClock(19_999)).toBe("00:19");
    expect(formatClock(20_000)).toBe("00:20");
  });

  it("hand steps a quarter turn per whole second", () => {
    expect(handAngle(600_000)).toBe(0);
    expect(handAngle(599_999)).toBe(90);
    expect(handAngle(599_000)).toBe(90);
    expect(handAngle(598_000)).toBe(180);
    expect(handAngle(597_000)).toBe(270);
    expect(handAngle(596_000)).toBe(0);
    expect(handAngle(9800)).toBe(handAngle(9100));
    expect(handAngle(-5)).toBe(handAngle(0));
    expect(handAngle(-5000)).toBe(handAngle(0));
    for (let ms = -3000; ms <= 600_000; ms += 777) {
      expect([0, 90, 180, 270]).toContain(handAngle(ms));
    }
  });

  it("hand and digits change together", () => {
    // whole seconds as the digits show them
    const shownSeconds = (ms: number): number => {
      const text = formatClock(ms);
      if (text.includes(":")) {
        const [m, s] = text.split(":").map(Number);
        return m * 60 + s;
      }
      return Math.floor(Number(text));
    };
    const ranges: Array<[number, number]> = [
      [595_000, 600_000],
      [8000, 22_000],
      [0, 3000],
    ];
    let changes = 0;
    for (const [from, to] of ranges) {
      for (let ms = to; ms > from; ms -= 1) {
        const digitsChanged = shownSeconds(ms) !== shownSeconds(ms - 1);
        const handChanged = handAngle(ms) !== handAngle(ms - 1);
        if (digitsChanged !== handChanged) {
          throw new Error(`hand and digits disagree between ${ms} and ${ms - 1}`);
        }
        if (digitsChanged) changes += 1;
      }
    }
    // one change per whole second crossed: 5 + 14 + 3
    expect(changes).toBe(22);
  });

  it("phase covers reset, running and paused", () => {
    // before Play / after Reset
    expect(clockPhase(false, true, true)).toBe("reset");
    expect(clockPhase(false, false, true)).toBe("reset");
    // the side to move while playing
    expect(clockPhase(true, true, true)).toBe("running");
    // the waiting side
    expect(clockPhase(true, false, true)).toBe("paused");
    // game over, playing or not, active or not: keep the final time
    expect(clockPhase(true, true, false)).toBe("paused");
    expect(clockPhase(true, false, false)).toBe("paused");
    expect(clockPhase(false, true, false)).toBe("paused");
    expect(clockPhase(false, false, false)).toBe("paused");
  });

  it("tick interval is 1s, 100ms under 10s, none when not running", () => {
    expect(tickInterval("running", 600_000)).toBe(1000);
    expect(tickInterval("running", 10_000)).toBe(1000);
    expect(tickInterval("running", 9999)).toBe(100);
    expect(tickInterval("running", 0)).toBe(100);
    const idle: ClockPhase[] = ["reset", "paused"];
    for (const phase of idle) {
      for (const ms of [600_000, 10_000, 9999, 0]) {
        expect(tickInterval(phase, ms)).toBeNull();
      }
    }
  });

  it("alert text appears under 10s", () => {
    expect(lowTimeAlert(600_000)).toBe("");
    expect(lowTimeAlert(10_000)).toBe("");
    expect(lowTimeAlert(9999)).toBe("10 seconds left");
    expect(lowTimeAlert(0)).toBe("10 seconds left");
  });
});
