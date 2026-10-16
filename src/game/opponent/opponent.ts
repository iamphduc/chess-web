// Relative imports only: the Node import script (run with tsx) may load this file.
import type { Move } from "../engine/engine";
import type { GameState } from "../engine/game-state";
import { hasAnyLegalMove } from "../engine/game-status";
import { lookupBook, pickBookMove, type GameClock } from "./book";
import type { EngineLine, SearchLimits } from "./engine/lines";
import { EngineError, type Analysis, type MoveEngine } from "./engine/move-engine";
import { chooseHumanMove } from "./human-move";
import { moveToUci, toFen, uciToMove } from "./position";
import type { StepProfile } from "./step-profiles";
import type { Book, BookName } from "./types";

export interface OpponentSettings {
  /** How hard the engine searches and how he picks among its lines. */
  profile: StepProfile;
  clock: GameClock | null;
  /** Returns a number in [0, 1) for the book pick and the line pick. Default `Math.random`. */
  random?: () => number;
}

export interface MoveChoice {
  move: Move;
  uci: string;
  source: "book" | "engine";
  /** The book lookup at the position, kept even when the engine moved. */
  lookup: ReturnType<typeof lookupBook>;
  /** The analysis behind an engine move; absent for a book move. */
  lines?: readonly EngineLine[];
}

export interface Opponent {
  chooseMove(state: GameState, settings: OpponentSettings): Promise<MoveChoice>;
  /**
   * A review search on his engine: `fen` searched with `limits`, the analysis
   * as the engine gives it. It runs beside his moves (`chooseMove` doesn't
   * abort it); `signal`, `newGame` and `dispose` do.
   */
  analyse(fen: string, limits: SearchLimits, signal?: AbortSignal): Promise<Analysis>;
  /** Starts a new game: the move and review searches in flight reject `superseded`, and the engine resets. */
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

/** A review search's error: as for his moves, except an aborted search reads `superseded`. */
function fromReviewError(error: unknown): OpponentError {
  if (error instanceof EngineError && error.code === "aborted") {
    return new OpponentError("superseded", { cause: error });
  }
  return fromEngineError(error);
}

/**
 * The opponent: his book move when the position is in book, else a move a
 * human of the step's strength would pick from the engine's top lines (the
 * engine's own best move when none of them is legal). Every move it returns is
 * one of `legalMoves`.
 */
export function createOpponent(deps: {
  books: Record<BookName, Book>;
  engine: MoveEngine;
}): Opponent {
  const { books, engine } = deps;
  let current: AbortController | null = null;
  /** The review searches in flight, each with its own abort. */
  const reviews = new Set<AbortController>();
  let disposed = false;

  function abortReviews(): void {
    reviews.forEach((review) => review.abort());
    reviews.clear();
  }

  async function review(fen: string, limits: SearchLimits, signal?: AbortSignal): Promise<Analysis> {
    if (disposed) throw new OpponentError("disposed");
    if (signal?.aborted) throw new OpponentError("superseded");
    const own = new AbortController();
    const onAbort = () => own.abort();
    signal?.addEventListener("abort", onAbort);
    reviews.add(own);
    /** Disposed or aborted wins over whatever the engine said, as for his moves. */
    const ensureLive = () => {
      if (disposed) throw new OpponentError("disposed");
      if (own.signal.aborted) throw new OpponentError("superseded");
    };
    try {
      let analysis: Analysis;
      try {
        analysis = await engine.analyse(fen, limits, own.signal);
      } catch (error) {
        ensureLive();
        throw fromReviewError(error);
      }
      ensureLive();
      return analysis;
    } finally {
      reviews.delete(own);
      signal?.removeEventListener("abort", onAbort);
    }
  }

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
    const { profile, random = Math.random } = settings;

    const lookup = lookupBook(books, state, settings.clock);
    if (lookup !== null) {
      const legal = lookup.moves.filter((m) => uciToMove(state, m[0]) !== null);
      const pick = pickBookMove(legal, random);
      const move = pick === null ? null : uciToMove(state, pick[0]);
      if (move !== null) return { move, uci: moveToUci(move), source: "book", lookup };
    }

    const fen = toFen(state);
    for (let ask = 0; ask < ENGINE_ASKS; ask++) {
      let analysis: Analysis;
      try {
        analysis = await engine.analyse(fen, profile.search, turn.signal);
      } catch (error) {
        ensureCurrent(turn);
        throw fromEngineError(error);
      }
      ensureCurrent(turn);
      const pick = chooseHumanMove(analysis.lines, state, profile, random) ?? analysis.bestMove;
      const move = pick === null ? null : uciToMove(state, pick);
      if (move !== null) {
        return { move, uci: moveToUci(move), source: "engine", lookup, lines: analysis.lines };
      }
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

    analyse: review,

    newGame() {
      if (disposed) return;
      current?.abort();
      current = null;
      abortReviews();
      engine.newGame();
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      current?.abort();
      current = null;
      abortReviews();
      engine.dispose();
    },
  };
}
