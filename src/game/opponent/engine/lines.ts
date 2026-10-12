// Imports nothing, so the step table (and `liemTurn`) can use these types
// without pulling Stockfish into the entry bundle.

/**
 * An engine score from the side to move's view. `mate` N > 0: he mates in N
 * moves; N < 0: he is mated in |N| moves.
 */
export type Score = { cp: number } | { mate: number };

/** One MultiPV line: its first move (UCI), its score and its search depth. */
export interface EngineLine {
  move: string;
  score: Score;
  depth: number;
}

/** How hard one search looks: depth, line count and a time backstop. */
export interface SearchLimits {
  depth: number;
  multiPv: number;
  movetimeMs: number;
}
