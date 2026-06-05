import { GameState, PieceColor } from "../game-state";
import { Position } from "../engine";
import {
  pieceKind,
  colorOf,
  inBounds,
  BISHOP_DIRS,
  ROOK_DIRS,
  KNIGHT_OFFSETS,
  KING_OFFSETS,
} from "./classify";

/**
 * ATTACK semantics for the pure engine — distinct from MOVE semantics.
 *
 * "Attacked" means a piece's capture geometry covers a square, independent of
 * whose turn it is and independent of king safety. These helpers underpin
 * check detection and (next slices) legal-move filtering, castling-through-check
 * and game-status.
 *
 * ## Why this does NOT call `legalMoves`
 *
 * `legalMoves` is about to become turn-gated and check-filtered. Deriving
 * attacks from it would (a) be circular once check filtering itself asks "is
 * the king attacked?", and (b) be wrong — `legalMoves` answers only for the
 * side to move and a pawn's push is a move but NOT an attack. So attacks are
 * computed directly from board geometry using the `classify` helpers/constants.
 *
 * ## Approach: scan OUTWARD from the target
 *
 * Rather than enumerating every `by`-coloured piece, we look outward from the
 * target square along each attack geometry and ask whether an attacker of the
 * matching kind + colour sits there:
 * - the eight knight offsets → a `by` knight,
 * - the eight king offsets → a `by` king,
 * - the diagonal rays → a `by` bishop or queen (first piece met on the ray),
 * - the orthogonal rays → a `by` rook or queen (first piece met on the ray),
 * - the two squares from which a `by` pawn's forward diagonal would land on the
 *   target → a `by` pawn.
 *
 * This is O(1)-ish per call (fixed directions, board-bounded rays) and keeps the
 * pawn-direction reasoning in exactly one place.
 */

/** Read the piece at `[y, x]`, or `null` off-board / empty. */
function pieceAt(state: GameState, y: number, x: number) {
  if (!inBounds(y, x)) return null;
  return state.squares[y][x];
}

/** True iff a `by`-coloured piece of `kind` sits at `[y, x]`. */
function hasAttacker(
  state: GameState,
  y: number,
  x: number,
  by: PieceColor,
  kind: ReturnType<typeof pieceKind>
): boolean {
  const piece = pieceAt(state, y, x);
  if (piece === null) return false;
  return colorOf(piece) === by && pieceKind(piece) === kind;
}

/**
 * True iff any piece of colour `by` attacks `target`. Turn-independent: the
 * `state.turn` field is never consulted.
 */
export function isSquareAttacked(
  state: GameState,
  target: Position,
  by: PieceColor
): boolean {
  const [ty, tx] = target;

  // Knights.
  for (const [dy, dx] of KNIGHT_OFFSETS) {
    if (hasAttacker(state, ty + dy, tx + dx, by, "knight")) return true;
  }

  // Kings (the eight neighbours).
  for (const [dy, dx] of KING_OFFSETS) {
    if (hasAttacker(state, ty + dy, tx + dx, by, "king")) return true;
  }

  // Diagonal sliders: bishop or queen, first piece met on each diagonal ray.
  if (slidingAttack(state, target, by, BISHOP_DIRS, "bishop")) return true;
  // Orthogonal sliders: rook or queen, first piece met on each orthogonal ray.
  if (slidingAttack(state, target, by, ROOK_DIRS, "rook")) return true;

  // Pawns: a `by` pawn attacks its two FORWARD diagonals only.
  //   White attacks toward row 0 (from y+1 down onto y), so a white pawn that
  //   attacks `target` sits at [ty+1, tx±1].
  //   Black attacks toward row 7 (from y-1 up onto y), so a black pawn that
  //   attacks `target` sits at [ty-1, tx±1].
  const pawnRow = by === "white" ? ty + 1 : ty - 1;
  if (hasAttacker(state, pawnRow, tx - 1, by, "pawn")) return true;
  if (hasAttacker(state, pawnRow, tx + 1, by, "pawn")) return true;

  return false;
}

/**
 * Walk each ray from `target`; the first occupied square ends the ray. If that
 * blocker is a `by`-coloured slider matching `kind` (or a queen, which covers
 * both diagonal and orthogonal rays), `target` is attacked along that ray.
 */
function slidingAttack(
  state: GameState,
  target: Position,
  by: PieceColor,
  dirs: readonly (readonly [number, number])[],
  kind: "bishop" | "rook"
): boolean {
  const [ty, tx] = target;
  for (const [dy, dx] of dirs) {
    let y = ty + dy;
    let x = tx + dx;
    while (inBounds(y, x)) {
      const piece = state.squares[y][x];
      if (piece !== null) {
        if (colorOf(piece) === by) {
          const k = pieceKind(piece);
          if (k === kind || k === "queen") return true;
        }
        break; // first piece on the ray blocks everything beyond it
      }
      y += dy;
      x += dx;
    }
  }
  return false;
}

/**
 * Locate the `color` king, or `null` when absent (defensive: test positions and
 * partial boards may omit a king).
 */
export function findKing(
  state: GameState,
  color: PieceColor
): Position | null {
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const piece = state.squares[y][x];
      if (
        piece !== null &&
        pieceKind(piece) === "king" &&
        colorOf(piece) === color
      ) {
        return [y, x];
      }
    }
  }
  return null;
}

/** The opposing colour. */
function opponentOf(color: PieceColor): PieceColor {
  return color === "white" ? "black" : "white";
}

/**
 * True iff `color`'s king exists AND is attacked by the opposing colour. Returns
 * `false` (never throws) when `color` has no king on the board.
 */
export function isInCheck(state: GameState, color: PieceColor): boolean {
  const king = findKing(state, color);
  if (king === null) return false;
  return isSquareAttacked(state, king, opponentOf(color));
}
