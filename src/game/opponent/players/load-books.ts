import type { Book, BookName, PlayerEntry } from "../types";
export type FetchBook = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
export class BookLoadError extends Error {
  book: BookName = "slow";
}
export function createBookLoader(_deps: { fetch: FetchBook; url: (entry: PlayerEntry, name: BookName) => string }) {
  return { load: (_entry: PlayerEntry): Promise<Record<BookName, Book>> => Promise.reject(new Error("todo")) };
}
