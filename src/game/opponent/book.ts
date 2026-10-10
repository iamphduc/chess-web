// Stub: filled in by the feat commit.
import type { GameState } from "../engine/game-state";
import type { Book, BookMove, BookName } from "./types";

export const THIN = 0;

export function bookForClock(_clock: { baseMs: number; incrementMs: number } | null): BookName {
  return "online";
}

export function lookupBook(
  _books: Record<BookName, Book>,
  _state: GameState,
  _clock: { baseMs: number; incrementMs: number } | null
): { book: BookName; moves: BookMove[]; games: number } | null {
  return null;
}

export function pickBookMove(_moves: readonly BookMove[], _random: () => number = Math.random): BookMove | null {
  return null;
}
