import type { Book, BookName } from "../../src/game/opponent/types";
import type { ImportedGame } from "./games";

export const MAX_BOOK_BYTES = 0;

export interface BuildOptions {
  player: string;
  book: BookName;
  minGames?: number;
  maxBytes?: number;
}

export function buildBook(_games: ImportedGame[], opts: BuildOptions): Book {
  return {
    format: 1,
    player: opts.player,
    book: opts.book,
    minGames: 0,
    games: 0,
    gamesBySource: { otb: 0, lichess: 0, chesscom: 0 },
    positions: {},
  };
}

export function buildBooks(
  games: ImportedGame[],
  opts: Omit<BuildOptions, "book">
): Record<BookName, Book> {
  return {
    slow: buildBook(games, { ...opts, book: "slow" }),
    online: buildBook(games, { ...opts, book: "slow" }),
  };
}

export function serializeBook(book: Book): string {
  return JSON.stringify(book);
}
