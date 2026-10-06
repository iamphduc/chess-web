import { describe, it, expect } from "vitest";

import { pieceNotation } from "../piece-notation";
import { PieceType } from "../piece-type";
import { EngineSquare, GameState, initialGameState } from "../engine/game-state";

/** An empty 8x8 engine grid for hand-built notation scenarios. */
function emptyBoard(): EngineSquare[][] {
  return Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => null as EngineSquare)
  );
}

/** White to move on `board`, with both kings added out of the way. */
function whiteToMove(board: EngineSquare[][]): GameState {
  board[7][7] = PieceType.WhiteKing; // h1
  board[0][7] = PieceType.BlackKing; // h8
  return { ...initialGameState(), squares: board, turn: "white" };
}

describe("PieceNotation.getSuffixAbbreviation — pawn capture disambiguation", () => {
  it("disambiguates two white pawns capturing the same enemy square (file suffix)", () => {
    // White pawns on c5 [3,2] and e5 [3,4] can both capture a black piece on d6 [2,3].
    // Mover = c5 pawn -> the suffix carries c5's origin file ('c').
    const board = emptyBoard();
    board[3][2] = PieceType.WhitePawnC; // c5 (mover)
    board[3][4] = PieceType.WhitePawnE; // e5 (rival)
    board[2][3] = PieceType.BlackPawnD; // d6 (enemy on the capture square)

    const suffix = pieceNotation.getSuffixAbbreviation(
      whiteToMove(board),
      [3, 2],
      [2, 3]
    );
    expect(suffix).toBe("c");
  });

  it("does NOT disambiguate a quiet pawn push when a friendly pawn sits diagonally behind the empty destination", () => {
    // White pawn e3 [5,4] pushes to e4 [4,4] (EMPTY). A friendly white pawn on
    // d3 [5,3] sits diagonally behind the destination but cannot capture an empty
    // square, so no file suffix is warranted. (Regression: the geometry-only
    // inline produced a spurious 'e'.)
    const board = emptyBoard();
    board[5][4] = PieceType.WhitePawnE; // e3 (mover)
    board[5][3] = PieceType.WhitePawnD; // d3 (friendly, diagonally behind e4)

    const suffix = pieceNotation.getSuffixAbbreviation(
      whiteToMove(board),
      [5, 4],
      [4, 4]
    );
    expect(suffix).toBe("");
  });
});
