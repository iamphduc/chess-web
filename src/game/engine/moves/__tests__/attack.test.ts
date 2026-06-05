import { describe, it, expect } from "vitest";
import { GameState, EngineSquare, PieceColor } from "../../game-state";
import { Position } from "../../engine";
import { PieceType } from "../../../piece-type";
import { isSquareAttacked, findKing, isInCheck } from "../attack";

/** Build a GameState with a custom 8x8 grid, defaulting every square to empty. */
function makeState(
  placements: { square: Position; piece: EngineSquare }[],
  turn: PieceColor = "white"
): GameState {
  const squares: EngineSquare[][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => null as EngineSquare)
  );
  for (const { square, piece } of placements) {
    const [y, x] = square;
    squares[y][x] = piece;
  }
  return {
    squares,
    turn,
    castling: {
      white: { kingSide: true, queenSide: true },
      black: { kingSide: true, queenSide: true },
    },
    enPassant: null,
    promotionCount: [0, 0, 0, 0, 0, 0, 0, 0],
  };
}

describe("isSquareAttacked — rook", () => {
  it("attacks along its rank/file up to AND including a blocker, but not beyond", () => {
    // Rook on [4,4]. Enemy pawn at [4,1] blocks the -x ray.
    const state = makeState([
      { square: [4, 4], piece: PieceType.WhiteQueenRook },
      { square: [4, 1], piece: PieceType.BlackPawnA },
    ]);

    // Along the open +x ray.
    expect(isSquareAttacked(state, [4, 5], "white")).toBe(true);
    expect(isSquareAttacked(state, [4, 7], "white")).toBe(true);

    // Along the open +y / -y rays.
    expect(isSquareAttacked(state, [0, 4], "white")).toBe(true);
    expect(isSquareAttacked(state, [7, 4], "white")).toBe(true);

    // The blocker square itself IS attacked.
    expect(isSquareAttacked(state, [4, 1], "white")).toBe(true);
    // Squares beyond the blocker are NOT.
    expect(isSquareAttacked(state, [4, 0], "white")).toBe(false);

    // Diagonals are not rook attacks.
    expect(isSquareAttacked(state, [5, 5], "white")).toBe(false);
  });
});

describe("isSquareAttacked — bishop and queen", () => {
  it("a bishop attacks its diagonals but not orthogonals", () => {
    const state = makeState([
      { square: [4, 4], piece: PieceType.WhiteKingBishop },
    ]);
    expect(isSquareAttacked(state, [2, 2], "white")).toBe(true);
    expect(isSquareAttacked(state, [7, 7], "white")).toBe(true);
    expect(isSquareAttacked(state, [4, 0], "white")).toBe(false);
    expect(isSquareAttacked(state, [0, 4], "white")).toBe(false);
  });

  it("a queen attacks both diagonals and orthogonals", () => {
    const state = makeState([{ square: [4, 4], piece: PieceType.WhiteQueen }]);
    // Diagonal.
    expect(isSquareAttacked(state, [2, 2], "white")).toBe(true);
    // Orthogonal.
    expect(isSquareAttacked(state, [4, 0], "white")).toBe(true);
    expect(isSquareAttacked(state, [0, 4], "white")).toBe(true);
    // A knight-shaped square is not a queen attack.
    expect(isSquareAttacked(state, [6, 5], "white")).toBe(false);
  });

  it("a promoted queen attacks like a queen", () => {
    const state = makeState([
      { square: [4, 4], piece: PieceType.WhiteQueenPromoted1 },
    ]);
    expect(isSquareAttacked(state, [2, 2], "white")).toBe(true);
    expect(isSquareAttacked(state, [4, 0], "white")).toBe(true);
  });
});

describe("isSquareAttacked — knight", () => {
  it("attacks its eight L-targets and nothing else", () => {
    const state = makeState([
      { square: [4, 4], piece: PieceType.WhiteQueenKnight },
    ]);
    const targets: Position[] = [
      [2, 3],
      [2, 5],
      [3, 2],
      [3, 6],
      [5, 2],
      [5, 6],
      [6, 3],
      [6, 5],
    ];
    for (const t of targets) {
      expect(isSquareAttacked(state, t, "white")).toBe(true);
    }
    // Adjacent and diagonal squares are NOT knight attacks.
    expect(isSquareAttacked(state, [4, 5], "white")).toBe(false);
    expect(isSquareAttacked(state, [5, 5], "white")).toBe(false);
    expect(isSquareAttacked(state, [4, 4], "white")).toBe(false);
  });
});

describe("isSquareAttacked — pawn", () => {
  it("a white pawn attacks its two forward diagonals (toward row 0), NOT the push square", () => {
    // White pawn on [4,4]; white attacks toward row 0 (y-1).
    const state = makeState([
      { square: [4, 4], piece: PieceType.WhitePawnA },
    ]);
    expect(isSquareAttacked(state, [3, 3], "white")).toBe(true);
    expect(isSquareAttacked(state, [3, 5], "white")).toBe(true);
    // The push square directly ahead is NOT attacked.
    expect(isSquareAttacked(state, [3, 4], "white")).toBe(false);
    // The square directly behind is not attacked either.
    expect(isSquareAttacked(state, [5, 4], "white")).toBe(false);
    expect(isSquareAttacked(state, [5, 3], "white")).toBe(false);
  });

  it("a black pawn attacks its two forward diagonals (toward row 7), NOT the push square", () => {
    // Black pawn on [4,4]; black attacks toward row 7 (y+1).
    const state = makeState([
      { square: [4, 4], piece: PieceType.BlackPawnA },
    ]);
    expect(isSquareAttacked(state, [5, 3], "black")).toBe(true);
    expect(isSquareAttacked(state, [5, 5], "black")).toBe(true);
    // The push square directly ahead is NOT attacked.
    expect(isSquareAttacked(state, [5, 4], "black")).toBe(false);
    // White-direction diagonals are not black-pawn attacks.
    expect(isSquareAttacked(state, [3, 3], "black")).toBe(false);
    expect(isSquareAttacked(state, [3, 5], "black")).toBe(false);
  });
});

describe("isSquareAttacked — king", () => {
  it("attacks its eight neighbours and nothing further", () => {
    const state = makeState([{ square: [4, 4], piece: PieceType.WhiteKing }]);
    const neighbours: Position[] = [
      [3, 3],
      [3, 4],
      [3, 5],
      [4, 3],
      [4, 5],
      [5, 3],
      [5, 4],
      [5, 5],
    ];
    for (const n of neighbours) {
      expect(isSquareAttacked(state, n, "white")).toBe(true);
    }
    // Two squares away is out of king range.
    expect(isSquareAttacked(state, [4, 6], "white")).toBe(false);
    expect(isSquareAttacked(state, [2, 4], "white")).toBe(false);
  });
});

describe("isSquareAttacked — colour filtering", () => {
  it("only counts attackers of the requested colour", () => {
    const state = makeState([
      { square: [4, 4], piece: PieceType.WhiteQueenRook },
    ]);
    // [4,5] is attacked by white but not by black (no black piece on the board).
    expect(isSquareAttacked(state, [4, 5], "white")).toBe(true);
    expect(isSquareAttacked(state, [4, 5], "black")).toBe(false);
  });
});

describe("isSquareAttacked — turn independence", () => {
  it("gives the same answer regardless of state.turn", () => {
    const placements: { square: Position; piece: EngineSquare }[] = [
      { square: [4, 4], piece: PieceType.WhiteQueenRook },
    ];
    const whiteTurn = makeState(placements, "white");
    const blackTurn = makeState(placements, "black");

    for (const target of [
      [4, 5],
      [0, 4],
      [4, 4],
      [5, 5],
    ] as Position[]) {
      expect(isSquareAttacked(whiteTurn, target, "white")).toBe(
        isSquareAttacked(blackTurn, target, "white")
      );
    }
  });
});

describe("findKing", () => {
  it("locates each colour's king", () => {
    const state = makeState([
      { square: [0, 4], piece: PieceType.BlackKing },
      { square: [7, 4], piece: PieceType.WhiteKing },
    ]);
    expect(findKing(state, "white")).toEqual([7, 4]);
    expect(findKing(state, "black")).toEqual([0, 4]);
  });

  it("returns null when the requested colour's king is absent", () => {
    const state = makeState([
      { square: [7, 4], piece: PieceType.WhiteKing },
    ]);
    expect(findKing(state, "black")).toBeNull();
  });
});

describe("isInCheck", () => {
  it("is true when the king is attacked by an enemy slider", () => {
    const state = makeState([
      { square: [4, 4], piece: PieceType.WhiteKing },
      { square: [4, 0], piece: PieceType.BlackQueenRook },
    ]);
    expect(isInCheck(state, "white")).toBe(true);
  });

  it("is true when the king is attacked by an enemy knight", () => {
    const state = makeState([
      { square: [4, 4], piece: PieceType.WhiteKing },
      { square: [2, 3], piece: PieceType.BlackQueenKnight },
    ]);
    expect(isInCheck(state, "white")).toBe(true);
  });

  it("is true when the king is attacked by an enemy pawn", () => {
    // White king on [4,4]; a black pawn on [3,3] attacks toward row 7,
    // i.e. [4,2] and [4,4] — so it checks the king on [4,4].
    const state = makeState([
      { square: [4, 4], piece: PieceType.WhiteKing },
      { square: [3, 3], piece: PieceType.BlackPawnA },
    ]);
    expect(isInCheck(state, "white")).toBe(true);
  });

  it("is false when no enemy piece attacks the king", () => {
    const state = makeState([
      { square: [4, 4], piece: PieceType.WhiteKing },
      // Black rook blocked by a friendly-to-it pawn before reaching the king.
      { square: [4, 0], piece: PieceType.BlackQueenRook },
      { square: [4, 2], piece: PieceType.BlackPawnA },
    ]);
    expect(isInCheck(state, "white")).toBe(false);
  });

  it("is false (not throwing) when the colour has no king on the board", () => {
    const state = makeState([
      { square: [4, 0], piece: PieceType.BlackQueenRook },
    ]);
    expect(isInCheck(state, "white")).toBe(false);
  });
});
