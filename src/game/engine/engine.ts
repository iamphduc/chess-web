import { CastlingRights, GameState, PieceColor } from "./game-state";
import { colorOf, inBounds, pieceKind, PieceKind } from "./moves/classify";
import { slidingMoves } from "./moves/sliding";
import { knightMoves } from "./moves/knight";
import { kingMoves } from "./moves/king";
import { pawnMoves } from "./moves/pawn";
import { isInCheck } from "./moves/attack";
import { allocatePromotedId, PromotionKind } from "./moves/promotion";

/**
 * A board position as `[y, x]` (0-indexed), matching the `GameState` grid:
 * `squares[y][x]`, row 0 is Black's back rank, row 7 White's.
 */
export type Position = readonly [number, number];

/**
 * A move from one square to another.
 *
 * Quiet moves, captures, castling and en passant are fully described by their
 * endpoints — {@link applyMove} infers castling and en passant from geometry, so
 * they carry no marker fields. The only extra datum is {@link promotion}: when
 * set, the pawn on `from` reaches `to` and becomes that kind. It is `undefined`
 * for every non-promotion move.
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

/**
 * Pseudo-legal destinations for the piece on `from`, given whose turn it is.
 *
 * Validates the `from` square, then classifies the piece with {@link pieceKind}
 * and delegates to the matching pseudo-legal generator:
 * - bishop / rook / queen → {@link slidingMoves}
 * - knight → {@link knightMoves}
 * - king → {@link kingMoves} (single-step only; castling is `special-moves`)
 * - pawn → {@link pawnMoves} (no en-passant/promotion; those are `special-moves`)
 *
 * Returns `[]` when `from` is off the board, empty, or holds a piece whose
 * colour does not match `state.turn` (moving out of turn).
 *
 * The output is PSEUDO-LEGAL: it does NOT filter moves that would leave (or
 * expose) the mover's own king in check — {@link legalMoves} layers that
 * king-safety filter on top. Private to this module so the filter can never be
 * re-entrant.
 */
function pseudoLegalMoves(state: GameState, from: Position): Move[] {
  const [y, x] = from;
  if (!inBounds(y, x)) return [];

  const piece = state.squares[y][x];
  if (piece === null) return [];
  if (colorOf(piece) !== state.turn) return [];

  switch (pieceKind(piece)) {
    case "bishop":
    case "rook":
    case "queen":
      return slidingMoves(state, from);
    case "knight":
      return knightMoves(state, from);
    case "king":
      return kingMoves(state, from);
    case "pawn":
      return pawnMoves(state, from);
  }
}

/**
 * LEGAL destinations for the piece on `from`: the pseudo-legal moves of
 * {@link pseudoLegalMoves} minus any that would leave the MOVER's own king in
 * check.
 *
 * For each pseudo-legal `Move m`, we capture the mover's colour, apply `m` with
 * {@link applyMove}, and keep `m` iff the mover's king is NOT in check in the
 * resulting position. Note the subtlety: we test the mover's king, not
 * `applied.turn` — `applyMove` has already flipped the turn to the opponent.
 *
 * This single rule subsumes all three king-safety cases: a pinned piece may not
 * leave its pin line, a side in check must resolve it (capture the checker,
 * block the ray, or move the king), and the king may not step into an attacked
 * square (including capturing a defended piece).
 *
 * The end-position self-check filter below redundantly catches "castle into
 * check" and "still in check after castling", but the king's TRANSIT-square
 * check (it may not pass THROUGH an attacked square) lives in `king.ts`, which
 * gates whether a castle move is generated at all; en-passant move generation
 * lives in `pawn.ts`. `applyMove` handles captures by overwriting the
 * destination, so capture-resolves-check works here.
 */
export function legalMoves(state: GameState, from: Position): Move[] {
  const [y, x] = from;
  const piece = inBounds(y, x) ? state.squares[y][x] : null;
  // `pseudoLegalMoves` already guards off-board / empty / out-of-turn, but we
  // need the mover's colour for the filter; an empty/off-board `from` yields no
  // pseudo-legal moves, so the loop below is a no-op and `[]` filters to `[]`.
  const mover = piece === null ? state.turn : colorOf(piece);

  return pseudoLegalMoves(state, from).filter((move) => {
    const applied = applyMove(state, move);
    return !isInCheck(applied, mover);
  });
}

/**
 * Apply a move, returning a NEW `GameState` with the board updated and the turn
 * flipped. The input `state` is never mutated — a fresh grid and fresh
 * `castling` object are built.
 *
 * Beyond relocating the mover, special moves are inferred by GEOMETRY (no marker
 * fields on `Move`):
 * - **Castling** — a king moving two files (`|toX - fromX| === 2`): the rook is
 *   relocated too (king-side `[fromY,7]→[fromY,5]`, queen-side `[fromY,0]→[fromY,3]`).
 * - **En passant** — a pawn moving diagonally (`toX !== fromX`) onto an EMPTY
 *   square: the captured enemy pawn at `[fromY, toX]` is removed.
 * - **Promotion** — driven by `move.promotion`: the landing piece is the id from
 *   {@link allocatePromotedId}, and `promotionCount` advances. (Last-rank
 *   geometry is the generator's responsibility; this trusts `move.promotion`.)
 *
 * Bookkeeping: `enPassant` becomes the skipped square on a pawn double-push and
 * `null` otherwise; castling rights are cleared when the king moves, when a rook
 * leaves its starting corner, and when a rook is captured on its starting corner.
 */
export function applyMove(state: GameState, move: Move): GameState {
  const [fromY, fromX] = move.from;
  const [toY, toX] = move.to;

  const piece = state.squares[fromY][fromX];
  const kind = piece === null ? null : pieceKind(piece);
  const mover = state.turn;

  const isCastle = kind === "king" && Math.abs(toX - fromX) === 2;
  const isEnPassant =
    kind === "pawn" && toX !== fromX && state.squares[toY][toX] === null;
  const isDoublePush = kind === "pawn" && Math.abs(toY - fromY) === 2;

  // The id that lands on `to`: a freshly-allocated promoted id, or the mover.
  let landed = piece;
  let promotionCount = state.promotionCount;
  if (piece !== null && move.promotion !== undefined) {
    const alloc = allocatePromotedId(
      mover,
      move.promotion,
      state.promotionCount
    );
    landed = alloc.id;
    promotionCount = alloc.nextCounts;
  }

  // Rook relocation for a castle.
  const rookFromX = isCastle ? (toX === 6 ? 7 : 0) : -1;
  const rookToX = isCastle ? (toX === 6 ? 5 : 3) : -1;
  const castlingRook = isCastle ? state.squares[fromY][rookFromX] : null;

  const squares = state.squares.map((row, y) =>
    row.map((square, x) => {
      // Vacate the origin.
      if (y === fromY && x === fromX) return null;
      // Place the (possibly promoted) mover on the destination.
      if (y === toY && x === toX) return landed;
      // Castling: relocate the rook.
      if (isCastle && y === fromY && x === rookFromX) return null;
      if (isCastle && y === fromY && x === rookToX) return castlingRook;
      // En passant: remove the captured pawn sitting beside the destination.
      if (isEnPassant && y === fromY && x === toX) return null;
      return square;
    })
  );

  return {
    ...state,
    squares,
    turn: mover === "white" ? "black" : "white",
    castling: nextCastling(state.castling, mover, kind, move),
    enPassant: isDoublePush ? [(fromY + toY) / 2, fromX] : null,
    promotionCount,
  };
}

/**
 * Compute fresh castling rights after a move by `mover` of a piece of `kind`.
 * A new {@link CastlingRights} object (with fresh sub-objects) is always
 * returned — the input is never aliased.
 *
 * Rights are revoked when: the king moves (both of the mover's rights — this
 * also covers castling, since a castle IS a king move); a rook leaves one of the
 * four starting corners (that side's matching right); or a piece lands on a
 * starting corner, capturing whatever rook stood there (the captured side's
 * matching right).
 */
function nextCastling(
  rights: CastlingRights,
  mover: PieceColor,
  kind: PieceKind | null,
  move: Move
): CastlingRights {
  const [fromY, fromX] = move.from;
  const [toY, toX] = move.to;

  const next = {
    white: { kingSide: rights.white.kingSide, queenSide: rights.white.queenSide },
    black: { kingSide: rights.black.kingSide, queenSide: rights.black.queenSide },
  };

  // King move (incl. castling): the mover forfeits both of its rights.
  if (kind === "king") {
    next[mover].kingSide = false;
    next[mover].queenSide = false;
  }

  // Corner → (side, right) revocations, applied to the move's ORIGIN (a rook
  // leaving its corner) and DESTINATION (a rook captured on its corner).
  const revokeCorner = (y: number, x: number) => {
    if (y === 7 && x === 0) next.white.queenSide = false;
    else if (y === 7 && x === 7) next.white.kingSide = false;
    else if (y === 0 && x === 0) next.black.queenSide = false;
    else if (y === 0 && x === 7) next.black.kingSide = false;
  };
  revokeCorner(fromY, fromX);
  revokeCorner(toY, toX);

  return next;
}
