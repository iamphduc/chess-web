import type { Book } from "./types";
export class BookError extends Error {}
export function parseBook(json: unknown): Book {
  return json as Book;
}
