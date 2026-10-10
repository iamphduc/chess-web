export type EngineErrorCode = "aborted" | "timeout" | "failed" | "disposed";

export class EngineError extends Error {
  readonly code: EngineErrorCode;
  constructor(code: EngineErrorCode, message?: string) {
    super(message);
    this.code = code;
  }
}

export interface MoveEngine {
  bestMove(fen: string, opts: { elo: number; movetimeMs?: number }, signal?: AbortSignal): Promise<string | null>;
  newGame(): void;
  dispose(): void;
}
