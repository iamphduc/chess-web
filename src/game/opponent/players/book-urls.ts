// Vite only: `import.meta.glob` is a Vite feature, so `tsx` (the Node import
// script under scripts/) can't load this file. Keep it out of anything the
// script imports.
//
// `?url` makes each book a separate file in the build, fetched on demand, so
// no book JSON is in the entry bundle.
import type { BookName, PlayerEntry } from "../types";

const URLS = import.meta.glob<string>("./*/book-*.json", {
  query: "?url",
  import: "default",
  eager: true,
});

/** The URL of a player's committed book file, named in their `player.json`. */
export function bookUrl(entry: PlayerEntry, name: BookName): string {
  const path = `./${entry.id}/${entry.books[name]}`;
  const url = URLS[path];
  if (url === undefined) throw new Error(`no committed book file ${path} for ${entry.id}`);
  return url;
}
