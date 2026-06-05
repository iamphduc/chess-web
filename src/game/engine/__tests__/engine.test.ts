import { describe, it, expect } from "vitest";
import { initialGameState, GameState } from "../game-state";
import { legalMoves, applyMove, Move, Position } from "../engine";
import { PieceType } from "../../piece-type";

/**
 * Tracer-bullet seam test: prove `initialGameState` → `legalMoves` → `applyMove`
 * works end to end for one quiet move. The chosen move is White's e-pawn single
 * push, e2→e3: from `[6, 4]` to `[5, 4]`.
 */

const E2: Position = [6, 4];
const E3: Position = [5, 4];

function containsMove(moves: Move[], to: Position): boolean {
  return moves.some(
    (m) =>
      m.from[0] === E2[0] &&
      m.from[1] === E2[1] &&
      m.to[0] === to[0] &&
      m.to[1] === to[1]
  );
}

describe("tracer: legalMoves", () => {
  it("includes the quiet e2->e3 push from the start position", () => {
    const moves = legalMoves(initialGameState(), E2);
    expect(containsMove(moves, E3)).toBe(true);
  });

  it("returns no moves for an empty square", () => {
    const moves = legalMoves(initialGameState(), [4, 4]);
    expect(moves).toEqual([]);
  });

  it("returns no moves for a black piece while it is White's turn", () => {
    const moves = legalMoves(initialGameState(), [1, 4]);
    expect(moves).toEqual([]);
  });
});

describe("tracer: applyMove", () => {
  it("relocates the piece and flips the turn", () => {
    const before = initialGameState();
    const move: Move = { from: E2, to: E3 };

    const after = applyMove(before, move);

    // Source square is now empty.
    expect(after.squares[E2[0]][E2[1]]).toBeNull();
    // Destination square holds the pawn that moved.
    expect(after.squares[E3[0]][E3[1]]).toBe(PieceType.WhitePawnE);
    // Turn flipped.
    expect(after.turn).toBe("black");
  });

  it("does not mutate the input GameState", () => {
    const before = initialGameState();
    const snapshot = structuredClone(before) as GameState;
    const move: Move = { from: E2, to: E3 };

    applyMove(before, move);

    // Input is structurally unchanged.
    expect(before).toEqual(snapshot);
    // Specifically: source still occupied, destination still empty, White to move.
    expect(before.squares[E2[0]][E2[1]]).toBe(PieceType.WhitePawnE);
    expect(before.squares[E3[0]][E3[1]]).toBeNull();
    expect(before.turn).toBe("white");
  });

  it("returns a new object distinct from the input", () => {
    const before = initialGameState();
    const after = applyMove(before, { from: E2, to: E3 });
    expect(after).not.toBe(before);
    expect(after.squares).not.toBe(before.squares);
  });

  it("carries castling rights and promotion counts unchanged for a quiet push", () => {
    const before = initialGameState();
    const after = applyMove(before, { from: E2, to: E3 });
    expect(after.castling).toEqual(before.castling);
    expect(after.promotionCount).toEqual(before.promotionCount);
  });

  it("clears enPassant on a non-double-push quiet move", () => {
    // A single push (e2->e3) is not a double-push, so it must leave no
    // en-passant target even if one was pending.
    const before: GameState = {
      ...initialGameState(),
      enPassant: [2, 0],
    };
    const after = applyMove(before, { from: E2, to: E3 });
    expect(after.enPassant).toBeNull();
  });
});
