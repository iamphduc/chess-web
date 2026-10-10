// Relative imports only: the Node import script (run with tsx) may load this file.
import type { GameState } from "../engine/game-state";
import { positionKey } from "./position";
import { moveGames, positionGames, type Book, type BookMove, type BookName } from "./types";

/** A game clock: base time and increment per move, in milliseconds. */
export interface GameClock {
  baseMs: number;
  incrementMs: number;
}

/** What a book has at one position. */
export interface BookLookup {
  book: BookName;
  moves: BookMove[];
  games: number;
}

/** Fewer games than this at a position counts as a thin line. */
export const THIN = 3;

/** Estimated game length (base + 40 x increment) where the slow book starts. */
const SLOW_FROM_MS = 900_000;

/**
 * The book for a game clock, using the import's estimate: base + 40 x
 * increment of 900 000 ms or more is slow, else online. Untimed is slow.
 */
export function bookForClock(clock: GameClock | null): BookName {
  if (clock === null) return "slow";
  return clock.baseMs + 40 * clock.incrementMs >= SLOW_FROM_MS ? "slow" : "online";
}

function movesAt(book: Book, key: string): BookMove[] {
  return Object.hasOwn(book.positions, key) ? book.positions[key] : [];
}

/**
 * His moves at `state`. The clock's book wins once it has `THIN` games there;
 * else the other book if it has `THIN`; else whichever has more (ties go to
 * the clock's book), as long as it has at least one. `null` is out of book.
 */
export function lookupBook(
  books: Record<BookName, Book>,
  state: GameState,
  clock: GameClock | null
): BookLookup | null {
  const key = positionKey(state);
  const first = bookForClock(clock);
  const second: BookName = first === "slow" ? "online" : "slow";
  const [a, b] = [first, second].map((name): BookLookup => {
    const moves = movesAt(books[name], key);
    return { book: name, moves, games: positionGames(moves) };
  });

  if (a.games >= THIN) return a;
  if (b.games >= THIN) return b;
  const larger = b.games > a.games ? b : a;
  return larger.games >= 1 ? larger : null;
}

/**
 * A move weighted by games: with `r = random()`, in the stored order, the first
 * move whose running share of the games passes `r`. A `random` outside [0, 1)
 * falls to the last move with games. `null` when no move has games.
 */
export function pickBookMove(
  moves: readonly BookMove[],
  random: () => number = Math.random
): BookMove | null {
  const weighted = moves.filter((m) => moveGames(m) > 0);
  if (weighted.length === 0) return null;
  const total = positionGames(weighted);
  const r = random();
  let running = 0;
  for (const move of weighted) {
    running += moveGames(move);
    if (running / total > r) return move;
  }
  return weighted[weighted.length - 1];
}
