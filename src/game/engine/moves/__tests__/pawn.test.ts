import { describe, it, expect } from "vitest";
import { GameState, EngineSquare } from "../../game-state";
import { Move, Position } from "../../engine";
import { PieceType } from "../../../piece-type";
import { pawnMoves } from "../pawn";

/**
 * Pawn pseudo-legal move tests. These pin the generalization of the tracer's
 * white-pawn-push logic to both colours, plus diagonal captures and edge-file
 * bounds handling. En-passant and promotion are explicitly out of scope and are
 * pinned here as NOT present (a last-rank push is an ordinary `Move`).
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

describe("pawnMoves — promotion is out of scope (plain Move on last rank)", () => {
  it("white pawn reaching row 0 emits a plain Move with no extra fields", () => {
    const from: Position = [1, 4];
    const state = stateWith([[from, PieceType.WhitePawnE]], "white");
    const moves = pawnMoves(state, from);

    expect(has(moves, from, [0, 4])).toBe(true);
    const push = moves.find((m) => m.to[0] === 0 && m.to[1] === 4)!;
    // Pinned: an ordinary Move — only `from`/`to`, no promotion-typed field.
    expect(Object.keys(push).sort()).toEqual(["from", "to"]);
  });

  it("black pawn reaching row 7 emits a plain Move with no extra fields", () => {
    const from: Position = [6, 4];
    const state = stateWith([[from, PieceType.BlackPawnE]], "black");
    const moves = pawnMoves(state, from);

    expect(has(moves, from, [7, 4])).toBe(true);
    const push = moves.find((m) => m.to[0] === 7 && m.to[1] === 4)!;
    expect(Object.keys(push).sort()).toEqual(["from", "to"]);
  });
});

describe("pawnMoves — en passant is out of scope (no diagonal onto empty via enPassant)", () => {
  it("does not generate a capture onto an empty diagonal even when enPassant points there", () => {
    const from: Position = [3, 4];
    // enPassant target sits on the white pawn's left forward diagonal, but the
    // square is empty — this generator must ignore state.enPassant entirely.
    const state = stateWith(
      [[from, PieceType.WhitePawnE]],
      "white",
      [2, 3]
    );
    const moves = pawnMoves(state, from);
    expect(has(moves, from, [2, 3])).toBe(false);
  });
});
