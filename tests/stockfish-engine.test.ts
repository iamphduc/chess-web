import { createRequire } from "node:module";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initialGameState } from "../src/game/engine/game-state";
import type { MoveEngine } from "../src/game/opponent/engine/move-engine";
import { createUciEngine, type UciTransport } from "../src/game/opponent/engine/uci-engine";
import { uciToMove } from "../src/game/opponent/position";

// The npm package's Node loader. initEngine("lite-single") loads the same
// lite single-thread WASM build that the browser worker uses.
type NodeEngine = { sendCommand(cmd: string): void; listener?: (line: string) => void; terminate?: () => void };
const initEngine = createRequire(import.meta.url)("stockfish") as (path: string) => Promise<NodeEngine>;

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
// 1.f3 e5 2.g4: Black mates with Qh4.
const MATE_IN_1 = "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2";
let engine: MoveEngine;
const sent: string[] = [];

beforeAll(async () => {
  const sf = await initEngine("lite-single");
  const transport: UciTransport = {
    send: (line) => {
      sent.push(line);
      sf.sendCommand(line);
    },
    onLine: (cb) => (sf.listener = cb),
    onError: () => {},
    terminate: () => sf.terminate?.(),
  };
  engine = createUciEngine(transport);
}, 15_000);

afterAll(() => engine?.dispose());

describe("real stockfish lite single-thread engine", () => {
  it("real engine returns 4 scored lines", async () => {
    const { lines, bestMove } = await engine.analyse(START, { depth: 8, multiPv: 4, movetimeMs: 5000 });
    expect(lines).toHaveLength(4);
    const start = initialGameState();
    for (const line of lines) {
      expect(uciToMove(start, line.move), line.move).not.toBeNull();
      expect(line.depth).toBe(8);
      expect("cp" in line.score).toBe(true);
      expect(Number.isFinite((line.score as { cp: number }).cp)).toBe(true);
    }
    expect(new Set(lines.map((l) => l.move)).size).toBe(4);
    expect(lines.map((l) => l.move)).toContain(bestMove);
    expect(sent.some((l) => /UCI_LimitStrength|UCI_Elo/.test(l))).toBe(false);
  }, 15_000);

  it("real engine reports mate in 1", async () => {
    const { lines, bestMove } = await engine.analyse(MATE_IN_1, { depth: 6, multiPv: 3, movetimeMs: 3000 });
    expect(bestMove).toBe("d8h4");
    expect(lines[0]).toMatchObject({ move: "d8h4", score: { mate: 1 } });
  }, 15_000);

  it("real engine stops at the movetime backstop", async () => {
    const t0 = performance.now();
    const { lines, bestMove } = await engine.analyse(START, { depth: 30, multiPv: 1, movetimeMs: 300 });
    expect(performance.now() - t0).toBeLessThan(3000);
    expect(bestMove).not.toBeNull();
    expect(lines).toHaveLength(1);
    expect(lines[0].depth).toBeLessThan(30);
  }, 15_000);
});
