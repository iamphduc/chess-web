// The one boundary between the opponent and whatever engine picks its moves.
// Swap the engine by giving createOpponent another MoveEngine.

export type EngineErrorCode = "aborted" | "timeout" | "failed" | "disposed";

export class EngineError extends Error {
  readonly code: EngineErrorCode;
  constructor(code: EngineErrorCode, message: string = `engine ${code}`) {
    super(message);
    this.name = "EngineError";
    this.code = code;
  }
}

export interface MoveEngine {
  /** The engine's move in UCI, or null for "bestmove (none)" (no legal move). */
  bestMove(fen: string, opts: { elo: number; movetimeMs?: number }, signal?: AbortSignal): Promise<string | null>;
  /** The next search starts a new game (clears the engine's hash). */
  newGame(): void;
  /** Stops the engine for good. */
  dispose(): void;
}
