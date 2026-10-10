import { describe, it, expect } from "vitest";
import { applyMove, legalMoves, Move, Position } from "../../engine/engine";
import {
  EngineSquare,
  GameState,
  initialGameState,
} from "../../engine/game-state";
import { PieceType } from "../../piece-type";
import {
  moveToUci,
  positionKey,
  squareName,
  toFen,
  uciToMove,
} from "../position";

const P = PieceType;

/** Play UCI moves from `state`, failing loudly if any is rejected. */
function play(state: GameState, ...ucis: string[]): GameState {
  return ucis.reduce((s, uci) => {
    const move = uciToMove(s, uci);
    if (move === null) throw new Error(`rejected ${uci}`);
    return applyMove(s, move);
  }, state);
}

function emptyGrid(): EngineSquare[][] {
  return Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => null as EngineSquare)
  );
}

const NO_RIGHTS = {
  white: { kingSide: false, queenSide: false },
  black: { kingSide: false, queenSide: false },
};

/** A custom position from `{ e1: piece, ... }`, no castling rights. */
function board(
  pieces: Record<string, PieceType>,
  overrides: Partial<GameState> = {}
): GameState {
  const grid = emptyGrid();
  for (const [sq, piece] of Object.entries(pieces)) {
    const x = "abcdefgh".indexOf(sq[0]);
    const y = 8 - Number(sq[1]);
    grid[y][x] = piece;
  }
  return {
    ...initialGameState(),
    squares: grid,
    castling: NO_RIGHTS,
    ...overrides,
  };
}

/** The UCI for `move`, and it must parse back to an equal legal move. */
function roundTrip(state: GameState, move: Move): string {
  const uci = moveToUci(move);
  expect(uciToMove(state, uci)).toEqual(move);
  return uci;
}

function findMove(
  state: GameState,
  from: Position,
  to: Position,
  promotion?: Move["promotion"]
): Move {
  const move = legalMoves(state, from).find(
    (m) =>
      m.to[0] === to[0] && m.to[1] === to[1] && m.promotion === promotion
  );
  if (!move) throw new Error("no such legal move");
  return move;
}

describe("moveToUci and uciToMove round-trip special moves", () => {
  it("names squares by file x and rank 8 - y", () => {
    expect(squareName([7, 4])).toBe("e1");
    expect(squareName([0, 0])).toBe("a8");
    expect(squareName([7, 7])).toBe("h1");
    expect(squareName([0, 7])).toBe("h8");
  });

  it("round-trips a quiet move and a capture", () => {
    const start = initialGameState();
    expect(roundTrip(start, findMove(start, [6, 4], [4, 4]))).toBe("e2e4");
    expect(roundTrip(start, findMove(start, [7, 6], [5, 5]))).toBe("g1f3");

    const s = play(start, "e2e4", "d7d5");
    expect(roundTrip(s, findMove(s, [4, 4], [3, 3]))).toBe("e4d5");
  });

  it("round-trips both castles for both colors as the king's two-file move", () => {
    const pieces = {
      e1: P.WhiteKing,
      a1: P.WhiteQueenRook,
      h1: P.WhiteKingRook,
      e8: P.BlackKing,
      a8: P.BlackQueenRook,
      h8: P.BlackKingRook,
    };
    const all = {
      white: { kingSide: true, queenSide: true },
      black: { kingSide: true, queenSide: true },
    };
    const white = board(pieces, { castling: all });
    const black = board(pieces, { castling: all, turn: "black" });

    expect(roundTrip(white, findMove(white, [7, 4], [7, 6]))).toBe("e1g1");
    expect(roundTrip(white, findMove(white, [7, 4], [7, 2]))).toBe("e1c1");
    expect(roundTrip(black, findMove(black, [0, 4], [0, 6]))).toBe("e8g8");
    expect(roundTrip(black, findMove(black, [0, 4], [0, 2]))).toBe("e8c8");

    // Applying the parsed castle moves the rook too.
    const after = applyMove(white, uciToMove(white, "e1g1")!);
    expect(after.squares[7][5]).toBe(P.WhiteKingRook);
  });

  it("round-trips en passant for both colors", () => {
    const w = play(initialGameState(), "e2e4", "a7a6", "e4e5", "d7d5");
    expect(roundTrip(w, findMove(w, [3, 4], [2, 3]))).toBe("e5d6");

    const b = play(initialGameState(), "a2a3", "e7e5", "a3a4", "e5e4", "d2d4");
    expect(roundTrip(b, findMove(b, [4, 4], [5, 3]))).toBe("e4d3");
    const afterEp = applyMove(b, uciToMove(b, "e4d3")!);
    expect(afterEp.squares[4][3]).toBeNull();
  });

  it("round-trips all four promotions, push and capture, both colors", () => {
    const s = board({
      e1: P.WhiteKing,
      h8: P.BlackKing,
      b7: P.WhitePawnB,
      c8: P.BlackQueenKnight,
    });
    const kinds = ["queen", "rook", "bishop", "knight"] as const;
    const letters = ["q", "r", "b", "n"];
    kinds.forEach((kind, i) => {
      expect(roundTrip(s, findMove(s, [1, 1], [0, 1], kind))).toBe(
        `b7b8${letters[i]}`
      );
      expect(roundTrip(s, findMove(s, [1, 1], [0, 2], kind))).toBe(
        `b7c8${letters[i]}`
      );
    });

    const black = board(
      { e1: P.WhiteKing, h8: P.BlackKing, g2: P.BlackPawnG },
      { turn: "black" }
    );
    kinds.forEach((kind, i) => {
      expect(roundTrip(black, findMove(black, [6, 6], [7, 6], kind))).toBe(
        `g2g1${letters[i]}`
      );
    });
  });

  it("round-trips every legal move of a busy middlegame", () => {
    const s = play(
      initialGameState(),
      "e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6", "d2d3", "f8c5"
    );
    let count = 0;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        for (const m of legalMoves(s, [y, x])) {
          roundTrip(s, m);
          count++;
        }
      }
    }
    expect(count).toBeGreaterThan(20);
  });
});

describe("uciToMove rejects every non-legal input", () => {
  const start = initialGameState();

  it("accepts the well-formed legal control move", () => {
    expect(uciToMove(start, "e2e4")).toEqual({ from: [6, 4], to: [4, 4] });
  });

  it("rejects malformed text", () => {
    for (const bad of [
      "",
      "e2",
      "e2e",
      "e2e4 ",
      " e2e4",
      "E2E4",
      "e2-e4",
      "i2i4",
      "e0e4",
      "e9e4",
      "e2e4qq",
      "e2e4x",
      "e2e4k",
      "e2e4p",
      "0000",
    ]) {
      expect(uciToMove(start, bad), bad).toBeNull();
    }
  });

  it("rejects an empty from-square and a piece of the side not to move", () => {
    expect(uciToMove(start, "e4e5")).toBeNull();
    expect(uciToMove(start, "e7e5")).toBeNull();
    const black = play(start, "e2e4");
    expect(uciToMove(black, "d2d4")).toBeNull();
  });

  it("rejects an illegal move", () => {
    expect(uciToMove(start, "e2e5")).toBeNull();
    expect(uciToMove(start, "e1g1")).toBeNull();
    expect(uciToMove(start, "g1g3")).toBeNull();
    // Pinned piece may not leave the pin line.
    const pinned = board({
      e1: P.WhiteKing,
      e2: P.WhiteKingKnight,
      e8: P.BlackQueenRook,
      a8: P.BlackKing,
    });
    expect(uciToMove(pinned, "e2c3")).toBeNull();
    expect(uciToMove(pinned, "e1d1")).not.toBeNull();
  });

  it("rejects a last-rank pawn move without a suffix, and an uppercase suffix", () => {
    const s = board({ e1: P.WhiteKing, h8: P.BlackKing, b7: P.WhitePawnB });
    expect(uciToMove(s, "b7b8")).toBeNull();
    expect(uciToMove(s, "b7b8Q")).toBeNull();
    expect(uciToMove(s, "b7b8q")).not.toBeNull();
  });

  it("rejects a suffix on a non-promotion", () => {
    expect(uciToMove(start, "e2e4q")).toBeNull();
    expect(uciToMove(start, "g1f3n")).toBeNull();
    expect(uciToMove(start, "g1f3")).not.toBeNull();
    const s = board({ e1: P.WhiteKing, h8: P.BlackKing, b6: P.WhitePawnB });
    expect(uciToMove(s, "b6b7q")).toBeNull();
  });
});

describe("positionKey of the start position", () => {
  it("is the first four FEN fields", () => {
    expect(positionKey(initialGameState())).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"
    );
  });

  it("writes black to move, empty runs, and promoted pieces by kind", () => {
    expect(positionKey(play(initialGameState(), "e2e4"))).toBe(
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -"
    );
    const s = board({ e1: P.WhiteKing, h8: P.BlackKing, b7: P.WhitePawnB });
    const promoted = applyMove(s, uciToMove(s, "b7b8n")!);
    expect(positionKey(promoted)).toBe("1N5k/8/8/8/8/8/8/4K3 b - -");
  });
});

describe("positionKey writes en passant only when capturable", () => {
  it("writes the target when the side to move has a legal capture", () => {
    const s = play(initialGameState(), "e2e4", "a7a6", "e4e5", "d7d5");
    expect(positionKey(s)).toBe(
      "rnbqkbnr/1pp1pppp/p7/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6"
    );
  });

  it("writes - after a double push with no adjacent enemy pawn", () => {
    expect(positionKey(play(initialGameState(), "e2e4")).endsWith(" -")).toBe(
      true
    );
  });

  it("writes - when the only adjacent pawn is pinned", () => {
    const pieces = {
      e1: P.WhiteKing,
      e5: P.WhitePawnE,
      h8: P.BlackKing,
      d7: P.BlackPawnD,
    };
    const free = play(board(pieces, { turn: "black" }), "d7d5");
    expect(positionKey(free)).toBe("7k/8/8/3pP3/8/8/8/4K3 w - d6");

    const pinned = play(
      board({ ...pieces, e8: P.BlackQueenRook }, { turn: "black" }),
      "d7d5"
    );
    expect(positionKey(pinned)).toBe("4r2k/8/8/3pP3/8/8/8/4K3 w - -");
  });

  it("writes - when the capture would expose the king along the rank", () => {
    const s = play(
      board(
        {
          h5: P.WhiteKing,
          e5: P.WhitePawnE,
          a5: P.BlackQueenRook,
          a8: P.BlackKing,
          d7: P.BlackPawnD,
        },
        { turn: "black" }
      ),
      "d7d5"
    );
    expect(positionKey(s)).toBe("k7/8/8/r2pP2K/8/8/8/8 w - -");
  });
});

describe("transpositions share a key", () => {
  it("1.d4 d5 2.c4 equals 1.c4 d5 2.d4", () => {
    const a = play(initialGameState(), "d2d4", "d7d5", "c2c4");
    const b = play(initialGameState(), "c2c4", "d7d5", "d2d4");
    expect(positionKey(a)).toBe(positionKey(b));
    expect(positionKey(a)).toBe(
      "rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq -"
    );
  });
});

describe("positionKey castling field", () => {
  const castlingOf = (s: GameState) => positionKey(s).split(" ")[2];

  it("drops both rights when the king moves", () => {
    const s = play(initialGameState(), "e2e4", "e7e5", "e1e2");
    expect(castlingOf(s)).toBe("kq");
    expect(castlingOf(play(s, "e8e7"))).toBe("-");
  });

  it("drops one right when a rook moves", () => {
    const s = play(initialGameState(), "h2h4", "a7a5", "h1h3");
    expect(castlingOf(s)).toBe("Qkq");
    expect(castlingOf(play(s, "a8a6"))).toBe("Qk");
  });

  it("drops the right of a rook captured on its corner", () => {
    // The g2 bishop takes b7, then the a8 rook.
    const s = play(
      initialGameState(),
      "g2g3", "b7b6", "f1g2", "c8b7", "g2b7", "e7e6", "b7a8"
    );
    expect(castlingOf(s)).toBe("KQk");
  });
});

describe("toFen counters", () => {
  it('defaults to "0 1"', () => {
    expect(toFen(initialGameState())).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    );
  });

  it("appends the given counters after the key", () => {
    const s = play(initialGameState(), "g1f3", "g8f6");
    expect(toFen(s, { halfmove: 2, fullmove: 2 })).toBe(
      `${positionKey(s)} 2 2`
    );
  });
});
