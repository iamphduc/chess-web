import { describe, expect, it } from "vitest";
import { applyMove } from "../../engine/engine";
import { EngineSquare, GameState, initialGameState } from "../../engine/game-state";
import { uciToMove } from "../../opponent/position";
import { PieceType } from "../../piece-type";
import { gameMoves, moveLabel } from "../moves";

const P = PieceType;

/** Every position of a game played from `start`, start included. */
function positionsOf(start: GameState, ucis: readonly string[]): GameState[] {
  const out = [start];
  for (const uci of ucis) {
    const last = out[out.length - 1];
    const move = uciToMove(last, uci);
    if (move === null) throw new Error(`rejected ${uci}`);
    out.push(applyMove(last, move));
  }
  return out;
}

const NO_RIGHTS = {
  white: { kingSide: false, queenSide: false },
  black: { kingSide: false, queenSide: false },
};

/** A custom position from `{ e1: piece, ... }`, no castling rights. */
function board(pieces: Record<string, PieceType>, turn: "white" | "black" = "white"): GameState {
  const grid: EngineSquare[][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => null as EngineSquare)
  );
  for (const [sq, piece] of Object.entries(pieces)) {
    grid[8 - Number(sq[1])]["abcdefgh".indexOf(sq[0])] = piece;
  }
  return { ...initialGameState(), squares: grid, castling: NO_RIGHTS, turn };
}

// En passant (3.exf6), a promotion (5.gxh8=Q), and both castles.
const GAME = [
  "e2e4", "d7d5",
  "e4e5", "f7f5",
  "e5f6", "b8c6",
  "f6g7", "c8f5",
  "g7h8q", "d8d7",
  "g1f3", "e8c8",
  "f1e2", "e7e5",
  "e1g1",
];

describe("gameMoves replays a game", () => {
  it("recovers every ply, castling, en passant and a promotion included", () => {
    expect(gameMoves(positionsOf(initialGameState(), GAME))).toEqual(GAME);
  });

  it("finds an under-promotion", () => {
    const start = board({ a7: P.WhitePawnA, e1: P.WhiteKing, h8: P.BlackKing });
    expect(gameMoves(positionsOf(start, ["a7a8n"]))).toEqual(["a7a8n"]);
  });

  it("has no plies for a game that hasn't started", () => {
    expect(gameMoves([initialGameState()])).toEqual([]);
  });
});

describe("gameMoves throws on a gap", () => {
  it("names the ply whose next position no legal move reaches", () => {
    const all = positionsOf(initialGameState(), ["e2e4", "e7e5", "g1f3"]);
    const gap = [all[0], all[1], all[3]];
    expect(() => gameMoves(gap)).toThrow(RangeError);
    expect(() => gameMoves(gap)).toThrow(/ply 1\b/);
  });

  it("throws on a repeated position (a null move)", () => {
    const all = positionsOf(initialGameState(), ["e2e4"]);
    expect(() => gameMoves([all[0], all[1], all[1]])).toThrow(/ply 1\b/);
  });
});

describe("moveLabel writes SAN", () => {
  const positions = positionsOf(initialGameState(), GAME);
  const label = (ply: number) => moveLabel(positions[ply], GAME[ply], ply);

  it("numbers White's and Black's moves", () => {
    expect(label(0)).toBe("1.e4");
    expect(label(1)).toBe("1...d5");
    expect(label(5)).toBe("3...Nc6");
    expect(label(7)).toBe("4...Bf5");
  });

  it("writes pawn captures, en passant and a promotion", () => {
    expect(label(4)).toBe("3.exf6");
    expect(label(6)).toBe("4.fxg7");
    expect(label(8)).toBe("5.gxh8=Q");
  });

  it("writes both castles", () => {
    expect(label(11)).toBe("6...O-O-O");
    expect(label(14)).toBe("8.O-O");
  });

  it("writes a piece capture", () => {
    const s = positionsOf(initialGameState(), ["e2e4", "d7d5", "f1b5", "c8d7"]);
    expect(moveLabel(s[4], "b5d7", 4)).toBe("3.Bxd7+");
  });

  it("adds + for check and # for mate", () => {
    const s = positionsOf(initialGameState(), ["e2e4", "d7d5"]);
    expect(moveLabel(s[2], "f1b5", 2)).toBe("2.Bb5+");
    const m = positionsOf(initialGameState(), ["f2f3", "e7e5", "g2g4"]);
    expect(moveLabel(m[3], "d8h4", 3)).toBe("2...Qh4#");
  });

  it("disambiguates by file, then rank, then both", () => {
    const knights = board({ b1: P.WhiteQueenKnight, f3: P.WhiteKingKnight, e1: P.WhiteKing, h8: P.BlackKing });
    expect(moveLabel(knights, "b1d2", 20)).toBe("11.Nbd2");
    const rooks = board({ a1: P.WhiteQueenRook, a5: P.WhiteKingRook, e1: P.WhiteKing, h8: P.BlackKing });
    expect(moveLabel(rooks, "a1a3", 20)).toBe("11.R1a3");
    const queens = board({
      a1: P.WhiteQueen, a3: P.WhiteQueenPromoted1, c1: P.WhiteQueenPromoted2,
      e1: P.WhiteKing, h7: P.BlackKing,
    });
    expect(moveLabel(queens, "a1b2", 20)).toBe("11.Qa1b2");
  });

  it("doesn't disambiguate against a piece that can't legally go there", () => {
    // The c3 knight is pinned by the a5 bishop, so only the g1 knight reaches e2.
    const pinned = board({
      c3: P.WhiteQueenKnight, g1: P.WhiteKingKnight, e1: P.WhiteKing,
      a5: P.BlackQueenBishop, h8: P.BlackKing,
    });
    expect(moveLabel(pinned, "g1e2", 20)).toBe("11.Ne2");
  });

  it("throws on a move that isn't legal", () => {
    expect(() => moveLabel(initialGameState(), "e2e5", 0)).toThrow(RangeError);
  });
});
