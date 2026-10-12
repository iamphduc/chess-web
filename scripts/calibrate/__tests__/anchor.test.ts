import { describe, expect, it } from "vitest";
import type { UciTransport } from "../../../src/game/opponent/engine/uci-engine";
import { initialGameState } from "../../../src/game/engine/game-state";
import { clampAnchorElo, createAnchor, defaultAnchors } from "../anchor";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function fakeTransport() {
  const sent: string[] = [];
  let listener: (line: string) => void = () => {};
  let errorCb: (err: unknown) => void = () => {};
  let terminated = false;
  const transport: UciTransport = {
    send: (line) => sent.push(line),
    onLine: (cb) => (listener = cb),
    onError: (cb) => (errorCb = cb),
    terminate: () => (terminated = true),
  };
  return {
    transport,
    sent,
    reply: (line: string) => listener(line),
    fail: (err: unknown) => errorCb(err),
    terminated: () => terminated,
  };
}

/** Lets queued promise callbacks run. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("anchor", () => {
  it("anchor sends the strength options and go movetime", async () => {
    const t = fakeTransport();
    const anchor = createAnchor(t.transport, { elo: 1600, movetimeMs: 250 });
    expect(anchor.name).toBe("SF 1600");
    expect(t.sent).toEqual(["uci"]);

    t.reply("id name Stockfish 18\nuciok");
    expect(t.sent).toEqual([
      "uci",
      "setoption name UCI_LimitStrength value true",
      "setoption name UCI_Elo value 1600",
      "isready",
    ]);

    // Asked before readyok: it waits, then sends the position and go movetime.
    const reply = anchor.move(initialGameState());
    await flush();
    expect(t.sent).toHaveLength(4);
    t.reply("readyok");
    await flush();
    expect(t.sent.slice(4)).toEqual([`position fen ${START_FEN}`, "go movetime 250"]);

    t.reply("info depth 5 score cp 20 pv e2e4 e7e5");
    t.reply("bestmove e2e4 ponder e7e5");
    await expect(reply).resolves.toEqual({ uci: "e2e4" });

    // A new game resets the hash before the next search.
    anchor.newGame();
    const second = anchor.move(initialGameState());
    await flush();
    expect(t.sent.slice(6)).toEqual(["ucinewgame", "isready"]);
    t.reply("readyok");
    await flush();
    expect(t.sent.slice(8)).toEqual([`position fen ${START_FEN}`, "go movetime 250"]);
    t.reply("bestmove d2d4");
    await expect(second).resolves.toEqual({ uci: "d2d4" });

    anchor.dispose();
    expect(t.terminated()).toBe(true);
    await expect(anchor.move(initialGameState())).rejects.toThrow(/disposed/);
  });

  it("anchor fails on no move, a crash, a hang or a second ask", async () => {
    const t = fakeTransport();
    const anchor = createAnchor(t.transport, { elo: 2000, movetimeMs: 100 });
    t.reply("uciok");
    t.reply("readyok");

    const none = anchor.move(initialGameState());
    await flush();
    await expect(anchor.move(initialGameState())).rejects.toThrow(/busy/);
    t.reply("bestmove (none)");
    await expect(none).rejects.toThrow(/no move/);

    // A search that never answers times out at movetime + 5 s.
    let fire: () => void = () => {};
    const slow = createAnchor(fakeTransport().transport, {
      elo: 2000,
      movetimeMs: 100,
      timers: {
        setTimeout: ((fn: () => void, ms: number) => {
          expect(ms).toBe(5100);
          fire = fn;
          return 1 as unknown as ReturnType<typeof setTimeout>;
        }) as never,
        clearTimeout: () => {},
      },
    });
    const hung = slow.move(initialGameState());
    fire();
    await expect(hung).rejects.toThrow(/timed out/);

    const crashed = anchor.move(initialGameState());
    t.fail(new Error("wasm abort"));
    await expect(crashed).rejects.toThrow(/failed/);
    await expect(anchor.move(initialGameState())).rejects.toThrow(/failed/);
  });

  it("anchor Elo is clamped to Stockfish's 1320 to 3190 and rounded", () => {
    expect(clampAnchorElo(1200)).toBe(1320);
    expect(clampAnchorElo(3500)).toBe(3190);
    expect(clampAnchorElo(1987.6)).toBe(1988);
    const t = fakeTransport();
    createAnchor(t.transport, { elo: 1000, movetimeMs: 100 });
    t.reply("uciok");
    expect(t.sent).toContain("setoption name UCI_Elo value 1320");
  });

  it("default anchors are step - 200, step and step + 200; Full's are around his rating", () => {
    expect(defaultAnchors(1400, 2732)).toEqual([1320, 1400, 1600]);
    expect(defaultAnchors(2100, 2732)).toEqual([1900, 2100, 2300]);
    expect(defaultAnchors("full", 2732)).toEqual([2532, 2732, 2932]);
    expect(defaultAnchors("full", 3100)).toEqual([2900, 3100, 3190]);
    // Clamping never yields the same anchor twice.
    expect(defaultAnchors(1400, 2732, [-300, -200, 0])).toEqual([1320, 1400]);
  });
});
