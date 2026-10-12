// The one boundary between the opponent and whatever engine picks its moves.
// Swap the engine by giving createOpponent another MoveEngine.
import type { EngineLine, SearchLimits } from "./lines";

export type EngineErrorCode = "aborted" | "timeout" | "failed" | "disposed";

export class EngineError extends Error {
  readonly code: EngineErrorCode;
  constructor(code: EngineErrorCode, message: string = `engine ${code}`) {
    super(message);
    this.name = "EngineError";
    this.code = code;
  }
}

/** One search's result. */
export interface Analysis {
  /** The scored lines, in multipv order, each with a different first move. */
  lines: EngineLine[];
  /** The engine's move in UCI, or null for "bestmove (none)" (no legal move). */
  bestMove: string | null;
}

export interface MoveEngine {
  /**
   * Searches `fen` to `limits.depth`, or until `limits.movetimeMs` runs out,
   * keeping the top `limits.multiPv` lines. Bad limits reject with a RangeError.
   */
  analyse(fen: string, limits: SearchLimits, signal?: AbortSignal): Promise<Analysis>;
  /** The next search starts a new game (clears the engine's hash). */
  newGame(): void;
  /** Stops the engine for good. */
  dispose(): void;
}
