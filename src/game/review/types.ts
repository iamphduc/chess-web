// Relative imports only, no React: the review model is pure TypeScript.
import type { GameState, PieceColor } from "../engine/game-state";
import type { GameClock } from "../opponent/book";
import type { Score } from "../opponent/engine/lines";
import type { Book, BookName } from "../opponent/types";

/**
 * One position's engine verdict, from the side to move's view. `best` is UCI.
 * A terminal position is never searched: checkmated is `{ mate: 0 }`,
 * stalemate is `{ cp: 0 }`, both with `best: null`.
 */
export interface PositionEval {
  score: Score;
  best: string | null;
}

export type Grade = "inaccuracy" | "mistake" | "blunder";

/** One ply of the game, as the review shows it. */
export interface ReviewMove {
  ply: number;
  /** `"13.Nd5"` for White, `"13...Nc6"` for Black. */
  label: string;
  uci: string;
  byHuman: boolean;
  /** Games behind the resulting position when it's a human move into his book. */
  bookGames: number | null;
  /** Human plies only, once both evals are in. */
  drop: number | null;
  accuracy: number | null;
  grade: Grade | null;
}

export interface MoveRef {
  uci: string;
  label: string;
  games?: number;
}

export interface KeyMoment {
  ply: number;
  grade: Grade;
  drop: number;
  played: MoveRef;
  best: MoveRef | null;
  /** His most-played move at the position before the ply, when it's in his book. */
  liem: MoveRef | null;
}

export interface ReviewModel {
  /** One per ply. */
  moves: ReviewMove[];
  /** White's win % per position, `null` until analysed. */
  whiteWin: (number | null)[];
  /** Positions with an eval. */
  analysed: number;
  /** Positions in the game: plies + 1. */
  total: number;
  accuracy: number | null;
  counts: Record<Grade, number>;
  /** In game order. */
  keyMoments: KeyMoment[];
  /** Leading plies before he left his book (0 without books). */
  bookPlies: number;
  leftBook: { ply: number; played: MoveRef; his: MoveRef[] } | null;
}

export interface BuildReviewInput {
  positions: readonly GameState[];
  humanColor: PieceColor;
  clock: GameClock;
  evals: readonly (PositionEval | null)[];
  books: Record<BookName, Book> | null;
  /** Plies of moments already opened; they always stay key moments. */
  locked: readonly number[];
}
