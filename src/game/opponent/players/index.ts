// Relative imports only: the Node import script (run with tsx) loads this folder.
import type { Book, BookName, PlayerEntry } from "../types";
import liemEntry from "./le-quang-liem/player.json";
import liemOnline from "./le-quang-liem/book-online.json";
import liemSlow from "./le-quang-liem/book-slow.json";

/** A player the app can play against: the entry and both books. */
export interface Player {
  entry: PlayerEntry;
  books: Record<BookName, Book>;
}

// JSON imports infer `(string | number)[][]` for the move tuples and `number` for `format`, so they are cast; tests/book-data.test.ts checks the files.
export const LIEM: Player = {
  entry: liemEntry as PlayerEntry,
  books: { slow: liemSlow as unknown as Book, online: liemOnline as unknown as Book },
};

export const PLAYERS: readonly Player[] = [LIEM];
