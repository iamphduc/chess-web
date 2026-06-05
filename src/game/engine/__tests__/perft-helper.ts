import { applyMove, legalMoves, Position } from "../engine";
import { GameState } from "../game-state";

/**
 * perft — the standard chess move-enumeration benchmark.
 *
 * Counts the number of leaf nodes reachable from `state` by playing exactly
 * `depth` plies of LEGAL moves. This is the canonical correctness oracle for a
 * move generator: any discrepancy against published ground-truth counts pins a
 * real bug (missed move, illegal move generated, faulty `applyMove`).
 *
 * Contract:
 * - `depth === 0` → `1` (the current node is itself one leaf).
 * - otherwise → the sum, over every piece of the side to move and every legal
 *   move of that piece, of `perft(applyMove(state, move), depth - 1)`.
 *
 * The board scan mirrors `game-status.ts`'s `allLegalMoves` (iterate all 64
 * squares, collect `legalMoves` for each square holding a side-to-move piece),
 * but is kept self-contained and test-only — it deliberately does NOT import
 * from `game-status.ts`.
 *
 * Promotions fan out: each of the four promotion targets is a distinct `Move`
 * from `legalMoves`, and each counts as a distinct node here, as is standard for
 * perft.
 *
 * Pure: never mutates `state` (`applyMove` returns a fresh `GameState`).
 */
export function perft(state: GameState, depth: number): number {
  if (depth === 0) return 1;

  let nodes = 0;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const piece = state.squares[y][x];
      if (piece === null) continue;
      // `legalMoves` already rejects out-of-turn `from` squares (it returns
      // `[]`), so it is the single source of truth for whose move it is.
      const from: Position = [y, x];
      for (const move of legalMoves(state, from)) {
        nodes += perft(applyMove(state, move), depth - 1);
      }
    }
  }
  return nodes;
}
