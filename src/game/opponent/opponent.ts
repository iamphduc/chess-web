// Stub: filled in by the feat commit.
import type { Move } from "../engine/engine";
import type { GameState } from "../engine/game-state";
import { lookupBook } from "./book";
import type { MoveEngine } from "./engine/move-engine";
import type { Book, BookName } from "./types";

export interface OpponentSettings { elo: number; clock: { baseMs: number; incrementMs: number } | null; random?: () => number }
export interface MoveChoice { move: Move; uci: string; source: "book" | "engine"; lookup: ReturnType<typeof lookupBook> }
export interface Opponent { chooseMove(state: GameState, settings: OpponentSettings): Promise<MoveChoice>; dispose(): void }
export type OpponentErrorCode = "no-legal-moves" | "illegal-engine-move" | "superseded" | "engine-failed" | "engine-timeout" | "disposed";
export class OpponentError extends Error {
  readonly code: OpponentErrorCode;
  constructor(code: OpponentErrorCode) { super(code); this.code = code; }
}
export function createOpponent(_deps: { books: Record<BookName, Book>; engine: MoveEngine }): Opponent {
  return {
    chooseMove: () => new Promise((r) => setTimeout(() => r({ move: { from: [0, 0], to: [0, 0] }, uci: "", source: "book", lookup: null }), 0)),
    dispose() {},
  };
}
