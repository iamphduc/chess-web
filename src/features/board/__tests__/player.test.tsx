import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { store } from "app/store";
import { clockForPhase, msUntilNextTick, Player } from "../components/Player";
import { initialClock, TOTAL_MS } from "../clock";

describe("Player", () => {
  it("player renders the new clock at start", () => {
    const html = renderToStaticMarkup(
      <Provider store={store}>
        <Player name="Me" title={null} avatar={null} isWhite={true} />
      </Provider>
    );
    expect(html.match(/role="timer"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Clock for Me"');
    expect(html).toMatch(/<span class="player__timer">10:00<\/span>/);
    // Exactly one svg in the card, and it is our clock icon; a react-icons
    // icon would be a second <svg> without that class.
    const svgs = html.match(/<svg[^>]*>/g) ?? [];
    expect(svgs).toHaveLength(1);
    expect(svgs[0]).toContain('class="clock-icon"');
  });
});

describe("clockForPhase", () => {
  const running = { remainingMs: 500000, startedAt: 1000 };
  const paused = { remainingMs: 500000, startedAt: null };

  it("starts on running, keeping a turn already running", () => {
    expect(clockForPhase("running", paused, 5000)).toEqual({ remainingMs: 500000, startedAt: 5000 });
    expect(clockForPhase("running", running, 5000)).toBe(running);
  });

  it("pauses on paused, storing the time left (final time stays after game over)", () => {
    expect(clockForPhase("paused", running, 3500)).toEqual({ remainingMs: 497500, startedAt: null });
    expect(clockForPhase("paused", paused, 9999)).toBe(paused);
    // a flag fall: paused long after the time ran out stays at 0
    expect(clockForPhase("paused", running, 10_000_000)).toEqual({ remainingMs: 0, startedAt: null });
  });

  it("goes back to 10:00 on reset", () => {
    expect(clockForPhase("reset", running, 3500)).toEqual({ remainingMs: TOTAL_MS, startedAt: null });
    expect(clockForPhase("reset", { remainingMs: 0, startedAt: null }, 1)).toEqual(initialClock());
    const fresh = initialClock();
    expect(clockForPhase("reset", fresh, 1)).toBe(fresh);
  });
});

describe("clockForPhase on a new game", () => {
  it("a new game restarts the clock", () => {
    const low = { remainingMs: 4000, startedAt: 1000 };
    const stopped = { remainingMs: 0, startedAt: null };
    // Running: full time, started now, even if it was already running.
    expect(clockForPhase("running", low, 7000, true)).toEqual({ remainingMs: TOTAL_MS, startedAt: 7000 });
    expect(clockForPhase("running", stopped, 7000, true)).toEqual({ remainingMs: TOTAL_MS, startedAt: 7000 });
    // Paused or reset: back to the start clock.
    expect(clockForPhase("paused", low, 7000, true)).toEqual(initialClock());
    expect(clockForPhase("paused", stopped, 7000, true)).toEqual(initialClock());
    expect(clockForPhase("reset", low, 7000, true)).toEqual(initialClock());
    expect(clockForPhase("reset", initialClock(), 7000, true)).toEqual(initialClock());
    // Without a new game, a running clock keeps its time.
    expect(clockForPhase("running", low, 7000, false)).toBe(low);
  });
});

describe("msUntilNextTick", () => {
  it("waits until the shown digits change, not a fixed second from turn start", () => {
    expect(msUntilNextTick(543210, 1000)).toBe(211); // 09:03 -> 09:02 at 542999
    expect(msUntilNextTick(543000, 1000)).toBe(1);
    expect(msUntilNextTick(600000, 1000)).toBe(1); // 10:00 -> 09:59 right away
    expect(msUntilNextTick(10210, 1000)).toBe(211); // lands on 9999: tenths start on time
  });

  it("steps per tenth under 10s", () => {
    expect(msUntilNextTick(9999, 100)).toBe(100); // 9.9 -> 9.8 at 9899
    expect(msUntilNextTick(9850, 100)).toBe(51);
    expect(msUntilNextTick(50, 100)).toBe(51); // reaches 0 -> flag fall
  });
});
