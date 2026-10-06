// Pure clock math for the player clocks. All values are whole milliseconds.
// Nothing here reads the time itself: callers pass `now` (Date.now()).
import { DEFAULT_TIME } from "../../constants";

export const TOTAL_MS: number = DEFAULT_TIME * 1000;
export const LOW_TIME_MS = 20_000;
export const TENTHS_MS = 10_000;

/** `startedAt: null` means the clock is not running. */
export interface ClockState {
  remainingMs: number;
  startedAt: number | null;
}

export type ClockPhase = "reset" | "running" | "paused";

export function initialClock(): ClockState {
  return { remainingMs: TOTAL_MS, startedAt: null };
}

/** Time left at `now`. Depends only on `now`, so late ticks never drift. */
export function remainingMs(clock: ClockState, now: number): number {
  if (clock.startedAt === null) return clock.remainingMs;
  const elapsed = Math.max(0, now - clock.startedAt); // clock moved back → 0
  return Math.max(0, clock.remainingMs - elapsed);
}

/** Starting a running clock leaves it as is (the turn is not restarted). */
export function startClock(clock: ClockState, now: number): ClockState {
  if (clock.startedAt !== null) return clock;
  return { remainingMs: clock.remainingMs, startedAt: now };
}

/** Stores the time left at `now`. Pausing a paused clock leaves it as is. */
export function pauseClock(clock: ClockState, now: number): ClockState {
  if (clock.startedAt === null) return clock;
  return { remainingMs: remainingMs(clock, now), startedAt: null };
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** `MM:SS` from 10 s up, `S.t` below; always floored. */
export function formatClock(ms: number): string {
  const safe = Math.max(0, ms);
  if (safe >= TENTHS_MS) {
    const seconds = Math.floor(safe / 1000);
    return `${pad2(Math.floor(seconds / 60))}:${pad2(seconds % 60)}`;
  }
  const tenths = Math.floor(safe / 100);
  return `${Math.floor(tenths / 10)}.${tenths % 10}`;
}

export function clockStage(ms: number): "normal" | "low" | "critical" {
  if (ms >= LOW_TIME_MS) return "normal";
  if (ms >= TENTHS_MS) return "low";
  return "critical";
}

/** Quarter turn per whole second, on the same floored seconds as the digits. */
export function handAngle(ms: number): 0 | 90 | 180 | 270 {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  const step = (((600 - seconds) % 4) + 4) % 4;
  return (step * 90) as 0 | 90 | 180 | 270;
}

export function clockPhase(
  isPlaying: boolean,
  isActive: boolean,
  gameContinues: boolean
): ClockPhase {
  if (!gameContinues) return "paused"; // keep the final time on screen
  if (!isPlaying) return "reset";
  return isActive ? "running" : "paused";
}

export function tickInterval(phase: ClockPhase, ms: number): 1000 | 100 | null {
  if (phase !== "running") return null;
  return ms >= TENTHS_MS ? 1000 : 100;
}

export function lowTimeAlert(ms: number): string {
  return ms < TENTHS_MS ? "10 seconds left" : "";
}

/**
 * Whether White's clock is the one that runs. `historyLength` counts the start
 * position plus one entry per ply. While the promotion picker is open the pawn
 * move is already in history, but the mover is still choosing a piece, so the
 * mover's clock keeps running until the piece is picked.
 */
export function isWhiteClockTurn(historyLength: number, promotionPending: boolean): boolean {
  const whiteToMove = historyLength % 2 === 1;
  return promotionPending ? !whiteToMove : whiteToMove;
}
