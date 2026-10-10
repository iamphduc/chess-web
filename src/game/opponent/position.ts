// Relative imports only: the Node import script (run with tsx) loads this file.
import { legalMoves, Move, Position } from "../engine/engine";
import { GameState } from "../engine/game-state";
import { colorOf, pieceKind, PieceKind } from "../engine/moves/classify";
import { PromotionKind } from "../engine/moves/promotion";

const FILES = "abcdefgh";

const PROMOTION_LETTER: Record<PromotionKind, string> = {
  queen: "q",
  rook: "r",
  bishop: "b",
  knight: "n",
};

const LETTER_PROMOTION: Record<string, PromotionKind> = {
  q: "queen",
  r: "rook",
  b: "bishop",
  n: "knight",
};

const FEN_LETTER: Record<PieceKind, string> = {
  pawn: "p",
  knight: "n",
  bishop: "b",
  rook: "r",
  queen: "q",
  king: "k",
};

const UCI_PATTERN = /^([a-h])([1-8])([a-h])([1-8])([qrbn]?)$/;

/** Square name of a `[y, x]` position: file `"abcdefgh"[x]`, rank `8 - y`. */
export function squareName([y, x]: Position): string {
  return `${FILES[x]}${8 - y}`;
}

/** UCI text for a move: from + to + optional `q|r|b|n`. */
export function moveToUci(move: Move): string {
  const suffix = move.promotion ? PROMOTION_LETTER[move.promotion] : "";
  return `${squareName(move.from)}${squareName(move.to)}${suffix}`;
}

/**
 * The legal move `uci` names in `state`, or `null`. Matching against
 * `legalMoves` covers an empty or enemy from-square and illegal moves; the
 * promotion field must match exactly, so a last-rank pawn move needs a suffix
 * and any other move must have none.
 */
export function uciToMove(state: GameState, uci: string): Move | null {
  const match = UCI_PATTERN.exec(uci);
  if (match === null) return null;
  const [, fromFile, fromRank, toFile, toRank, letter] = match;
  const from: Position = [8 - Number(fromRank), FILES.indexOf(fromFile)];
  const toY = 8 - Number(toRank);
  const toX = FILES.indexOf(toFile);
  const promotion = letter === "" ? undefined : LETTER_PROMOTION[letter];

  const found = legalMoves(state, from).find(
    (m) => m.to[0] === toY && m.to[1] === toX && m.promotion === promotion
  );
  return found ?? null;
}

function placement(state: GameState): string {
  return state.squares
    .map((row) => {
      let out = "";
      let empty = 0;
      for (const piece of row) {
        if (piece === null) {
          empty++;
          continue;
        }
        if (empty > 0) out += String(empty);
        empty = 0;
        const letter = FEN_LETTER[pieceKind(piece)];
        out += colorOf(piece) === "white" ? letter.toUpperCase() : letter;
      }
      return empty > 0 ? out + String(empty) : out;
    })
    .join("/");
}

function castlingField(state: GameState): string {
  const { white, black } = state.castling;
  const field =
    (white.kingSide ? "K" : "") +
    (white.queenSide ? "Q" : "") +
    (black.kingSide ? "k" : "") +
    (black.queenSide ? "q" : "");
  return field === "" ? "-" : field;
}

/**
 * The en-passant square, written only when the side to move has a legal
 * en-passant capture onto it; otherwise `-`. This merges transpositions that
 * differ only by an uncapturable double push.
 */
function enPassantField(state: GameState): string {
  const target = state.enPassant;
  if (target === null) return "-";
  const [ty, tx] = target;
  // The capturing pawn stands one rank behind the target, from the mover's view.
  const fromY = state.turn === "white" ? ty + 1 : ty - 1;
  for (const fromX of [tx - 1, tx + 1]) {
    if (fromX < 0 || fromX > 7 || fromY < 0 || fromY > 7) continue;
    const piece = state.squares[fromY][fromX];
    if (piece === null || pieceKind(piece) !== "pawn") continue;
    const canCapture = legalMoves(state, [fromY, fromX]).some(
      (m) => m.to[0] === ty && m.to[1] === tx
    );
    if (canCapture) return squareName(target);
  }
  return "-";
}

/**
 * FEN fields 1 to 4 (placement, side, castling, en passant) joined by spaces.
 * Castling comes straight from `state.castling`.
 */
export function positionKey(state: GameState): string {
  const side = state.turn === "white" ? "w" : "b";
  return [placement(state), side, castlingField(state), enPassantField(state)]
    .join(" ");
}

/** Full FEN: the position key plus the halfmove and fullmove counters. */
export function toFen(
  state: GameState,
  counters: { halfmove: number; fullmove: number } = { halfmove: 0, fullmove: 1 }
): string {
  return `${positionKey(state)} ${counters.halfmove} ${counters.fullmove}`;
}
