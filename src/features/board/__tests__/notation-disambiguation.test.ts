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

/** A position with the given pieces, `turn` to move, no castling or en passant. */
function position(pieces: Record<string, PieceType>, turn: PieceColor = "white"): GameState {
  const squares: EngineSquare[][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => null as EngineSquare)
  );
  for (const [name, piece] of Object.entries(pieces)) {
    const [y, x] = sq(name);
    squares[y][x] = piece;
  }
  const noCastle = { kingSide: false, queenSide: false };
  return {
    ...initialGameState(),
    squares,
    turn,
    castling: { white: noCastle, black: noCastle },
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

describe("move notation — telling two same pieces apart (SAN)", () => {
  it("writes Loyd's stalemate game with 4...Rah6", () => {
    const moves = [
      ["e2", "e3"], ["a7", "a5"],
      ["d1", "h5"], ["a8", "a6"],
      ["h5", "a5"], ["h7", "h5"],
      ["h2", "h4"], ["a6", "h6"],
      ["a5", "c7"], ["f7", "f6"],
      ["c7", "d7"], ["e8", "f7"],
      ["d7", "b7"], ["d8", "d3"],
      ["b7", "b8"], ["d3", "h7"],
      ["b8", "c8"], ["f7", "g6"],
      ["c8", "e6"],
    ];
    let state = stateFrom(initialGameState());
    for (const [from, to] of moves) state = play(state, from, to);

    expect(state.notation).toEqual([
      "e3", "a5", "Qh5", "Ra6", "Qxa5", "h5", "h4", "Rah6", "Qxc7", "f6",
      "Qxd7+", "Kf7", "Qxb7", "Qd3", "Qxb8", "Qh7", "Qxc8", "Kg6", "Qe6",
    ]);
  });

  it("adds the origin file when the file tells the rooks apart", () => {
    const engine = position(
      {
        a6: PieceType.BlackQueenRook,
        h8: PieceType.BlackKingRook,
        e8: PieceType.BlackKing,
        e1: PieceType.WhiteKing,
      },
      "black"
    );
    expect(lastNotation(play(stateFrom(engine), "h8", "h6"))).toBe("Rhh6");
  });

  it("puts the file before the capture sign (Raxh6)", () => {
    const engine = position(
      {
        a6: PieceType.BlackQueenRook,
        h8: PieceType.BlackKingRook,
        h6: PieceType.WhiteQueenKnight,
        e8: PieceType.BlackKing,
        e1: PieceType.WhiteKing,
      },
      "black"
    );
    expect(lastNotation(play(stateFrom(engine), "a6", "h6"))).toBe("Raxh6");
  });

  it("adds the origin rank when both rooks share a file", () => {
    const engine = position({
      a1: PieceType.WhiteQueenRook,
      a5: PieceType.WhiteKingRook,
      h2: PieceType.WhiteKing,
      h8: PieceType.BlackKing,
    });
    expect(lastNotation(play(stateFrom(engine), "a1", "a3"))).toBe("R1a3");
  });

  it("adds file and rank when neither alone tells three queens apart", () => {
    // Queens on e4, h4 and h1 can all reach e1; h4 shares its file with h1
    // and its rank with e4. Two of them are promoted queens.
    const engine = position({
      h4: PieceType.WhiteQueen,
      e4: PieceType.WhiteQueenPromoted1,
      h1: PieceType.WhiteQueenPromoted2,
      a2: PieceType.WhiteKing,
      b8: PieceType.BlackKing,
    });
    expect(lastNotation(play(stateFrom(engine), "h4", "e1"))).toBe("Qh4e1");
  });

  it("adds the origin file for knights", () => {
    const engine = position({
      b1: PieceType.WhiteQueenKnight,
      f3: PieceType.WhiteKingKnight,
      e1: PieceType.WhiteKing,
      e8: PieceType.BlackKing,
    });
    expect(lastNotation(play(stateFrom(engine), "b1", "d2"))).toBe("Nbd2");
  });

  it("adds the origin file for bishops", () => {
    const engine = position({
      c1: PieceType.WhiteQueenBishop,
      a3: PieceType.WhiteBishopPromoted1,
      e1: PieceType.WhiteKing,
      e8: PieceType.BlackKing,
    });
    expect(lastNotation(play(stateFrom(engine), "c1", "b2"))).toBe("Bcb2");
  });

  it("does not let a pinned knight force a suffix", () => {
    // The d2 knight is pinned to the d1 king by the d8 rook, so only a3 can go to c4.
    const engine = position({
      a3: PieceType.WhiteQueenKnight,
      d2: PieceType.WhiteKingKnight,
      d1: PieceType.WhiteKing,
      d8: PieceType.BlackKingRook,
      h8: PieceType.BlackKing,
    });
    expect(lastNotation(play(stateFrom(engine), "a3", "c4"))).toBe("Nc4");
  });

  it("does not let a blocked rook force a suffix", () => {
    // The h1 rook cannot pass the d1 knight to reach c1.
    const engine = position({
      a1: PieceType.WhiteQueenRook,
      h1: PieceType.WhiteKingRook,
      d1: PieceType.WhiteQueenKnight,
      g3: PieceType.WhiteKing,
      e8: PieceType.BlackKing,
    });
    expect(lastNotation(play(stateFrom(engine), "a1", "c1"))).toBe("Rc1");
  });

  it("ignores an enemy piece of the same kind", () => {
    const engine = position({
      a1: PieceType.WhiteQueenRook,
      h1: PieceType.BlackKingRook,
      e3: PieceType.WhiteKing,
      e8: PieceType.BlackKing,
    });
    expect(lastNotation(play(stateFrom(engine), "a1", "d1"))).toBe("Rd1");
  });

  it("writes a pawn capture with only its own file (cxd6)", () => {
    const engine = position({
      c5: PieceType.WhitePawnC,
      e5: PieceType.WhitePawnE,
      d6: PieceType.BlackPawnD,
      e1: PieceType.WhiteKing,
      e8: PieceType.BlackKing,
    });
    expect(lastNotation(play(stateFrom(engine), "c5", "d6"))).toBe("cxd6");
  });

  it("adds no suffix to a quiet pawn push with a friendly pawn diagonally behind", () => {
    const engine = position({
      e3: PieceType.WhitePawnE,
      d3: PieceType.WhitePawnD,
      e1: PieceType.WhiteKing,
      e8: PieceType.BlackKing,
    });
    expect(lastNotation(play(stateFrom(engine), "e3", "e4"))).toBe("e4");
  });
});
