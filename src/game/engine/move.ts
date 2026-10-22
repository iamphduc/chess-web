import { PromotionKind } from "./moves/promotion";

/**
 * A board position as `[y, x]` (0-indexed), matching the `GameState` grid:
 * `squares[y][x]`, row 0 is Black's back rank, row 7 White's.
 */
export type Position = readonly [number, number];

/**
 * A move from one square to another.
 *
 * Quiet moves, captures, castling and en passant are fully described by their
 * endpoints — `applyMove` (`engine.ts`) infers castling and en passant from
 * geometry, so they carry no marker fields. The only extra datum is
 * {@link promotion}: when set, the pawn on `from` reaches `to` and becomes that
 * kind. It is `undefined` for every non-promotion move.
 *
 * Declared here, not in `engine.ts`, so the per-piece generators in `moves/`
 * can name it without importing the engine that imports them.
 */
export interface Move {
  readonly from: Position;
  readonly to: Position;
  /**
   * Set only for a pawn promotion: the kind the pawn becomes on reaching `to`
   * (queen / rook / bishop / knight). `undefined` for all other moves.
   */
  readonly promotion?: PromotionKind;
}
