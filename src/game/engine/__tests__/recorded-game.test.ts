/**
 * Replay of Scholar's Mate — a well-known 4-move decisive miniature.
 *
 * Moves (algebraic): 1. e4 e5  2. Qh5 Nc6  3. Bc4 Nf6??  4. Qxf7#
 *
 * Source: standard opening trap, universally documented in chess literature
 * (e.g., https://www.chess.com/terms/scholars-mate).
 *
 * Coordinate convention (engine grid):
 *   squares[y][x], row 0 = Black's back rank (rank 8), row 7 = White's back rank (rank 1)
 *   file a..h = x 0..7
 *   rank r (1..8) -> y = 8 - r
 *
 * Selected square conversions verified by hand:
 *   e2 -> rank 2, file e -> y=6, x=4 -> [6,4]
 *   e4 -> rank 4, file e -> y=4, x=4 -> [4,4]
 *   e7 -> rank 7, file e -> y=1, x=4 -> [1,4]
 *   e5 -> rank 5, file e -> y=3, x=4 -> [3,4]
 *   d1 -> rank 1, file d -> y=7, x=3 -> [7,3]
 *   h5 -> rank 5, file h -> y=3, x=7 -> [3,7]
 *   b8 -> rank 8, file b -> y=0, x=1 -> [0,1]
 *   c6 -> rank 6, file c -> y=2, x=2 -> [2,2]
 *   f1 -> rank 1, file f -> y=7, x=5 -> [7,5]
 *   c4 -> rank 4, file c -> y=4, x=2 -> [4,2]
 *   g8 -> rank 8, file g -> y=0, x=6 -> [0,6]
 *   f6 -> rank 6, file f -> y=2, x=5 -> [2,5]
 *   f7 -> rank 7, file f -> y=1, x=5 -> [1,5]
 */

import { describe, it, expect } from "vitest";
import { legalMoves, applyMove, Move, Position } from "../engine";
import { initialGameState, GameState } from "../game-state";
import { gameStatus } from "../game-status";

/**
 * Convert an algebraic square name (e.g. "e4") to a `[y, x]` Position.
 *
 * Engine grid: row 0 = Black's back rank (rank 8), row 7 = White's back rank (rank 1).
 *   y = 8 - rank
 *   x = file index (a=0 .. h=7)
 *
 * Intentionally local to this test file — do NOT export or add a non-test parser.
 */
function algebraic(square: string): Position {
  const file = square.charCodeAt(0) - "a".charCodeAt(0); // a=0 .. h=7
  const rank = parseInt(square[1], 10);                   // 1..8
  const y = 8 - rank;
  const x = file;
  return [y, x];
}

/**
 * Find the move in `legalMoves(state, from)` whose `to` matches `to` (and
 * `promotion` if supplied). Asserts that such a move exists and returns it.
 */
function findLegalMove(
  state: GameState,
  from: Position,
  to: Position,
  promotion?: Move["promotion"]
): Move {
  const moves = legalMoves(state, from);
  const match = moves.find(
    (m) =>
      m.to[0] === to[0] &&
      m.to[1] === to[1] &&
      m.promotion === promotion
  );
  expect(
    match,
    `Expected legal move from [${from}] to [${to}]${promotion ? ` (promote=${promotion})` : ""} but it was not in legalMoves. Got: ${JSON.stringify(moves)}`
  ).toBeDefined();
  return match!;
}

describe("Scholar's mate replay (1. e4 e5  2. Qh5 Nc6  3. Bc4 Nf6??  4. Qxf7#)", () => {
  it("replays all 7 plies and reaches checkmate", () => {
    let state = initialGameState();

    // Ply 1 — White: e2 -> e4
    {
      const from = algebraic("e2"); // [6,4]
      const to   = algebraic("e4"); // [4,4]
      const move = findLegalMove(state, from, to);
      state = applyMove(state, move);
      expect(state.turn).toBe("black");
    }

    // Ply 2 — Black: e7 -> e5
    {
      const from = algebraic("e7"); // [1,4]
      const to   = algebraic("e5"); // [3,4]
      const move = findLegalMove(state, from, to);
      state = applyMove(state, move);
      expect(state.turn).toBe("white");
    }

    // Ply 3 — White: d1 -> h5  (Queen to h5)
    {
      const from = algebraic("d1"); // [7,3]
      const to   = algebraic("h5"); // [3,7]
      const move = findLegalMove(state, from, to);
      state = applyMove(state, move);
      expect(state.turn).toBe("black");
    }

    // Ply 4 — Black: b8 -> c6  (Knight to c6)
    {
      const from = algebraic("b8"); // [0,1]
      const to   = algebraic("c6"); // [2,2]
      const move = findLegalMove(state, from, to);
      state = applyMove(state, move);
      expect(state.turn).toBe("white");
    }

    // Ply 5 — White: f1 -> c4  (Bishop to c4)
    {
      const from = algebraic("f1"); // [7,5]
      const to   = algebraic("c4"); // [4,2]
      const move = findLegalMove(state, from, to);
      state = applyMove(state, move);
      expect(state.turn).toBe("black");
    }

    // Ply 6 — Black: g8 -> f6  (Knight to f6?? — the blunder)
    {
      const from = algebraic("g8"); // [0,6]
      const to   = algebraic("f6"); // [2,5]
      const move = findLegalMove(state, from, to);
      state = applyMove(state, move);
      expect(state.turn).toBe("white");
    }

    // Ply 7 — White: h5 -> f7#  (Qxf7# — checkmate)
    {
      const from = algebraic("h5"); // [3,7]
      const to   = algebraic("f7"); // [1,5]
      const move = findLegalMove(state, from, to);
      state = applyMove(state, move);
      expect(state.turn).toBe("black");
    }

    // Final position: Black is in checkmate.
    expect(gameStatus(state)).toBe("checkmate");
  });
});
