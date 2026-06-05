import { describe, it, expect } from "vitest";
import { GameState, EngineSquare } from "../../game-state";
import { Move, Position, applyMove } from "../../engine";
import { PieceType } from "../../../piece-type";
import { pieceKind, colorOf } from "../classify";
import { pawnMoves } from "../pawn";

/**
 * Pawn pseudo-legal move tests. These pin the generalization of the tracer's
 * white-pawn-push logic to both colours, plus diagonal captures and edge-file
 * bounds handling, AND the `special-moves` extensions: en-passant generation
 * (a diagonal onto the `state.enPassant` empty square) and four-way promotion
 * (a last-rank landing expands to four `promotion`-typed moves).
 */

/** An empty 8x8 grid. */
function emptyBoard(): EngineSquare[][] {
  return Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => null as EngineSquare)
  );
}

/**
 * Build a minimal `GameState` from a placement map and side to move. The
 * castling/en-passant/promotion fields are filler — the generator must not read
 * them (en-passant especially is out of scope).
 */
function stateWith(
  placements: ReadonlyArray<readonly [Position, PieceType]>,
  turn: "white" | "black",
  enPassant: GameState["enPassant"] = null
): GameState {
  const squares = emptyBoard();
  for (const [[y, x], piece] of placements) {
    squares[y][x] = piece;
  }
  return {
    squares,
    turn,
    castling: {
      white: { kingSide: true, queenSide: true },
      black: { kingSide: true, queenSide: true },
    },
    enPassant,
    promotionCount: [0, 0, 0, 0, 0, 0, 0, 0],
  };
}

/** Does `moves` contain a move from `from` to `to`? */
function has(moves: Move[], from: Position, to: Position): boolean {
  return moves.some(
    (m) =>
      m.from[0] === from[0] &&
      m.from[1] === from[1] &&
      m.to[0] === to[0] &&
      m.to[1] === to[1]
  );
}

/** Sorted list of destination tuples, for exact set assertions. */
function destinations(moves: Move[]): [number, number][] {
  return moves
    .map((m): [number, number] => [m.to[0], m.to[1]])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

describe("pawnMoves — white pushes", () => {
  it("yields single + double push from the start rank over a clear path", () => {
    const from: Position = [6, 4];
    const state = stateWith([[from, PieceType.WhitePawnE]], "white");
    const moves = pawnMoves(state, from);

    expect(has(moves, from, [5, 4])).toBe(true); // single
    expect(has(moves, from, [4, 4])).toBe(true); // double
    expect(destinations(moves)).toEqual([
      [4, 4],
      [5, 4],
    ]);
  });

  it("yields only the single push once off the start rank", () => {
    const from: Position = [5, 4];
    const state = stateWith([[from, PieceType.WhitePawnE]], "white");
    const moves = pawnMoves(state, from);

    expect(has(moves, from, [4, 4])).toBe(true);
    expect(destinations(moves)).toEqual([[4, 4]]);
  });

  it("yields no push when a piece sits directly ahead", () => {
    const from: Position = [6, 4];
    const state = stateWith(
      [
        [from, PieceType.WhitePawnE],
        [[5, 4], PieceType.BlackPawnE],
      ],
      "white"
    );
    expect(pawnMoves(state, from)).toEqual([]);
  });

  it("yields only the single push when the double-push landing square is blocked", () => {
    const from: Position = [6, 4];
    const state = stateWith(
      [
        [from, PieceType.WhitePawnE],
        [[4, 4], PieceType.BlackPawnE],
      ],
      "white"
    );
    const moves = pawnMoves(state, from);
    expect(destinations(moves)).toEqual([[5, 4]]);
  });
});

describe("pawnMoves — white captures", () => {
  it("includes a diagonal only when an enemy sits there", () => {
    const from: Position = [6, 4];
    const state = stateWith(
      [
        [from, PieceType.WhitePawnE],
        [[5, 3], PieceType.BlackPawnD], // enemy on left diagonal
      ],
      "white"
    );
    const moves = pawnMoves(state, from);
    expect(has(moves, from, [5, 3])).toBe(true);
  });

  it("excludes a diagonal that is empty", () => {
    const from: Position = [6, 4];
    const state = stateWith([[from, PieceType.WhitePawnE]], "white");
    const moves = pawnMoves(state, from);
    expect(has(moves, from, [5, 3])).toBe(false);
    expect(has(moves, from, [5, 5])).toBe(false);
  });

  it("excludes a diagonal occupied by a friendly piece", () => {
    const from: Position = [6, 4];
    const state = stateWith(
      [
        [from, PieceType.WhitePawnE],
        [[5, 5], PieceType.WhiteKnightPromoted1], // friendly on right diagonal
      ],
      "white"
    );
    const moves = pawnMoves(state, from);
    expect(has(moves, from, [5, 5])).toBe(false);
  });
});

describe("pawnMoves — black mirrors white in +y", () => {
  it("yields single + double push from the start rank (row 1) over a clear path", () => {
    const from: Position = [1, 4];
    const state = stateWith([[from, PieceType.BlackPawnE]], "black");
    const moves = pawnMoves(state, from);

    expect(has(moves, from, [2, 4])).toBe(true); // single (+y)
    expect(has(moves, from, [3, 4])).toBe(true); // double
    expect(destinations(moves)).toEqual([
      [2, 4],
      [3, 4],
    ]);
  });

  it("yields only the single push once off the start rank", () => {
    const from: Position = [2, 4];
    const state = stateWith([[from, PieceType.BlackPawnE]], "black");
    expect(destinations(pawnMoves(state, from))).toEqual([[3, 4]]);
  });

  it("blocks the push when a piece sits directly ahead (+y)", () => {
    const from: Position = [1, 4];
    const state = stateWith(
      [
        [from, PieceType.BlackPawnE],
        [[2, 4], PieceType.WhitePawnE],
      ],
      "black"
    );
    expect(pawnMoves(state, from)).toEqual([]);
  });

  it("captures forward-diagonally onto an enemy (toward +y)", () => {
    const from: Position = [1, 4];
    const state = stateWith(
      [
        [from, PieceType.BlackPawnE],
        [[2, 5], PieceType.WhitePawnF], // enemy on a forward diagonal
      ],
      "black"
    );
    expect(has(pawnMoves(state, from), from, [2, 5])).toBe(true);
  });
});

describe("pawnMoves — edge files drop the off-board diagonal", () => {
  it("white a-file pawn: no off-board diagonal at x = -1, keeps the in-board one", () => {
    const from: Position = [6, 0]; // a-file
    const state = stateWith(
      [
        [from, PieceType.WhitePawnA],
        [[5, 1], PieceType.BlackPawnB], // the only valid diagonal (x+1)
      ],
      "white"
    );
    const moves = pawnMoves(state, from);
    expect(has(moves, from, [5, 1])).toBe(true);
    // No move may reference an off-board square on either axis.
    for (const m of moves) {
      expect(m.to[0]).toBeGreaterThanOrEqual(0);
      expect(m.to[0]).toBeLessThan(8);
      expect(m.to[1]).toBeGreaterThanOrEqual(0);
      expect(m.to[1]).toBeLessThan(8);
    }
  });

  it("white h-file pawn: no off-board diagonal at x = 8, keeps the in-board one", () => {
    const from: Position = [6, 7]; // h-file
    const state = stateWith(
      [
        [from, PieceType.WhitePawnH],
        [[5, 6], PieceType.BlackPawnG], // the only valid diagonal (x-1)
      ],
      "white"
    );
    const moves = pawnMoves(state, from);
    expect(has(moves, from, [5, 6])).toBe(true);
    for (const m of moves) {
      expect(m.to[1]).toBeGreaterThanOrEqual(0);
      expect(m.to[1]).toBeLessThan(8);
    }
  });
});

/** The promotion kinds carried by a set of last-rank moves, sorted. */
function promotionKinds(moves: Move[], to: Position): (string | undefined)[] {
  return moves
    .filter((m) => m.to[0] === to[0] && m.to[1] === to[1])
    .map((m) => m.promotion)
    .sort();
}

describe("pawnMoves — promotion expands a last-rank landing to four moves", () => {
  it("white push to row 0 yields exactly four moves, one per promotion kind", () => {
    const from: Position = [1, 4];
    const state = stateWith([[from, PieceType.WhitePawnE]], "white");
    const moves = pawnMoves(state, from);

    // The push reaches the last rank: four distinct-kind moves, no plain push.
    expect(promotionKinds(moves, [0, 4])).toEqual([
      "bishop",
      "knight",
      "queen",
      "rook",
    ]);
    // Exactly four moves total (only the push is possible here).
    expect(moves).toHaveLength(4);
    for (const m of moves) {
      expect(m.from).toEqual(from);
      expect(m.to).toEqual([0, 4]);
    }
  });

  it("black push to row 7 yields exactly four distinct-kind promotion moves", () => {
    const from: Position = [6, 4];
    const state = stateWith([[from, PieceType.BlackPawnE]], "black");
    const moves = pawnMoves(state, from);

    expect(promotionKinds(moves, [7, 4])).toEqual([
      "bishop",
      "knight",
      "queen",
      "rook",
    ]);
    expect(moves).toHaveLength(4);
  });

  it("white capture onto the last rank also expands to four promotion moves", () => {
    const from: Position = [1, 4];
    const state = stateWith(
      [
        [from, PieceType.WhitePawnE],
        [[0, 3], PieceType.BlackQueenRook], // enemy on the last-rank diagonal
        [[0, 4], PieceType.BlackKing], // blocks the push so only the capture remains
      ],
      "white"
    );
    const moves = pawnMoves(state, from);

    expect(promotionKinds(moves, [0, 3])).toEqual([
      "bishop",
      "knight",
      "queen",
      "rook",
    ]);
    expect(moves).toHaveLength(4);
  });

  it("a non-last-rank push and capture carry no promotion field", () => {
    const from: Position = [6, 4];
    const state = stateWith(
      [
        [from, PieceType.WhitePawnE],
        [[5, 3], PieceType.BlackPawnD], // capture, not on the last rank
      ],
      "white"
    );
    const moves = pawnMoves(state, from);
    for (const m of moves) {
      expect(m.promotion).toBeUndefined();
      expect(Object.keys(m).sort()).toEqual(["from", "to"]);
    }
  });
});

describe("pawnMoves — en passant generates a capture onto the enPassant square", () => {
  it("white captures en passant onto the empty square behind a double-pushed pawn", () => {
    // Black just double-pushed d7→d5; the en-passant target is d6 = [2, 3].
    const from: Position = [3, 4]; // white pawn on e5
    const state = stateWith(
      [
        [from, PieceType.WhitePawnE],
        [[3, 3], PieceType.BlackPawnD], // the pawn that double-pushed, on d5
      ],
      "white",
      [2, 3] // enPassant target d6
    );
    const moves = pawnMoves(state, from);
    expect(has(moves, from, [2, 3])).toBe(true);
  });

  it("black captures en passant toward +y onto the enPassant square", () => {
    // White double-pushed e2→e4; the en-passant target is e3 = [5, 4].
    const from: Position = [4, 3]; // black pawn on d4
    const state = stateWith(
      [
        [from, PieceType.BlackPawnD],
        [[4, 4], PieceType.WhitePawnE], // the pawn that double-pushed, on e4
      ],
      "black",
      [5, 4] // enPassant target e3
    );
    const moves = pawnMoves(state, from);
    expect(has(moves, from, [5, 4])).toBe(true);
  });

  it("generates no diagonal-onto-empty when enPassant is null", () => {
    const from: Position = [3, 4];
    const state = stateWith(
      [
        [from, PieceType.WhitePawnE],
        [[3, 3], PieceType.BlackPawnD],
      ],
      "white",
      null
    );
    const moves = pawnMoves(state, from);
    expect(has(moves, from, [2, 3])).toBe(false);
    expect(has(moves, from, [2, 5])).toBe(false);
  });

  it("generates no en-passant move when enPassant points at a different square", () => {
    const from: Position = [3, 4];
    // enPassant points two files away — not either of this pawn's diagonals.
    const state = stateWith(
      [[from, PieceType.WhitePawnE]],
      "white",
      [2, 1]
    );
    const moves = pawnMoves(state, from);
    expect(has(moves, from, [2, 3])).toBe(false);
    expect(has(moves, from, [2, 5])).toBe(false);
  });

  it("en-passant capture carries no promotion field (it cannot reach the last rank)", () => {
    const from: Position = [3, 4];
    const state = stateWith(
      [[from, PieceType.WhitePawnE]],
      "white",
      [2, 3]
    );
    const ep = pawnMoves(state, from).find(
      (m) => m.to[0] === 2 && m.to[1] === 3
    )!;
    expect(ep.promotion).toBeUndefined();
  });

  it("an edge-file en-passant target does not wrap to the off-board diagonal", () => {
    // White a-file pawn on a5 = [3, 0]; a bogus enPassant at [2, -1] is off-board
    // and must never produce a move (inBounds gates the diagonal first).
    const from: Position = [3, 0];
    const state = stateWith(
      [[from, PieceType.WhitePawnA]],
      "white",
      [2, 7] // far h-file target — cannot be reached by an a-file pawn
    );
    const moves = pawnMoves(state, from);
    for (const m of moves) {
      expect(m.to[1]).toBeGreaterThanOrEqual(0);
      expect(m.to[1]).toBeLessThan(8);
    }
    expect(has(moves, from, [2, 7])).toBe(false);
  });
});

describe("pawnMoves — cross-check with applyMove (engine-core)", () => {
  it("applyMove on the generated en-passant move removes the captured pawn", () => {
    const from: Position = [3, 4]; // white e5
    const state = stateWith(
      [
        [from, PieceType.WhitePawnE],
        [[3, 3], PieceType.BlackPawnD], // black pawn on d5
      ],
      "white",
      [2, 3] // en-passant target d6
    );
    const ep = pawnMoves(state, from).find(
      (m) => m.to[0] === 2 && m.to[1] === 3
    )!;
    const next = applyMove(state, ep);

    // The mover landed on d6; its origin and the captured pawn's square are empty.
    expect(next.squares[2][3]).toBe(PieceType.WhitePawnE);
    expect(next.squares[3][4]).toBeNull();
    expect(next.squares[3][3]).toBeNull(); // captured black pawn removed
  });

  it("applyMove on a promotion move yields an allocated promoted id of that kind", () => {
    const from: Position = [1, 4];
    const state = stateWith([[from, PieceType.WhitePawnE]], "white");
    const queenMove = pawnMoves(state, from).find(
      (m) => m.promotion === "queen"
    )!;
    const next = applyMove(state, queenMove);

    const landed = next.squares[0][4]!;
    expect(landed).not.toBeNull();
    expect(pieceKind(landed)).toBe("queen");
    expect(colorOf(landed)).toBe("white");
    expect(next.squares[1][4]).toBeNull();
  });
});
