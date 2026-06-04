import { PieceType } from "../../piece-type";
import { GameState, EngineSquare, PieceColor } from "../game-state";

/**
 * Shared move-generation geometry — the seam every Wave-2 piece generator and
 * the Wave-3 dispatcher imports. Everything here is pure: no `GameState`
 * mutation, no per-piece move logic, no king-safety/check filtering.
 *
 * ## Generator signature (PINNED — all four Wave-2 slices implement this)
 *
 *     type MoveGenerator = (state: GameState, from: Position) => Move[];
 *
 * Each per-piece generator (pawn, knight, bishop/rook/queen sliders, king)
 * takes the current `GameState` and the `from` square as a `Position` (`[y, x]`,
 * imported from `../engine`) and returns the pseudo-legal `Move[]` for the piece
 * standing there. It does NOT verify the piece kind/colour matches the side to
 * move and does NOT do check filtering — the dispatcher owns turn dispatch and
 * a later slice owns king safety. Generators decide stop/capture purely through
 * the helpers in this file (`inBounds`, `occupant`, `relationTo`) and consume
 * the direction/offset constants below; none should re-derive bounds or colour.
 */

/** The six abstract piece kinds, collapsing concrete + promoted `PieceType` ids. */
export type PieceKind =
  | "pawn"
  | "knight"
  | "bishop"
  | "rook"
  | "queen"
  | "king";

/** Mover-relative classification of a target square. */
export type Relation = "empty" | "friendly" | "enemy";

/**
 * Map a concrete `PieceType` id to its abstract kind, collapsing both the
 * starting pieces and the promoted ids.
 *
 * The `PieceType` string values are matched suffix-first to avoid the back-rank
 * ambiguity: `WHITE_QUEEN_ROOK` contains both `QUEEN` and `ROOK` but is a rook,
 * and `WHITE_KING_BISHOP` is a bishop. Promoted ids (`*_KNIGHT_PROMOTED_n`,
 * `*_BISHOP_PROMOTED_n`, `*_ROOK_PROMOTED_n`, `*_QUEEN_PROMOTED_n`) collapse to
 * their base kind; base pawns are `*_PAWN_A..H`.
 */
export function pieceKind(piece: PieceType): PieceKind {
  const id = piece as string;

  if (id.includes("PAWN")) return "pawn";
  if (id.includes("KNIGHT")) return "knight";
  if (id.includes("BISHOP")) return "bishop";
  if (id.includes("ROOK")) return "rook";
  // After ruling out the above, anything containing QUEEN is a queen (the
  // back-rank `*_QUEEN_ROOK`/`*_QUEEN_KNIGHT`/`*_QUEEN_BISHOP` ids were already
  // caught by their trailing kind word).
  if (id.includes("QUEEN")) return "queen";
  return "king";
}

/**
 * The colour of a piece, read from the `WHITE_`/`BLACK_` id prefix. Mirrors the
 * semantics the tracer engine used; exported here so generators and the
 * dispatcher share one definition instead of redeclaring it.
 */
export function colorOf(piece: PieceType): PieceColor {
  return (piece as string).startsWith("WHITE_") ? "white" : "black";
}

/**
 * The canonical on-board predicate: `y` and `x` must EACH lie in `[0, 8)`.
 *
 * Exists so every generator checks both axes through this one function. The old
 * engine carried an off-by-axis bug — the x-axis bound was written as `toY < 8`
 * instead of `toX < 8`, letting moves run off the right edge. Routing all bounds
 * checks here makes that class of bug impossible to reproduce; the test suite
 * pins both `inBounds(0, 8) === false` and `inBounds(8, 0) === false`.
 */
export function inBounds(y: number, x: number): boolean {
  return y >= 0 && y < 8 && x >= 0 && x < 8;
}

/**
 * The piece on `[y, x]`, or `null` when the square is empty OR off the board.
 * Generators can call this with a candidate destination without a separate
 * bounds guard, but should still gate movement on {@link inBounds} where the
 * empty-vs-off-board distinction matters (e.g. ray continuation).
 */
export function occupant(
  state: GameState,
  y: number,
  x: number
): EngineSquare {
  if (!inBounds(y, x)) return null;
  return state.squares[y][x];
}

/**
 * Classify a target square relative to the moving side, so each generator
 * decides stop/capture uniformly: an `empty` square is a quiet destination, a
 * `friendly` piece blocks, an `enemy` piece is a capture (and, for sliders,
 * stops the ray after capture).
 */
export function relationTo(mover: PieceColor, target: EngineSquare): Relation {
  if (target === null) return "empty";
  return colorOf(target) === mover ? "friendly" : "enemy";
}

/** Diagonal rays for bishops (and the diagonal half of the queen). */
export const BISHOP_DIRS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
] as const;

/** Orthogonal rays for rooks (and the orthogonal half of the queen). */
export const ROOK_DIRS: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;

/** Queen rays = bishop ∪ rook (eight rays, no duplicates). */
export const QUEEN_DIRS: readonly (readonly [number, number])[] = [
  ...BISHOP_DIRS,
  ...ROOK_DIRS,
] as const;

/** The eight knight L-shaped offsets. */
export const KNIGHT_OFFSETS: readonly (readonly [number, number])[] = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
] as const;

/** The eight single-step king offsets (all neighbours, excluding the zero vector). */
export const KING_OFFSETS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
] as const;
