import { describe, expect, it } from "vitest";
import {
  EngineSquare,
  GameState,
  initialGameState,
} from "../../engine/game-state";
import { PieceType } from "../../piece-type";
import { hangsMaterial, materialNet } from "../material";
import { uciToMove } from "../position";

const P = PieceType;

const NO_RIGHTS = {
  white: { kingSide: false, queenSide: false },
  black: { kingSide: false, queenSide: false },
};

/** A custom position from `{ e1: piece, ... }`, White to move, no castling. */
function board(
  pieces: Record<string, PieceType>,
  overrides: Partial<GameState> = {}
): GameState {
  const grid: EngineSquare[][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => null as EngineSquare)
  );
  for (const [sq, piece] of Object.entries(pieces)) {
    grid[8 - Number(sq[1])]["abcdefgh".indexOf(sq[0])] = piece;
  }
  return {
    ...initialGameState(),
    squares: grid,
    castling: NO_RIGHTS,
    ...overrides,
  };
}

/** Whether the legal move `uci` hangs material; fails if it isn't legal. */
function hangs(state: GameState, uci: string): boolean {
  const move = uciToMove(state, uci);
  if (move === null) throw new Error(`illegal test move ${uci}`);
  return hangsMaterial(state, move);
}

describe("hangsMaterial", () => {
  it("an undefended piece left en prise hangs", () => {
    // The knight on d4 is attacked by the bishop and nothing defends it.
    const open = board({ e1: P.WhiteKing, d4: P.WhiteKingKnight, a2: P.WhitePawnA,
      h8: P.BlackKing, b6: P.BlackKingBishop });
    expect(hangs(open, "a2a3")).toBe(true);

    // With a pawn on c3 defending it, the trade is even.
    const defended = board({ e1: P.WhiteKing, d4: P.WhiteKingKnight, a2: P.WhitePawnA,
      c3: P.WhitePawnC, h8: P.BlackKing, b6: P.BlackKingBishop });
    expect(hangs(defended, "a2a3")).toBe(false);
  });

  it("a piece attacked by a cheaper piece hangs", () => {
    // Qd5 is defended by the e4 pawn, but the c6 pawn takes it: 9 - 1.
    const state = board({ e1: P.WhiteKing, d1: P.WhiteQueen, e4: P.WhitePawnE,
      h8: P.BlackKing, c6: P.BlackPawnC });
    expect(hangs(state, "d1d5")).toBe(true);
  });

  it("what the move captured counts", () => {
    // NxN, and the e6 pawn takes back: even.
    const trade = board({ e1: P.WhiteKing, c3: P.WhiteQueenKnight,
      h8: P.BlackKing, d5: P.BlackKingKnight, e6: P.BlackPawnE });
    expect(hangs(trade, "c3d5")).toBe(false);

    // QxP onto a square the e6 pawn defends: a queen for a pawn.
    const greedy = board({ e1: P.WhiteKing, d1: P.WhiteQueen,
      h8: P.BlackKing, d5: P.BlackPawnD, e6: P.BlackPawnE });
    expect(hangs(greedy, "d1d5")).toBe(true);
  });

  it("a promotion counts the new piece, less the pawn", () => {
    // b8=Q, Rxb8: 9 lost against the 8 the promotion gained.
    const state = board({ e1: P.WhiteKing, b7: P.WhitePawnB,
      h8: P.BlackKing, a8: P.BlackQueenRook });
    expect(hangs(state, "b7b8q")).toBe(false);
    // b8=N, Rxb8: 3 lost against 2 gained.
    expect(hangs(state, "b7b8n")).toBe(false);
  });

  it("an en-passant capture counts its pawn", () => {
    // After exd6 e.p., Nxc4 bxc4 wins the exchange (5 - 3 = 2), less the
    // pawn taken en passant: 1, under the threshold.
    const state = board(
      { e1: P.WhiteKing, e5: P.WhitePawnE, c4: P.WhiteQueenRook, b3: P.WhitePawnB,
        h8: P.BlackKing, d5: P.BlackPawnD, b6: P.BlackQueenKnight },
      { enPassant: [2, 3] }
    );
    expect(hangs(state, "e5d6")).toBe(false);
    // A quiet move there leaves the exchange hanging: 2.
    expect(hangs(state, "e1d2")).toBe(true);
  });

  it("a pawn is under the threshold", () => {
    const state = board({ e1: P.WhiteKing, e4: P.WhitePawnE,
      h8: P.BlackKing, d6: P.BlackPawnD });
    expect(hangs(state, "e4e5")).toBe(false);

    // A knight on the same square is worth more than the threshold.
    const knight = board({ e1: P.WhiteKing, d3: P.WhiteKingKnight,
      h8: P.BlackKing, d6: P.BlackPawnD });
    expect(hangs(knight, "d3e5")).toBe(true);
  });

  it("only legal captures back defend", () => {
    // Bd5 looks defended by Ne3, but the knight is pinned to the king by Re8.
    const pinned = board({ e1: P.WhiteKing, e3: P.WhiteKingKnight, b3: P.WhiteKingBishop,
      h8: P.BlackKing, e8: P.BlackKingRook, f6: P.BlackKingKnight });
    expect(hangs(pinned, "b3d5")).toBe(true);

    // Without the pin, NxB NxN is even.
    const free = board({ e1: P.WhiteKing, e3: P.WhiteKingKnight, b3: P.WhiteKingBishop,
      h8: P.BlackKing, f6: P.BlackKingKnight });
    expect(hangs(free, "b3d5")).toBe(false);
  });

  it("the start position's first moves hang nothing", () => {
    const start = initialGameState();
    for (const uci of ["e2e4", "d2d4", "g1f3", "b1c3", "a2a4"]) {
      expect(hangs(start, uci)).toBe(false);
    }
  });
});

describe("materialNet", () => {
  it("is what the move takes, less the best capture back", () => {
    // Black to move: exf4 takes the queen, and only a pawn is lost back.
    const state = board(
      { e1: P.WhiteKing, f4: P.WhiteQueen, e3: P.WhitePawnE, a5: P.WhiteKingKnight,
        h8: P.BlackKing, e5: P.BlackPawnE, a8: P.BlackQueenRook },
      { turn: "black" }
    );
    const net = (uci: string) => {
      const move = uciToMove(state, uci);
      if (move === null) throw new Error(`illegal test move ${uci}`);
      return materialNet(state, move);
    };
    expect(net("e5f4")).toBe(8);
    // Rxa5 takes a knight, but leaves e5 to the queen: Qxe5+ Rxe5 is a loss
    // for White, so nothing is lost back.
    expect(net("a8a5")).toBe(3);
    // A quiet move takes nothing and leaves the pawn: Qxe5+ wins it.
    expect(net("h8g8")).toBe(-1);
  });
});

