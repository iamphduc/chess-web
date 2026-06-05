import { Move, Position } from "../engine";
import { GameState, PieceColor } from "../game-state";
import {
  colorOf,
  inBounds,
  occupant,
  pieceKind,
  relationTo,
  KING_OFFSETS,
} from "./classify";
import { isSquareAttacked } from "./attack";

/**
 * Pseudo-legal king moves from `from`: the eight single steps PLUS any
 * available castle.
 *
 * For each of the eight `KING_OFFSETS`, the target square is included when:
 *   - it lies on the board (`inBounds`), AND
 *   - it is not occupied by a friendly piece (`relationTo` !== "friendly").
 *
 * An enemy-occupied square is included as a capture.
 *
 * Castling is appended by {@link castlingMoves} as a plain two-file king `Move`
 * (`to = [r,6]` king-side, `[r,2]` queen-side); `applyMove` infers the rook
 * relocation from that geometry, so no marker field is emitted.
 *
 * Check / king-safety filtering of the SINGLE steps is still out of scope (the
 * `legalMoves` filter owns it); castling, however, must be gated here because
 * the king's TRANSIT square has no representation in a single end-position
 * self-check — see {@link castlingMoves}.
 *
 * Implements the pinned generator signature from `classify.ts`:
 *   `(state: GameState, from: Position) => Move[]`
 */
export function kingMoves(state: GameState, from: Position): Move[] {
  const [y, x] = from;
  const piece = state.squares[y][x];
  if (piece === null) return [];

  const moverColor = colorOf(piece);
  const moves: Move[] = [];

  for (const [dy, dx] of KING_OFFSETS) {
    const ty = y + dy;
    const tx = x + dx;

    if (!inBounds(ty, tx)) continue;

    const target = occupant(state, ty, tx);
    if (relationTo(moverColor, target) === "friendly") continue;

    moves.push({ from, to: [ty, tx] });
  }

  moves.push(...castlingMoves(state, from, moverColor));

  return moves;
}

/** The opposing colour. */
function opponentOf(color: PieceColor): PieceColor {
  return color === "white" ? "black" : "white";
}

/**
 * True iff the piece on `[y, x]` is a rook of colour `by`. Defensive: a missing
 * or wrong-kind corner piece means the rights flag is stale, so no castle is
 * synthesised.
 */
function isOwnRook(
  state: GameState,
  y: number,
  x: number,
  by: PieceColor
): boolean {
  const piece = occupant(state, y, x);
  if (piece === null) return false;
  return colorOf(piece) === by && pieceKind(piece) === "rook";
}

/**
 * Castle moves for the king on `from`, emitted as plain two-file king `Move`s.
 *
 * A castle is generated for a side's right only when ALL hold (home rank
 * `r` = white `7`, black `0`; the king must be on its home square `[r,4]`):
 *   - the matching `kingSide`/`queenSide` right in `state.castling` is `true`;
 *   - the mover's rook still sits in the corner (`[r,7]` king-side, `[r,0]`
 *     queen-side) — a defensive guard against a stale rights flag;
 *   - every square BETWEEN king and rook is empty — king-side `[r,5]`,`[r,6]`;
 *     queen-side `[r,1]`,`[r,2]`,`[r,3]` (the b-file `[r,1]` must be empty but is
 *     NOT a king-transit square, so it is not check-gated);
 *   - the king is not currently in check, does not pass THROUGH an attacked
 *     square, and does not LAND on an attacked square. The three gated squares
 *     are the king's origin `[r,4]`, the transit, and the destination:
 *     king-side `[r,5]`/`[r,6]`, queen-side `[r,3]`/`[r,2]`. The rook's square
 *     and the queen-side b-file are deliberately NOT check-gated.
 *
 * The king's-square attack check lives HERE (not in `legalMoves`) because the
 * single end-position self-check filter cannot see the transit square the king
 * merely passes over.
 */
function castlingMoves(
  state: GameState,
  from: Position,
  moverColor: PieceColor
): Move[] {
  const [y, x] = from;
  const r = moverColor === "white" ? 7 : 0;

  // The king must be on its home square for either castle.
  if (y !== r || x !== 4) return [];

  // A king currently in check may not castle on either side.
  const enemy = opponentOf(moverColor);
  if (isSquareAttacked(state, [r, 4], enemy)) return [];

  const rights = state.castling[moverColor];
  const moves: Move[] = [];

  // King-side: rook on [r,7]; [r,5] and [r,6] empty; king crosses [r,5]→[r,6].
  if (
    rights.kingSide &&
    isOwnRook(state, r, 7, moverColor) &&
    state.squares[r][5] === null &&
    state.squares[r][6] === null &&
    !isSquareAttacked(state, [r, 5], enemy) &&
    !isSquareAttacked(state, [r, 6], enemy)
  ) {
    moves.push({ from, to: [r, 6] });
  }

  // Queen-side: rook on [r,0]; [r,1],[r,2],[r,3] empty; king crosses [r,3]→[r,2].
  // The b-file [r,1] must be empty but is NOT check-gated.
  if (
    rights.queenSide &&
    isOwnRook(state, r, 0, moverColor) &&
    state.squares[r][1] === null &&
    state.squares[r][2] === null &&
    state.squares[r][3] === null &&
    !isSquareAttacked(state, [r, 3], enemy) &&
    !isSquareAttacked(state, [r, 2], enemy)
  ) {
    moves.push({ from, to: [r, 2] });
  }

  return moves;
}
