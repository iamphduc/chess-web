// Relative imports only: the Node import script (run with tsx) may load this file.
import type { Move } from "../engine/engine";
import type { GameState } from "../engine/game-state";
import { hasAnyLegalMove } from "../engine/game-status";
import { lookupBook, pickBookMove, type GameClock } from "./book";
import { EngineError, type MoveEngine } from "./engine/move-engine";
import { moveToUci, toFen, uciToMove } from "./position";
import type { Book, BookName } from "./types";

export interface OpponentSettings {
  elo: number;
  clock: GameClock | null;
  /** Returns a number in [0, 1) for the weighted book pick. Default `Math.random`. */
  random?: () => number;
}

export interface MoveChoice {
  move: Move;
  uci: string;
  source: "book" | "engine";
  /** The book lookup at the position, kept even when the engine moved. */
  lookup: ReturnType<typeof lookupBook>;
}

export interface Opponent {
  chooseMove(state: GameState, settings: OpponentSettings): Promise<MoveChoice>;
  /** Starts a new game: the move in flight rejects `superseded`, and the engine resets. */
  newGame(): void;
  /** Stops the opponent and its engine for good. */
  dispose(): void;
}

export type OpponentErrorCode =
  | "no-legal-moves"
  | "illegal-engine-move"
  | "superseded"
  | "engine-failed"
  | "engine-timeout"
  | "disposed";

export class OpponentError extends Error {
  readonly code: OpponentErrorCode;
  constructor(code: OpponentErrorCode, options?: { cause?: unknown }) {
    super(`opponent ${code}`, options);
    this.name = "OpponentError";
    this.code = code;
  }
}

/** How many times the engine is asked before giving up on an illegal answer. */
const ENGINE_ASKS = 2;

function fromEngineError(error: unknown): OpponentError {
  const code = error instanceof EngineError ? error.code : null;
  const mapped: OpponentErrorCode =
    code === "timeout" ? "engine-timeout" : code === "disposed" ? "disposed" : "engine-failed";
  return new OpponentError(mapped, { cause: error });
}

/**
 * The opponent: his book move when the position is in book, else the engine's
 * move. Every move it returns is one of `legalMoves`.
 */
export function createOpponent(deps: {
  books: Record<BookName, Book>;
  engine: MoveEngine;
}): Opponent {
  const { books, engine } = deps;
  let current: AbortController | null = null;
  let disposed = false;

  /** Throws when this call has been replaced by a newer one or disposed. */
  function ensureCurrent(turn: AbortController): void {
    if (disposed) throw new OpponentError("disposed");
    if (current !== turn) throw new OpponentError("superseded");
  }

  async function choose(
    state: GameState,
    settings: OpponentSettings,
    turn: AbortController
  ): Promise<MoveChoice> {
    if (!hasAnyLegalMove(state)) throw new OpponentError("no-legal-moves");

    const lookup = lookupBook(books, state, settings.clock);
    if (lookup !== null) {
      const legal = lookup.moves.filter((m) => uciToMove(state, m[0]) !== null);
      const pick = pickBookMove(legal, settings.random);
      const move = pick === null ? null : uciToMove(state, pick[0]);
      if (move !== null) return { move, uci: moveToUci(move), source: "book", lookup };
    }

    const fen = toFen(state);
    for (let ask = 0; ask < ENGINE_ASKS; ask++) {
      let answer: string | null;
      try {
        answer = await engine.bestMove(fen, { elo: settings.elo }, turn.signal);
      } catch (error) {
        ensureCurrent(turn);
        throw fromEngineError(error);
      }
      ensureCurrent(turn);
      const move = answer === null ? null : uciToMove(state, answer);
      if (move !== null) return { move, uci: moveToUci(move), source: "engine", lookup };
    }
    throw new OpponentError("illegal-engine-move");
  }

  return {
    async chooseMove(state, settings) {
      if (disposed) throw new OpponentError("disposed");
      current?.abort();
      const turn = new AbortController();
      current = turn;
      try {
        return await choose(state, settings, turn);
      } finally {
        if (current === turn) current = null;
      }
    },

    newGame() {
      if (disposed) return;
      current?.abort();
      current = null;
      engine.newGame();
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      current?.abort();
      current = null;
      engine.dispose();
    },
  };
}
