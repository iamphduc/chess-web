// His games -> the two committed books (counts per position, nothing else).
import { applyMove } from "../../src/game/engine/engine";
import { initialGameState } from "../../src/game/engine/game-state";
import { positionKey, uciToMove } from "../../src/game/opponent/position";
import type { Book, BookMove, BookName, GameSource } from "../../src/game/opponent/types";
import type { ImportedGame } from "./games";

/** Each committed book is at most 3 MB. */
export const MAX_BOOK_BYTES = 3 * 1024 * 1024;
/** Fewest of his games that must reach a position for it to be stored. */
export const DEFAULT_MIN_GAMES = 2;

export interface BuildOptions {
  player: string;
  book: BookName;
  minGames?: number;
  maxBytes?: number;
}

const SOURCE_COLUMN: Record<GameSource, 4 | 5 | 6> = { otb: 4, lichess: 5, chesscom: 6 };
const RESULT_COLUMN = { win: 1, draw: 2, loss: 3 } as const;

type Counts = [number, number, number, number, number, number];

/** positionKey -> uci -> [win, draw, loss, otb, lichess, chesscom] */
function countPositions(games: ImportedGame[]): Map<string, Map<string, Counts>> {
  const positions = new Map<string, Map<string, Counts>>();
  for (const game of games) {
    let state = initialGameState();
    const seen = new Set<string>();
    for (const uci of game.moves) {
      const move = uciToMove(state, uci);
      if (move === null) break; // games.ts already cut the game here
      if (state.turn === game.color) {
        const key = positionKey(state);
        // A position that repeats in one game counts once, with his first move there.
        if (!seen.has(key)) {
          seen.add(key);
          const moves = positions.get(key) ?? new Map<string, Counts>();
          positions.set(key, moves);
          const counts = moves.get(uci) ?? [0, 0, 0, 0, 0, 0];
          moves.set(uci, counts);
          counts[RESULT_COLUMN[game.result] - 1]++;
          counts[SOURCE_COLUMN[game.source] - 1]++;
        }
      }
      state = applyMove(state, move);
    }
  }
  return positions;
}

function sortMoves(moves: BookMove[]): BookMove[] {
  const games = (m: BookMove) => m[4] + m[5] + m[6];
  return moves.sort((a, b) => games(b) - games(a) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

function bookAt(
  counted: Map<string, Map<string, Counts>>,
  base: Omit<Book, "positions" | "minGames">,
  minGames: number
): Book {
  const positions: Record<string, BookMove[]> = {};
  for (const key of [...counted.keys()].sort()) {
    const moves = [...counted.get(key)!].map(([uci, c]): BookMove => [uci, ...c]);
    const total = moves.reduce((sum, m) => sum + m[4] + m[5] + m[6], 0);
    if (total >= minGames) positions[key] = sortMoves(moves);
  }
  return { ...base, minGames, positions };
}

/**
 * The book for `opts.book` from the games in it. Stores only positions where
 * he is to move and at least `minGames` of his games played a move. Over
 * `maxBytes`, `minGames` rises by 1 until the book fits.
 */
export function buildBook(games: ImportedGame[], opts: BuildOptions): Book {
  const mine = games.filter((g) => g.book === opts.book);
  const gamesBySource: Record<GameSource, number> = { otb: 0, lichess: 0, chesscom: 0 };
  for (const g of mine) gamesBySource[g.source]++;
  const base = {
    format: 1 as const,
    player: opts.player,
    book: opts.book,
    games: mine.length,
    gamesBySource,
  };
  const counted = countPositions(mine);
  const maxBytes = opts.maxBytes ?? MAX_BOOK_BYTES;
  let minGames = opts.minGames ?? DEFAULT_MIN_GAMES;
  for (;;) {
    const book = bookAt(counted, base, minGames);
    if (Buffer.byteLength(serializeBook(book)) <= maxBytes) return book;
    if (Object.keys(book.positions).length === 0) {
      throw new Error(`An empty ${opts.book} book is over the ${maxBytes}-byte budget`);
    }
    minGames++;
  }
}

/** Both books from one list of games. */
export function buildBooks(
  games: ImportedGame[],
  opts: Omit<BuildOptions, "book">
): Record<BookName, Book> {
  return {
    slow: buildBook(games, { ...opts, book: "slow" }),
    online: buildBook(games, { ...opts, book: "online" }),
  };
}

/**
 * Byte-stable JSON: keys sorted, one position per line so diffs stay readable,
 * and a final newline.
 */
export function serializeBook(book: Book): string {
  const head = {
    book: book.book,
    format: book.format,
    games: book.games,
    gamesBySource: {
      chesscom: book.gamesBySource.chesscom,
      lichess: book.gamesBySource.lichess,
      otb: book.gamesBySource.otb,
    },
    minGames: book.minGames,
    player: book.player,
  };
  const keys = Object.keys(book.positions).sort();
  const lines = keys.map((k) => `${JSON.stringify(k)}:${JSON.stringify(book.positions[k])}`);
  const headText = JSON.stringify(head).slice(0, -1);
  const body = lines.length === 0 ? "{}" : `{\n${lines.join(",\n")}\n}`;
  return `${headText},"positions":${body}}\n`;
}
