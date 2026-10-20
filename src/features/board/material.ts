import { GameState, PieceColor } from "game/engine/game-state";
import { colorOf, PieceKind, pieceKind } from "game/engine/moves/classify";

/** A piece that can be taken: any kind but the king. */
export type CapturedKind = Exclude<PieceKind, "king">;

/** What a player card shows beside the name: the pieces taken and the lead in points. */
export interface MaterialLine {
  /** The other side's pieces missing from the board, highest value first. */
  captured: CapturedKind[];
  /** This side's piece value less the other side's, or 0 when this side isn't ahead. */
  advantage: number;
}

/** Highest value first: the order `captured` is listed in. */
const KINDS: readonly CapturedKind[] = ["queen", "rook", "bishop", "knight", "pawn"];

const VALUE: Record<CapturedKind, number> = { queen: 9, rook: 5, bishop: 3, knight: 3, pawn: 1 };

const START: Record<CapturedKind, number> = { queen: 1, rook: 2, bishop: 2, knight: 2, pawn: 8 };

/** Slot order of each side's four `promotionCount` entries. */
const PROMOTION_SLOTS = ["queen", "rook", "bishop", "knight"] as const;

type Counts = Record<CapturedKind, number>;

const zero = (): Counts => ({ queen: 0, rook: 0, bishop: 0, knight: 0, pawn: 0 });

/** How many of each kind `color` has on the board. A promoted piece counts as its new kind. */
function onBoard(state: GameState, color: PieceColor): Counts {
  const counts = zero();
  for (const row of state.squares) {
    for (const piece of row) {
      if (piece === null || colorOf(piece) !== color) continue;
      const kind = pieceKind(piece);
      if (kind !== "king") counts[kind] += 1;
    }
  }
  return counts;
}

/**
 * How many of each kind `color` has lost. A pawn that promoted isn't lost: it became
 * its new kind, which counts as lost only if it was taken in turn.
 */
function lost(state: GameState, color: PieceColor): Counts {
  const offset = color === "white" ? 0 : 4;
  const promoted = zero();
  PROMOTION_SLOTS.forEach((kind, i) => {
    promoted[kind] = state.promotionCount[offset + i];
  });
  const promotions = PROMOTION_SLOTS.reduce((n, kind) => n + promoted[kind], 0);
  const now = onBoard(state, color);
  const out = zero();
  for (const kind of KINDS) {
    const had = kind === "pawn" ? START.pawn - promotions : START[kind] + promoted[kind];
    out[kind] = Math.max(0, had - now[kind]);
  }
  return out;
}

const worth = (counts: Counts) => KINDS.reduce((sum, kind) => sum + counts[kind] * VALUE[kind], 0);

/** The material line for `color`'s card, read from the board alone. */
export function materialLine(state: GameState, color: PieceColor): MaterialLine {
  const other: PieceColor = color === "white" ? "black" : "white";
  const taken = lost(state, other);
  const captured = KINDS.flatMap((kind) => Array<CapturedKind>(taken[kind]).fill(kind));
  const lead = worth(onBoard(state, color)) - worth(onBoard(state, other));
  return { captured, advantage: Math.max(0, lead) };
}
