import { describe, it, expect } from "vitest";
import { GameState, EngineSquare, PieceColor } from "../game-state";
import { legalMoves, Move, Position } from "../engine";
import { PieceType } from "../../piece-type";

/**
 * King-safety filter tests for `legalMoves`.
 *
 * These pin the `legal-filter` slice contract: `legalMoves` returns pseudo-legal
 * moves minus any that leave the MOVER's own king in check. The three canonical
 * cases — pinned piece, in-check resolution, king stepping into attack — plus a
 * no-escape position that filters every piece to `[]`.
 *
 * Boards are built directly as sparse 8x8 grids (row 0 = Black back rank,
 * row 7 = White) so each position isolates exactly one rule.
 */

/** An empty 8x8 grid. */
function emptyBoard(): EngineSquare[][] {
  return Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => null as EngineSquare)
  );
}

/** Assemble a `GameState` from a sparse `[y, x, piece]` placement list. */
function makeState(
  turn: PieceColor,
  placements: ReadonlyArray<readonly [number, number, PieceType]>
): GameState {
  const squares = emptyBoard();
  for (const [y, x, piece] of placements) {
    squares[y][x] = piece;
  }
  return {
    squares,
    turn,
    castling: {
      white: { kingSide: false, queenSide: false },
      black: { kingSide: false, queenSide: false },
    },
    enPassant: null,
    promotionCount: [0, 0, 0, 0, 0, 0, 0, 0],
  };
}

/** True iff `moves` contains a move landing on `to`. */
function hasTo(moves: Move[], to: Position): boolean {
  return moves.some((m) => m.to[0] === to[0] && m.to[1] === to[1]);
}

describe("legalMoves: pinned piece", () => {
  // White king on e1 [7,4]; White knight directly in front on e2 [6,4];
  // Black rook far up the e-file on e8 [0,4]. The knight is absolutely pinned:
  // every knight hop leaves the rook's ray onto the king open.
  const pinned = makeState("white", [
    [7, 4, PieceType.WhiteKing],
    [6, 4, PieceType.WhiteKingKnight],
    [0, 4, PieceType.BlackQueenRook],
    [7, 0, PieceType.WhiteQueenRook], // an unrelated, unpinned friendly rook
  ]);

  it("gives the pinned knight no legal moves", () => {
    const moves = legalMoves(pinned, [6, 4]);
    expect(moves).toEqual([]);
  });

  it("still lets an unpinned friendly piece move", () => {
    // The a1 rook is free to slide along rank 7 and up the a-file.
    const moves = legalMoves(pinned, [7, 0]);
    expect(moves.length).toBeGreaterThan(0);
  });
});

describe("legalMoves: in check, must resolve", () => {
  // White king on e1 [7,4] checked by a Black rook on e8 [0,4].
  // A White rook sits on a4 [3,0]; only its block onto e4 [3,4] resolves the
  // check — every other rook move is illegal. The king may also step aside.
  const inCheck = makeState("white", [
    [7, 4, PieceType.WhiteKing],
    [0, 4, PieceType.BlackQueenRook],
    [3, 0, PieceType.WhiteQueenRook],
  ]);

  it("returns only the blocking move for the rook", () => {
    const moves = legalMoves(inCheck, [3, 0]);
    expect(moves).toEqual([{ from: [3, 0], to: [3, 4] }]);
  });

  it("filters out an unrelated rook move that leaves the king in check", () => {
    const moves = legalMoves(inCheck, [3, 0]);
    // a4 -> b4 [3,1] does not interpose on the e-file, so it stays in check.
    expect(hasTo(moves, [3, 1])).toBe(false);
  });

  it("lets the king step off the checked file", () => {
    const moves = legalMoves(inCheck, [7, 4]);
    // d1 [7,3] and f1 [7,5] are off the e-file and unattacked.
    expect(hasTo(moves, [7, 3])).toBe(true);
    expect(hasTo(moves, [7, 5])).toBe(true);
    // e2 [6,4] stays on the rook's file -> still illegal.
    expect(hasTo(moves, [6, 4])).toBe(false);
  });
});

describe("legalMoves: king cannot step into attack", () => {
  // White king on e1 [7,4]; Black rook on d8 [0,3] covers the whole d-file,
  // and Black rook on f8 [0,5] covers the whole f-file. The king's only safe
  // neighbours are on the e-file (e2 [6,4]); d1/d2/f1/f2 are all attacked.
  const boxed = makeState("white", [
    [7, 4, PieceType.WhiteKing],
    [0, 3, PieceType.BlackQueenRook],
    [0, 5, PieceType.BlackKingRook],
  ]);

  it("filters neighbours that the enemy attacks", () => {
    const moves = legalMoves(boxed, [7, 4]);
    expect(hasTo(moves, [7, 3])).toBe(false); // d1 attacked
    expect(hasTo(moves, [6, 3])).toBe(false); // d2 attacked
    expect(hasTo(moves, [7, 5])).toBe(false); // f1 attacked
    expect(hasTo(moves, [6, 5])).toBe(false); // f2 attacked
  });

  it("keeps the safe e-file neighbour", () => {
    const moves = legalMoves(boxed, [7, 4]);
    expect(hasTo(moves, [6, 4])).toBe(true); // e2 safe
  });

  it("cannot capture a DEFENDED enemy piece adjacent to the king", () => {
    // White king e1 [7,4]; Black pawn on d2 [6,3] sits next to the king but is
    // defended by a Black bishop on a5 [3,0] (a5->d2 diagonal: [3,0]->[4,1]->
    // [5,2]->[6,3]). Capturing the pawn would leave the king on a square the
    // bishop attacks.
    const defended = makeState("white", [
      [7, 4, PieceType.WhiteKing],
      [6, 3, PieceType.BlackPawnD],
      [3, 0, PieceType.BlackQueenBishop],
    ]);
    const moves = legalMoves(defended, [7, 4]);
    expect(hasTo(moves, [6, 3])).toBe(false); // capturing the defended pawn is illegal
  });
});

describe("legalMoves: no escape returns [] for every piece", () => {
  // Back-rank mate shape: White king on h1 [7,7], pinned in by its own pawns on
  // g2 [6,6] and h2 [6,7]; a Black rook delivers mate on h8 -> ... actually use
  // a fully mated position. Black queen on g2-adjacent... simpler: smothered-ish.
  //
  // White king h1 [7,7]; White pawns g2 [6,6], h2 [6,7]; Black rook on a1 [7,0]
  // gives check along rank 7 — the king cannot move (g1 covered by the rook,
  // and its own pawns block g2/h2), and nothing can block or capture the rook.
  const mated = makeState("white", [
    [7, 7, PieceType.WhiteKing],
    [6, 6, PieceType.WhitePawnG],
    [6, 7, PieceType.WhitePawnH],
    [7, 0, PieceType.BlackQueenRook],
  ]);

  it("returns [] for the king", () => {
    expect(legalMoves(mated, [7, 7])).toEqual([]);
  });

  it("returns [] for each blocked pawn (no push resolves the check)", () => {
    expect(legalMoves(mated, [6, 6])).toEqual([]);
    expect(legalMoves(mated, [6, 7])).toEqual([]);
  });
});
