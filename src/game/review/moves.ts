// Relative imports only, no React.
import { applyMove, Move } from "../engine/engine";
import type { GameState } from "../engine/game-state";
import { allLegalMoves, gameStatus } from "../engine/game-status";
import { isInCheck } from "../engine/moves/attack";
import { pieceKind, PieceKind } from "../engine/moves/classify";
import type { PromotionKind } from "../engine/moves/promotion";
import { moveToUci, positionKey, squareName, uciToMove } from "../opponent/position";

/**
 * Each ply's UCI move: the one legal move from `positions[i]` whose result has
 * `positions[i + 1]`'s `positionKey`. A gap throws a RangeError naming the ply.
 */
export function gameMoves(positions: readonly GameState[]): string[] {
  const out: string[] = [];
  for (let ply = 0; ply + 1 < positions.length; ply++) {
    const target = positionKey(positions[ply + 1]);
    const found = allLegalMoves(positions[ply]).find(
      (m) => positionKey(applyMove(positions[ply], m)) === target
    );
    if (found === undefined) {
      throw new RangeError(`no legal move from position ${ply} reaches position ${ply + 1} (ply ${ply})`);
    }
    out.push(moveToUci(found));
  }
  return out;
}

const PIECE_LETTER: Record<PieceKind, string> = {
  pawn: "",
  knight: "N",
  bishop: "B",
  rook: "R",
  queen: "Q",
  king: "K",
};

const PROMOTION_LETTER: Record<PromotionKind, string> = {
  queen: "Q",
  rook: "R",
  bishop: "B",
  knight: "N",
};

const sameSquare = (a: Move["to"], b: Move["to"]) => a[0] === b[0] && a[1] === b[1];

/** File, rank or both, so no other legal move of the same piece kind reads the same. */
function disambiguation(state: GameState, move: Move, kind: PieceKind): string {
  const rivals = allLegalMoves(state).filter((m) => {
    if (sameSquare(m.from, move.from) || !sameSquare(m.to, move.to)) return false;
    const piece = state.squares[m.from[0]][m.from[1]];
    return piece !== null && pieceKind(piece) === kind;
  });
  if (rivals.length === 0) return "";
  const from = squareName(move.from);
  if (rivals.every((m) => m.from[1] !== move.from[1])) return from[0];
  if (rivals.every((m) => m.from[0] !== move.from[0])) return from[1];
  return from;
}

/** SAN without the move number: `Nbd2`, `exf6`, `O-O`, `gxh8=Q+`, `Qh4#`. */
function san(state: GameState, move: Move): string {
  const piece = state.squares[move.from[0]][move.from[1]];
  if (piece === null) throw new RangeError("no piece on the from square");
  const kind = pieceKind(piece);
  const next = applyMove(state, move);
  const suffix =
    gameStatus(next) === "checkmate" ? "#" : isInCheck(next, next.turn) ? "+" : "";

  if (kind === "king" && Math.abs(move.to[1] - move.from[1]) === 2) {
    return (move.to[1] > move.from[1] ? "O-O" : "O-O-O") + suffix;
  }

  const to = squareName(move.to);
  // A pawn moving sideways captures, en passant included.
  const capture =
    state.squares[move.to[0]][move.to[1]] !== null ||
    (kind === "pawn" && move.from[1] !== move.to[1]);

  if (kind === "pawn") {
    const promotion = move.promotion ? `=${PROMOTION_LETTER[move.promotion]}` : "";
    const head = capture ? `${squareName(move.from)[0]}x` : "";
    return `${head}${to}${promotion}${suffix}`;
  }
  const extra = disambiguation(state, move, kind);
  return `${PIECE_LETTER[kind]}${extra}${capture ? "x" : ""}${to}${suffix}`;
}

/**
 * The review's label for ply `ply`: `"13.Nd5"` for White, `"13...Nc6"` for
 * Black (move number `floor(ply / 2) + 1`). Throws a RangeError on a move that
 * isn't legal in `state`.
 */
export function moveLabel(state: GameState, uci: string, ply: number): string {
  const move = uciToMove(state, uci);
  if (move === null) throw new RangeError(`${uci} is not legal at ply ${ply}`);
  const number = Math.floor(ply / 2) + 1;
  return `${number}${state.turn === "white" ? "." : "..."}${san(state, move)}`;
}
