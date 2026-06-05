import { describe, it, expect } from "vitest";
import { perft } from "./perft-helper";
import { legalMoves, Position } from "../engine";
import { initialGameState } from "../game-state";

/**
 * Perft ground-truth for the standard starting position.
 *
 * The depth-1/2/3 node counts below (20 / 400 / 8902) are EXTERNAL, published
 * chess ground truth (see the chessprogramming wiki "Perft Results"). They are
 * NOT echoes of whatever the engine happens to produce: a wrong engine would
 * make these assertions fail. Do not adjust them to match the engine — a
 * mismatch is a real move-generation bug to surface, not a number to massage.
 */
describe("perft — standard starting position", () => {
  it("counts depth 1 = 20", () => {
    expect(perft(initialGameState(), 1)).toBe(20);
  });

  it("counts depth 2 = 400", () => {
    expect(perft(initialGameState(), 2)).toBe(400);
  });

  it("counts depth 3 = 8902", () => {
    expect(perft(initialGameState(), 3)).toBe(8902);
  });

  it("depth 0 is the identity leaf (= 1)", () => {
    expect(perft(initialGameState(), 0)).toBe(1);
  });

  it("White has exactly 20 legal moves from the start (direct count)", () => {
    const state = initialGameState();
    let total = 0;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const from: Position = [y, x];
        total += legalMoves(state, from).length;
      }
    }
    expect(total).toBe(20);
  });
});
