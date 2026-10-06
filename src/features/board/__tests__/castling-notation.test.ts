import { describe, it, expect } from "vitest";

import { boardSlice, selectPiece, movePiece } from "../BoardSlice";
import { projectSquares } from "../engineAdapter";
import { PieceType } from "../../../game/piece-type";
import {
  EngineSquare,
  GameState,
  PieceColor,
  initialGameState,
} from "../../../game/engine/game-state";

const { reducer } = boardSlice;
type BoardState = ReturnType<typeof reducer>;

/** "e4" -> [y, x] in the engine grid (row 0 is rank 8). */
function sq(name: string): [number, number] {
  return [8 - Number(name[1]), name.charCodeAt(0) - 97];
}

/** A position with the given pieces, `turn` to move, and white's castling rights. */
function position(pieces: Record<string, PieceType>, turn: PieceColor = "white"): GameState {
  const squares: EngineSquare[][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => null as EngineSquare)
  );
  for (const [name, piece] of Object.entries(pieces)) {
    const [y, x] = sq(name);
    squares[y][x] = piece;
  }
  return {
    ...initialGameState(),
    squares,
    turn,
    castling: {
      white: { kingSide: true, queenSide: true },
      black: { kingSide: false, queenSide: false },
    },
    enPassant: null,
  };
}

function stateFrom(engine: GameState): BoardState {
  const fresh = reducer(undefined, { type: "@@INIT" });
  return {
    ...fresh,
    engineHistory: [engine],
    history: [{ squares: projectSquares(engine) }],
  };
}

/** Select the piece on `from` and drop it on `to`, as the board does. */
function play(state: BoardState, from: string, to: string): BoardState {
  const [y, x] = sq(from);
  const pieceType = state.history[state.history.length - 1].squares[y][x].pieceType;
  if (!pieceType) throw new Error(`no piece on ${from}`);
  const selected = reducer(state, selectPiece({ pieceType, y, x }));
  return reducer(selected, movePiece({ to: sq(to) }));
}

function lastNotation(state: BoardState): string {
  return state.notation[state.notation.length - 1];
}

describe("castling notation uses the letter O (PGN / SAN)", () => {
  it("writes king-side castling as O-O for both sides", () => {
    const moves = [
      ["e2", "e4"],
      ["e7", "e5"],
      ["g1", "f3"],
      ["g8", "f6"],
      ["f1", "c4"],
      ["f8", "c5"],
      ["e1", "g1"],
      ["e8", "g8"],
    ];
    let state = stateFrom(initialGameState());
    for (const [from, to] of moves) state = play(state, from, to);

    expect(state.notation).toEqual(["e4", "e5", "Nf3", "Nf6", "Bc4", "Bc5", "O-O", "O-O"]);
  });

  it("writes queen-side castling as O-O-O for both sides", () => {
    const moves = [
      ["d2", "d4"],
      ["d7", "d5"],
      ["b1", "c3"],
      ["b8", "c6"],
      ["c1", "f4"],
      ["c8", "f5"],
      ["d1", "d2"],
      ["d8", "d7"],
      ["e1", "c1"],
      ["e8", "c8"],
    ];
    let state = stateFrom(initialGameState());
    for (const [from, to] of moves) state = play(state, from, to);

    expect(state.notation.slice(-2)).toEqual(["O-O-O", "O-O-O"]);
  });

  it("never writes castling with the digit zero", () => {
    let state = stateFrom(initialGameState());
    for (const [from, to] of [
      ["e2", "e4"],
      ["e7", "e5"],
      ["g1", "f3"],
      ["b8", "c6"],
      ["f1", "c4"],
      ["g8", "f6"],
      ["e1", "g1"],
    ]) {
      state = play(state, from, to);
    }
    expect(state.notation.join(" ")).not.toContain("0");
  });

  it("adds + when king-side castling gives check (O-O+)", () => {
    // After O-O the rook on f1 checks the king on f5; the king can step away.
    let state = stateFrom(
      position({ e1: PieceType.WhiteKing, h1: PieceType.WhiteKingRook, f5: PieceType.BlackKing })
    );
    state = play(state, "e1", "g1");
    expect(lastNotation(state)).toBe("O-O+");
  });

  it("adds + when queen-side castling gives check (O-O-O+)", () => {
    let state = stateFrom(
      position({ e1: PieceType.WhiteKing, a1: PieceType.WhiteQueenRook, d5: PieceType.BlackKing })
    );
    state = play(state, "e1", "c1");
    expect(lastNotation(state)).toBe("O-O-O+");
  });

  it("adds # when king-side castling mates (O-O#)", () => {
    // Black king boxed in on f8 by its own rooks and pawns; the f1 rook mates.
    let state = stateFrom(
      position({
        e1: PieceType.WhiteKing,
        h1: PieceType.WhiteKingRook,
        f8: PieceType.BlackKing,
        e8: PieceType.BlackKingRook,
        g8: PieceType.BlackKingRook,
        e7: PieceType.BlackPawnE,
        g7: PieceType.BlackPawnG,
      })
    );
    state = play(state, "e1", "g1");
    expect(lastNotation(state)).toBe("O-O#");
  });

  it("adds # when queen-side castling mates (O-O-O#)", () => {
    let state = stateFrom(
      position({
        e1: PieceType.WhiteKing,
        a1: PieceType.WhiteQueenRook,
        d8: PieceType.BlackKing,
        c8: PieceType.BlackQueenRook,
        e8: PieceType.BlackKingRook,
        c7: PieceType.BlackPawnC,
        e7: PieceType.BlackPawnE,
      })
    );
    state = play(state, "e1", "c1");
    expect(lastNotation(state)).toBe("O-O-O#");
  });
});
