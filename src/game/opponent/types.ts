// Relative imports only: the Node import script (run with tsx) loads this file.

/** Where a game came from. */
export type GameSource = "otb" | "lichess" | "chesscom";

/** The two books: slow (OTB and slow online) and online (fast online). */
export type BookName = "slow" | "online";

/**
 * One move he played at a position:
 * `[uci, win, draw, loss, otb, lichess, chesscom]`. Win, draw and loss are his
 * results. Invariant: `win + draw + loss === otb + lichess + chesscom`.
 */
export type BookMove = readonly [
  string,
  number,
  number,
  number,
  number,
  number,
  number
];

/** A player's opening book, as committed JSON. */
export interface Book {
  format: 1;
  player: string;
  book: BookName;
  /** Fewest of his games that must reach a position for it to be stored. */
  minGames: number;
  /** Games counted into this book. */
  games: number;
  gamesBySource: Record<GameSource, number>;
  /** `positionKey` -> his moves there, by games descending then UCI ascending. */
  positions: Record<string, BookMove[]>;
}

/** A player's entry, `players/<id>/player.json`. */
export interface PlayerEntry {
  id: string;
  name: string;
  title: string;
  federation: string;
  fideId: number;
  rating: number;
  avatar: string;
  aliases: string[];
  sources: {
    lichessFideUrl: string;
    lichessUser: string | null;
    chesscomUser: string;
  };
  books: Record<BookName, string>;
}

/** Games behind one book move: the sum of its per-source counts. */
export function moveGames(move: BookMove): number {
  return move[4] + move[5] + move[6];
}

/** Games that reached a position: the sum over its moves. */
export function positionGames(moves: readonly BookMove[]): number {
  return moves.reduce((sum, move) => sum + moveGames(move), 0);
}
