// Relative imports only: the Node import script (run with tsx) may load this file.
import type { Book, BookName, GameSource } from "./types";

/** The JSON is not a format-1 book. The message says what is wrong. */
export class BookError extends Error {
  constructor(message: string) {
    super(`bad book: ${message}`);
    this.name = "BookError";
  }
}

const BOOK_NAMES: readonly BookName[] = ["slow", "online"];
const SOURCES: readonly GameSource[] = ["otb", "lichess", "chesscom"];

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

function check(ok: boolean, message: string): asserts ok {
  if (!ok) throw new BookError(message);
}

function checkMove(key: string, move: unknown): void {
  const where = `move at "${key}"`;
  check(Array.isArray(move), `${where} is not a list`);
  const [uci, ...counts] = move as unknown[];
  check(typeof uci === "string", `${where} has no UCI text`);
  const label = `move ${uci} at "${key}"`;
  check(move.length === 7, `${label} has length ${move.length}, not 7`);
  check(counts.every(isCount), `${label} has a count that is not a whole number 0 or more`);
  const [win, draw, loss, otb, lichess, chesscom] = counts as number[];
  check(win + draw + loss === otb + lichess + chesscom, `${label}: win + draw + loss is not its game count`);
}

/**
 * Checks that `json` is a format-1 book (the sprint-1 format in `types.ts`)
 * and returns it unchanged. Throws `BookError` naming the first problem.
 */
export function parseBook(json: unknown): Book {
  check(isObject(json), "not an object");
  check(json.format === 1, `format is ${JSON.stringify(json.format)}, not 1`);
  check(typeof json.player === "string", "player is not text");
  check(BOOK_NAMES.includes(json.book as BookName), `unknown book name ${JSON.stringify(json.book)}`);
  check(Number.isInteger(json.minGames) && (json.minGames as number) >= 1, "minGames is not a whole number 1 or more");
  check(isCount(json.games), "games is not a whole number 0 or more");

  const bySource = json.gamesBySource;
  check(isObject(bySource), "gamesBySource is not an object");
  for (const source of SOURCES) check(isCount(bySource[source]), `gamesBySource.${source} is not a whole number 0 or more`);
  const sourceGames = SOURCES.reduce((sum, s) => sum + (bySource[s] as number), 0);
  check(json.games === sourceGames, `games is ${json.games}, but gamesBySource adds up to ${sourceGames}`);

  check(isObject(json.positions), "positions is not an object");
  for (const [key, moves] of Object.entries(json.positions)) {
    check(Array.isArray(moves) && moves.length > 0, `position "${key}" has no list of moves`);
    for (const move of moves) checkMove(key, move);
  }
  // Every field Book declares was checked above.
  return json as unknown as Book;
}
