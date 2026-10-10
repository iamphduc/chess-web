import { createRequire } from "node:module";
import { afterAll, describe, expect, it } from "vitest";
import type { MoveEngine } from "../src/game/opponent/engine/move-engine";
import { createUciEngine, type UciTransport } from "../src/game/opponent/engine/uci-engine";

// The npm package's Node loader. initEngine("lite-single") loads the same
// lite single-thread WASM build that the browser worker uses.
type NodeEngine = { sendCommand(cmd: string): void; listener?: (line: string) => void; terminate?: () => void };
const initEngine = createRequire(import.meta.url)("stockfish") as (path: string) => Promise<NodeEngine>;

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
let engine: MoveEngine | undefined;

afterAll(() => engine?.dispose());

describe("real stockfish lite single-thread engine", () => {
  it("real engine answers the start position", async () => {
    const sf = await initEngine("lite-single");
    const transport: UciTransport = {
      send: (line) => sf.sendCommand(line),
      onLine: (cb) => (sf.listener = cb),
      onError: () => {},
      terminate: () => sf.terminate?.(),
    };
    engine = createUciEngine(transport);
    const move = await engine.bestMove(START, { elo: 1500, movetimeMs: 300 });
    // a legal first move for White: a pawn one or two squares, or a knight
    expect(move).toMatch(/^([a-h]2[a-h][34]|[bg]1[a-h]3)$/);
  }, 15_000);
});
