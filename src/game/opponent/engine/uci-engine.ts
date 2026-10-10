import type { MoveEngine } from "./move-engine";

export interface UciTransport {
  send(line: string): void;
  onLine(cb: (line: string) => void): void;
  onError(cb: (err: unknown) => void): void;
  terminate(): void;
}

export function createUciEngine(
  _transport: UciTransport,
  _timers: { setTimeout?: typeof setTimeout; clearTimeout?: typeof clearTimeout } = {},
): MoveEngine {
  return {
    bestMove: async () => {
      throw new Error("not implemented");
    },
    newGame: () => {},
    dispose: () => {},
  };
}
