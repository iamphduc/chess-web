import { describe, expect, it } from "vitest";

import {
  CONFIRM_MS,
  confirmEndsIn,
  isConfirming,
  pressResign,
  resignIdle,
  type ResignConfirm,
} from "../resignConfirm";

const T = 1_000_000;

/** Presses at each time in `times`, in game `gameId`; returns how many presses resigned and the last state. */
function pressAt(times: number[], gameId = 1, start: ResignConfirm = resignIdle(gameId)) {
  let state = start;
  let resigns = 0;
  for (const now of times) {
    const { next, resign } = pressResign(state, now, gameId);
    state = next;
    if (resign) resigns++;
  }
  return { state, resigns };
}

describe("resign confirm", () => {
  it("a second press within 3 s resigns", () => {
    expect(CONFIRM_MS).toBe(3000);
    expect(isConfirming(resignIdle(1), T, 1)).toBe(false);

    const first = pressResign(resignIdle(1), T, 1);
    expect(first.resign).toBe(false);
    expect(isConfirming(first.next, T, 1)).toBe(true);
    expect(isConfirming(first.next, T + 2999, 1)).toBe(true);
    expect(confirmEndsIn(first.next, T + 1000, 1)).toBe(2000);

    const second = pressResign(first.next, T + 2999, 1);
    expect(second.resign).toBe(true);
    expect(isConfirming(second.next, T + 2999, 1)).toBe(false);
    expect(confirmEndsIn(second.next, T + 2999, 1)).toBeNull();
  });

  it("after 3 s it turns back", () => {
    const first = pressResign(resignIdle(1), T, 1).next;
    expect(isConfirming(first, T + 3000, 1)).toBe(false);
    expect(confirmEndsIn(first, T + 3000, 1)).toBeNull();

    // A press at 3000 ms is a first press again: it confirms, it doesn't resign.
    const late = pressResign(first, T + 3000, 1);
    expect(late.resign).toBe(false);
    expect(isConfirming(late.next, T + 3000, 1)).toBe(true);
    // And the new confirm runs its own 3 s from that press.
    expect(isConfirming(late.next, T + 5999, 1)).toBe(true);
    expect(pressResign(late.next, T + 5999, 1).resign).toBe(true);
  });

  it("a new game resets the confirm", () => {
    const confirming = pressResign(resignIdle(1), T, 1).next;
    expect(isConfirming(confirming, T + 10, 2)).toBe(false);
    expect(confirmEndsIn(confirming, T + 10, 2)).toBeNull();

    // A press in the new game is a first press.
    const press = pressResign(confirming, T + 10, 2);
    expect(press.resign).toBe(false);
    expect(isConfirming(press.next, T + 10, 2)).toBe(true);
  });

  it("repeats resign once", () => {
    expect(pressAt([T, T + 50, T + 100]).resigns).toBe(1);
    expect(pressAt([T, T + 1, T + 2, T + 3, T + 4000, T + 4001]).resigns).toBe(1);

    // After the resign in game 1, the next game can resign again.
    const { state } = pressAt([T, T + 50]);
    expect(pressAt([T + 100, T + 150], 2, state).resigns).toBe(1);
  });

  it("a clock that goes back never resigns", () => {
    const first = pressResign(resignIdle(1), T, 1).next;
    expect(isConfirming(first, T - 1, 1)).toBe(false);
    expect(pressResign(first, T - 1, 1).resign).toBe(false);
  });
});
