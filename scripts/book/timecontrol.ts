// The PGN TimeControl tag: a clock estimate and which book it belongs to.

/** `slow` and `online` are book names; `unknown` and `daily` are decided by the game's source. */
export type ClockClass = "slow" | "online" | "unknown" | "daily";

/** An estimate of this many seconds or more is slow (15 minutes). */
export const SLOW_SECONDS = 900;

/** Moves the estimate counts the increment for: base + 40 x increment. */
const MOVES = 40;

const WHOLE = /^\d+$/;

/** One period: `B`, `B+I`, `M/B` or `M/B+I`, all whole seconds. */
function parsePeriod(text: string): { moves: number | null; base: number; inc: number } | null {
  const [left, ...rest] = text.split("/");
  if (rest.length > 1) return null;
  const movesText = rest.length === 1 ? left : null;
  const clock = rest.length === 1 ? rest[0] : left;
  const [baseText, incText, ...extra] = clock.split("+");
  if (extra.length > 0) return null;
  if (!WHOLE.test(baseText)) return null;
  if (incText !== undefined && !WHOLE.test(incText)) return null;
  if (movesText !== null && !WHOLE.test(movesText)) return null;
  return {
    moves: movesText === null ? null : Number(movesText),
    base: Number(baseText),
    inc: incText === undefined ? 0 : Number(incText),
  };
}

function firstPeriod(tc: string | undefined) {
  if (tc === undefined) return null;
  const periods = tc.trim().split(":");
  const parsed = periods.map(parsePeriod);
  if (parsed.some((p) => p === null)) return null;
  return { first: parsed[0]!, count: parsed.length };
}

function isDaily(p: NonNullable<ReturnType<typeof firstPeriod>>): boolean {
  // Chess.com daily and correspondence games: one move per period ("1/86400").
  return p.count === 1 && p.first.moves === 1;
}

/**
 * Seconds of base plus 40 increments, from the first period. `null` when the
 * tag is missing, `-`, `?`, unparsable, or a daily game.
 */
export function clockEstimate(tc: string | undefined): number | null {
  const p = firstPeriod(tc);
  if (p === null || isDaily(p)) return null;
  return p.first.base + MOVES * p.first.inc;
}

/** `slow` at 900 s or more, else `online`; `daily` for one-move periods, else `unknown`. */
export function clockClass(tc: string | undefined): ClockClass {
  const p = firstPeriod(tc);
  if (p !== null && isDaily(p)) return "daily";
  const estimate = clockEstimate(tc);
  if (estimate === null) return "unknown";
  return estimate >= SLOW_SECONDS ? "slow" : "online";
}
