// Relative imports only: the Node scripts (run with tsx) may load this file.
import { applyMove, Move } from "../engine/engine";
import { GameState } from "../engine/game-state";
import { allLegalMoves } from "../engine/game-status";
import { pieceKind, PieceKind } from "../engine/moves/classify";

/** Piece values in pawns. A king is never captured, so its value is unused. */
const VALUE: Record<PieceKind, number> = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
  king: 0,
};

/** A move "hangs material" when the opponent's best capture nets this much. */
const HANG_THRESHOLD = 2;

/** Value of the piece standing on `[y, x]`, or 0 when it is empty. */
function valueAt(state: GameState, [y, x]: readonly [number, number]): number {
  const piece = state.squares[y][x];
  return piece === null ? 0 : VALUE[pieceKind(piece)];
}

/**
 * What `move` takes: the piece on its target square, or the pawn beside it
 * for an en-passant capture (a pawn moving sideways onto an empty square).
 */
function capturedValue(state: GameState, move: Move): number {
  const onTarget = valueAt(state, move.to);
  if (onTarget > 0) return onTarget;
  const [fromY, fromX] = move.from;
  const mover = state.squares[fromY][fromX];
  const isEnPassant =
    mover !== null && pieceKind(mover) === "pawn" && move.to[1] !== fromX;
  return isEnPassant ? VALUE.pawn : 0;
}

/** Material `move` itself wins: what it captures, plus a promotion's gain. */
function moveGain(state: GameState, move: Move): number {
  const promotion = move.promotion === undefined ? 0 : VALUE[move.promotion] - VALUE.pawn;
  return capturedValue(state, move) + promotion;
}

/**
 * Whether `move` leaves material for the opponent to take for nothing, one
 * exchange deep. After `move`, each legal capture by the other side gains the
 * captured value, less the capturer's value when the mover then has a legal
 * capture back on that square. The move hangs material when the biggest such
 * gain, less what `move` itself won, is 2 or more: a lone pawn is allowed, a
 * piece for nothing or a rook for a minor piece is not.
 */
export function hangsMaterial(state: GameState, move: Move): boolean {
  const after = applyMove(state, move);
  let biggest = 0;
  for (const reply of allLegalMoves(after)) {
    const taken = capturedValue(after, reply);
    if (taken === 0) continue;
    const afterReply = applyMove(after, reply);
    const [toY, toX] = reply.to;
    const canTakeBack = allLegalMoves(afterReply).some(
      (m) => m.to[0] === toY && m.to[1] === toX
    );
    const gain = canTakeBack ? taken - valueAt(afterReply, reply.to) : taken;
    biggest = Math.max(biggest, gain);
  }
  return biggest - moveGain(state, move) >= HANG_THRESHOLD;
}
