/**
 * Resign takes two presses: the first turns the button into Confirm for 3 s, and a
 * second press inside that time resigns. Pure: the caller passes the time and the game.
 */

/** How long Confirm waits for the second press, in ms. */
export const CONFIRM_MS = 3000;

export interface ResignConfirm {
  /** The game this state belongs to; a new game starts over. */
  gameId: number;
  /** When the first press came, or `null` when not confirming. */
  since: number | null;
  /** This game was resigned from here, so more presses do nothing. */
  done: boolean;
}

/** Not confirming, in `gameId`. */
export const resignIdle = (gameId: number): ResignConfirm => ({ gameId, since: null, done: false });

/** The state for `gameId`: a state from another game reads as idle. */
const inGame = (state: ResignConfirm, gameId: number) =>
  state.gameId === gameId ? state : resignIdle(gameId);

/** The button reads Confirm. A clock that went back (`now < since`) counts as not confirming. */
export function isConfirming(state: ResignConfirm, now: number, gameId: number): boolean {
  const s = inGame(state, gameId);
  if (s.done || s.since === null) return false;
  const elapsed = now - s.since;
  return elapsed >= 0 && elapsed < CONFIRM_MS;
}

/** The ms left until Confirm turns back to Resign, or `null` when not confirming. */
export function confirmEndsIn(state: ResignConfirm, now: number, gameId: number): number | null {
  if (!isConfirming(state, now, gameId)) return null;
  return state.since! + CONFIRM_MS - now;
}

/** A press at `now`: a first press confirms, a second one within 3 s resigns (once a game). */
export function pressResign(
  state: ResignConfirm,
  now: number,
  gameId: number
): { next: ResignConfirm; resign: boolean } {
  const s = inGame(state, gameId);
  if (s.done) return { next: s, resign: false };
  if (isConfirming(s, now, gameId)) return { next: { gameId, since: null, done: true }, resign: true };
  return { next: { gameId, since: now, done: false }, resign: false };
}
