// Relative imports only: the Node import script (run with tsx) may load this folder.
import { parseBook } from "../parse-book";
import type { Book, BookName, PlayerEntry } from "../types";

/** The part of `fetch` the loader uses. */
export type FetchBook = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** One book could not be loaded: an HTTP error, a network error, bad JSON or a bad book. */
export class BookLoadError extends Error {
  readonly book: BookName;
  constructor(book: BookName, reason: string, options?: { cause?: unknown }) {
    super(`the ${book} book did not load: ${reason}`, options);
    this.name = "BookLoadError";
    this.book = book;
  }
}

export interface BookLoader {
  /** Both of a player's books. A success is cached; after a failure the next call fetches again. */
  load(entry: PlayerEntry): Promise<Record<BookName, Book>>;
}

const reasonOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

type UrlOf = (entry: PlayerEntry, name: BookName) => string;

async function loadOne(fetch: FetchBook, urlOf: UrlOf, entry: PlayerEntry, name: BookName): Promise<Book> {
  let json: unknown;
  let url = "";
  try {
    url = urlOf(entry, name);
    const response = await fetch(url);
    if (!response.ok) throw new BookLoadError(name, `HTTP ${response.status} for ${url}`);
    json = await response.json();
  } catch (error) {
    if (error instanceof BookLoadError) throw error;
    throw new BookLoadError(name, reasonOf(error), { cause: error });
  }
  let book: Book;
  try {
    book = parseBook(json);
  } catch (error) {
    throw new BookLoadError(name, reasonOf(error), { cause: error });
  }
  if (book.book !== name) throw new BookLoadError(name, `the file holds the ${book.book} book`);
  if (book.player !== entry.id) throw new BookLoadError(name, `the file is ${book.player}'s book, not ${entry.id}'s`);
  return book;
}

export function createBookLoader(deps: {
  fetch: FetchBook;
  url: UrlOf;
}): BookLoader {
  // Per player id: the load in flight or done. A failed load is dropped.
  const loads = new Map<string, Promise<Record<BookName, Book>>>();

  return {
    load(entry) {
      const cached = loads.get(entry.id);
      if (cached) return cached;
      const loading = Promise.all([
        loadOne(deps.fetch, deps.url, entry, "slow"),
        loadOne(deps.fetch, deps.url, entry, "online"),
      ]).then(
        ([slow, online]) => ({ slow, online }),
        (error: unknown) => {
          if (loads.get(entry.id) === loading) loads.delete(entry.id);
          throw error;
        }
      );
      loads.set(entry.id, loading);
      return loading;
    },
  };
}
