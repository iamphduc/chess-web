import { GameState } from "../game-state";
import { Move, Position } from "../engine";
import {
  pieceKind,
  colorOf,
  inBounds,
  occupant,
  relationTo,
  BISHOP_DIRS,
  ROOK_DIRS,
  QUEEN_DIRS,
} from "./classify";

/**
 * Pseudo-legal move generator for the sliding pieces: bishop, rook and queen.
 *
 * Implements the pinned `MoveGenerator` signature from {@link classify}:
 * `(state, from) => Move[]`. The piece kind is read with {@link pieceKind} so
 * promoted rooks/bishops/queens slide correctly; any non-slider (or an empty
 * `from`) yields no moves.
 *
 * Each direction from the piece's `*_DIRS` set is walked square by square:
 * - an empty square is a quiet destination and the ray continues;
 * - an enemy piece is a capture destination and then the ray stops;
 * - a friendly piece stops the ray and is NOT a destination;
 * - stepping off the board (`inBounds` false) stops the ray with no emission.
 *
 * These are pseudo-legal moves only — no king-safety / check filtering (that
 * belongs to the king-safety-endgame sprint).
 */
export function slidingMoves(state: GameState, from: Position): Move[] {
  const [y, x] = from;
  if (!inBounds(y, x)) return [];

  const piece = state.squares[y][x];
  if (piece === null) return [];

  const dirs = directionsFor(piece);
  if (dirs === null) return [];

  const mover = colorOf(piece);
  const moves: Move[] = [];

  for (const [dy, dx] of dirs) {
    let ty = y + dy;
    let tx = x + dx;

    while (inBounds(ty, tx)) {
      const relation = relationTo(mover, occupant(state, ty, tx));

      if (relation === "friendly") break;

      moves.push({ from, to: [ty, tx] });

      // An enemy capture ends the ray after the capture square is emitted.
      if (relation === "enemy") break;

      ty += dy;
      tx += dx;
    }
  }

  return moves;
}

/** The ray set for a sliding piece, or `null` when the piece does not slide. */
function directionsFor(
  piece: GameState["squares"][number][number]
): readonly (readonly [number, number])[] | null {
  if (piece === null) return null;
  switch (pieceKind(piece)) {
    case "bishop":
      return BISHOP_DIRS;
    case "rook":
      return ROOK_DIRS;
    case "queen":
      return QUEEN_DIRS;
    default:
      return null;
  }
}
