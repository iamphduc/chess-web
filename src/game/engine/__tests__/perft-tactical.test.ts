import { describe, it, expect } from "vitest";
import { GameState, EngineSquare, PromotionCount } from "../game-state";
import { PieceType } from "../../piece-type";
import { perft } from "./perft-helper";

/**
 * Perft anchor: the "Kiwipete" tactical position (Peter McKenzie).
 *
 * One of the most-cited perft test positions: it deliberately exercises every
 * tricky move-generation case at once — castling for both sides (`KQkq`), pins,
 * discovered attacks, multiple capture lines, and (deeper) en passant and
 * promotion. A move generator that passes the published Kiwipete counts is very
 * unlikely to harbour a categorical bug.
 *
 * FEN: r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -
 *
 * Published perft node counts (Chess Programming Wiki, "Perft Results"):
 *   depth 1 =      48
 *   depth 2 =   2 039
 *   depth 3 =  97 862   (asserted below — fast enough)
 *
 * The depth-1 count (48) is a transcription tripwire: if the hand-built board
 * yields anything other than 48 at depth 1, the position is mis-transcribed
 * (or there is an engine bug). These counts are external ground truth and must
 * NOT be massaged to match the engine — fix the board, never the number.
 *
 * FEN → grid transcription
 * ------------------------
 * The engine grid is `squares[y][x]` with row 0 = Black's back rank (rank 8) and
 * row 7 = White's back rank (rank 1); file a..h = x 0..7. So FEN rank 8 maps to
 * row 0 and we read each rank left-to-right (a→h) into x 0→7. Lowercase = Black,
 * uppercase = White. Each occupied square gets a distinct, kind-correct
 * `PieceType` id (any id of the right kind/colour is valid — `pieceKind` keys
 * only on the kind substring).
 *
 *   rank 8 (row 0)  r 3 k 2 r          a8=r  e8=k  h8=r
 *   rank 7 (row 1)  p 1 p p q p b 1    a7=p c7=p d7=p e7=q f7=p g7=b
 *   rank 6 (row 2)  b n 2 p n p 1      a6=b b6=n e6=p f6=n g6=p
 *   rank 5 (row 3)  3 P N 3            d5=P e5=N
 *   rank 4 (row 4)  1 p 2 P 3          b4=p e4=P
 *   rank 3 (row 5)  2 N 2 Q 1 p        c3=N f3=Q h3=p
 *   rank 2 (row 6)  P P P B B P P P    a2=P b2=P c2=P d2=B e2=B f2=P g2=P h2=P
 *   rank 1 (row 7)  R 3 K 2 R          a1=R e1=K h1=R
 */

const P = PieceType;

/** An empty 8x8 grid we spot-place the Kiwipete pieces onto. */
function emptyGrid(): EngineSquare[][] {
  return Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => null as EngineSquare)
  );
}

const ZERO_COUNTS: PromotionCount = [0, 0, 0, 0, 0, 0, 0, 0];

function kiwipete(): GameState {
  const g = emptyGrid();

  // rank 8 (row 0): r3k2r
  g[0][0] = P.BlackQueenRook;
  g[0][4] = P.BlackKing;
  g[0][7] = P.BlackKingRook;

  // rank 7 (row 1): p1ppqpb1
  g[1][0] = P.BlackPawnA;
  g[1][2] = P.BlackPawnC;
  g[1][3] = P.BlackPawnD;
  g[1][4] = P.BlackQueen;
  g[1][5] = P.BlackPawnF;
  g[1][6] = P.BlackKingBishop;

  // rank 6 (row 2): bn2pnp1
  g[2][0] = P.BlackQueenBishop;
  g[2][1] = P.BlackQueenKnight;
  g[2][4] = P.BlackPawnE;
  g[2][5] = P.BlackKingKnight;
  g[2][6] = P.BlackPawnG;

  // rank 5 (row 3): 3PN3
  g[3][3] = P.WhitePawnD;
  g[3][4] = P.WhiteKingKnight;

  // rank 4 (row 4): 1p2P3
  g[4][1] = P.BlackPawnB;
  g[4][4] = P.WhitePawnE;

  // rank 3 (row 5): 2N2Q1p
  g[5][2] = P.WhiteQueenKnight;
  g[5][5] = P.WhiteQueen;
  g[5][7] = P.BlackPawnH;

  // rank 2 (row 6): PPPBBPPP
  g[6][0] = P.WhitePawnA;
  g[6][1] = P.WhitePawnB;
  g[6][2] = P.WhitePawnC;
  g[6][3] = P.WhiteQueenBishop;
  g[6][4] = P.WhiteKingBishop;
  g[6][5] = P.WhitePawnF;
  g[6][6] = P.WhitePawnG;
  g[6][7] = P.WhitePawnH;

  // rank 1 (row 7): R3K2R
  g[7][0] = P.WhiteQueenRook;
  g[7][4] = P.WhiteKing;
  g[7][7] = P.WhiteKingRook;

  return {
    squares: g,
    turn: "white",
    castling: {
      white: { kingSide: true, queenSide: true },
      black: { kingSide: true, queenSide: true },
    },
    enPassant: null,
    promotionCount: ZERO_COUNTS,
  };
}

describe("perft: Kiwipete tactical position", () => {
  const state = kiwipete();

  it("depth 1 = 48 (transcription tripwire)", () => {
    expect(perft(state, 1)).toBe(48);
  });

  it("depth 2 = 2039", () => {
    expect(perft(state, 2)).toBe(2039);
  });

  it("depth 3 = 97862", () => {
    expect(perft(state, 3)).toBe(97862);
  });
});
