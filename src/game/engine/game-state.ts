import { PieceType } from "../piece-type";

/**
 * The pure engine's view of a board square: a piece identity or empty.
 *
 * Deliberately presentation-free — unlike the old `Square`
 * (`{ pieceType, isEnemyAttacked }`), the engine grid carries no UI flags.
 * The `isEnemyAttacked` highlighting stays in the reducer/adapter layer.
 *
 * Piece identity reuses the existing {@link PieceType} enum. The
 * `{ kind, color }` redesign is explicitly quarantined (see docs/decisions.md).
 */
export type EngineSquare = PieceType | null;

/** Side to move / piece colour. Replaces the old `isWhiteTurn` boolean. */
export type PieceColor = "white" | "black";

/** Castle availability for one side. */
export interface CastlingSide {
  readonly kingSide: boolean;
  readonly queenSide: boolean;
}

/** Castling rights for both sides. */
export interface CastlingRights {
  readonly white: CastlingSide;
  readonly black: CastlingSide;
}

/**
 * En-passant target square as `[y, x]` (0-indexed, row 0 = Black's back rank),
 * mirroring the engine's `Position` tuple convention, or `null` when no pawn
 * may be captured en passant.
 */
export type EnPassantTarget = readonly [number, number] | null;

/**
 * Per-type promotion counters, quarantining the old singleton's
 * `promotionBoardCount`. Eight slots, indexed to match `PromotionBoard`:
 * `[WhiteQueen, WhiteRook, WhiteBishop, WhiteKnight,
 *   BlackQueen, BlackRook, BlackBishop, BlackKnight]`.
 *
 * Each entry counts how many of that promoted type have been handed out, so the
 * next unique promoted `PieceType` id can be allocated deterministically.
 */
export type PromotionCount = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number
];

/**
 * The immutable value the entire pure engine threads through.
 *
 * All sub-structures are `readonly`; transitions (the `tracer` slice's
 * `applyMove`) must produce a fresh `GameState` rather than mutating in place.
 */
export interface GameState {
  /** 8×8 grid, `squares[y][x]`. Row 0 is Black's back rank, row 7 White's. */
  readonly squares: ReadonlyArray<ReadonlyArray<EngineSquare>>;
  /** Side to move. */
  readonly turn: PieceColor;
  /** King-/queen-side castling rights for both sides. */
  readonly castling: CastlingRights;
  /** En-passant target square, or `null`. */
  readonly enPassant: EnPassantTarget;
  /** Quarantined promotion-id counter. */
  readonly promotionCount: PromotionCount;
}

const B = PieceType;

/**
 * Pure factory for the standard chess starting position: White to move, full
 * castling rights, no en-passant target, zeroed promotion counts.
 *
 * Returns a fresh, fully non-aliased value on every call — no shared mutable
 * reference, so `reset` is correct by construction.
 */
export function initialGameState(): GameState {
  const squares: EngineSquare[][] = [
    // Row 0 — Black back rank
    [
      B.BlackQueenRook,
      B.BlackQueenKnight,
      B.BlackQueenBishop,
      B.BlackQueen,
      B.BlackKing,
      B.BlackKingBishop,
      B.BlackKingKnight,
      B.BlackKingRook,
    ],
    // Row 1 — Black pawns
    [
      B.BlackPawnA,
      B.BlackPawnB,
      B.BlackPawnC,
      B.BlackPawnD,
      B.BlackPawnE,
      B.BlackPawnF,
      B.BlackPawnG,
      B.BlackPawnH,
    ],
    // Rows 2–5 — empty
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    // Row 6 — White pawns
    [
      B.WhitePawnA,
      B.WhitePawnB,
      B.WhitePawnC,
      B.WhitePawnD,
      B.WhitePawnE,
      B.WhitePawnF,
      B.WhitePawnG,
      B.WhitePawnH,
    ],
    // Row 7 — White back rank
    [
      B.WhiteQueenRook,
      B.WhiteQueenKnight,
      B.WhiteQueenBishop,
      B.WhiteQueen,
      B.WhiteKing,
      B.WhiteKingBishop,
      B.WhiteKingKnight,
      B.WhiteKingRook,
    ],
  ];

  return {
    squares,
    turn: "white",
    castling: {
      white: { kingSide: true, queenSide: true },
      black: { kingSide: true, queenSide: true },
    },
    enPassant: null,
    promotionCount: [0, 0, 0, 0, 0, 0, 0, 0],
  };
}
