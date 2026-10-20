/**
 * How the game-over card comes in. After a short pause the scrim fades in and the
 * card fades in, rises and grows, all ease-out. It plays once per game end: a later
 * mount of the card for the same end (back from the review) shows it at once, as
 * does reduced motion. Pure apart from `firstShownAt`'s memory; the caller passes
 * the time.
 */

/** The entrance's values (plan ui-motion ## Look). `GameOver.css` uses the same numbers. */
export const ENTRANCE = {
  /** Before anything shows, so the last move is seen landing. */
  pauseMs: 300,
  /** The scrim's fade, after the pause. */
  scrimMs: 200,
  /** The card's fade, rise and scale, after the pause. */
  cardMs: 250,
  /** How far the card rises, in px. */
  risePx: 8,
  /** The card's scale at the start. */
  scaleFrom: 0.96,
  ease: "ease-out",
} as const;

/** When the card is fully shown, in ms from when it became due. */
export const ENTRANCE_TOTAL_MS = ENTRANCE.pauseMs + Math.max(ENTRANCE.scrimMs, ENTRANCE.cardMs);

/** `animate` plays the entrance; `instant` shows everything at once. */
export type Entrance = "animate" | "instant";

/**
 * The entrance for a card shown at `now`. `firstShown` is when this game end's card
 * was first shown, or `null` when it never was. A render within the entrance
 * (React StrictMode's second one) still animates; any later one, or a clock that
 * went back, shows it at once.
 */
export function gameOverEntrance(reducedMotion: boolean, firstShown: number | null, now: number): Entrance {
  if (reducedMotion) return "instant";
  if (firstShown === null) return "animate";
  const elapsed = now - firstShown;
  return elapsed >= 0 && elapsed < ENTRANCE_TOTAL_MS ? "animate" : "instant";
}

const shown = new WeakMap<object, number>();

/**
 * When the card for `end` (the game's `result` object, set once per game end) was
 * first shown, or `null` when this is the first time; then it records `now`.
 */
export function firstShownAt(end: object, now: number): number | null {
  const first = shown.get(end);
  if (first !== undefined) return first;
  shown.set(end, now);
  return null;
}

/** The system asks for reduced motion. False where there is no window (tests, SSR). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
