import type { GameState } from "game/engine/game-state";
import { pieceKind, type PieceKind } from "game/engine/moves/classify";
import type { PromotionKind } from "game/engine/moves/promotion";
import { pieceNotation } from "game/piece-notation";
import { squareName, uciToMove } from "game/opponent/position";
import { moveGames } from "game/opponent/types";
import type { MatchState } from "./matchSlice";

/** Most book rows shown; the played move is added below them when it falls past the cap. */
export const MAX_ROWS = 5;

const LETTER: Record<PieceKind, string> = {
  pawn: "",
  knight: "N",
  bishop: "B",
  rook: "R",
  queen: "Q",
  king: "K",
};

const PROMOTION: Record<PromotionKind, string> = { queen: "Q", rook: "R", bishop: "B", knight: "N" };

/**
 * A book move as text: `"3.Nf3"`, `"1...e5"`, `"4.O-O"`, `"5.bxa8=Q"`. No check marks.
 * `ply` is the plies played before the move, for the move number. `null` when `uci` isn't legal.
 */
export function bookMoveLabel(state: GameState, ply: number, uci: string): string | null {
  const move = uciToMove(state, uci);
  if (move === null) return null;
  const [fromY, fromX] = move.from;
  const [toY, toX] = move.to;
  const piece = state.squares[fromY][fromX];
  if (piece === null) return null;

  const number = `${Math.floor(ply / 2) + 1}${state.turn === "white" ? "." : "..."}`;
  const kind = pieceKind(piece);
  if (kind === "king" && Math.abs(toX - fromX) === 2) return number + (toX > fromX ? "O-O" : "O-O-O");

  // A pawn moving sideways always captures, en passant included.
  const capture = state.squares[toY][toX] !== null || (kind === "pawn" && toX !== fromX);
  const to = squareName(move.to);
  const promotion = move.promotion ? `=${PROMOTION[move.promotion]}` : "";
  if (kind === "pawn") {
    return number + (capture ? `${squareName(move.from)[0]}x` : "") + to + promotion;
  }
  const suffix = pieceNotation.getSuffixAbbreviation(state, move.from, move.to);
  return number + LETTER[kind] + suffix + (capture ? "x" : "") + to;
}

/** One book move in the note: its label, games, bar width (0 to 100) and whether he played it. */
export interface BookRow {
  uci: string;
  label: string;
  games: number;
  width: number;
  played: boolean;
}

export type BookNoteView =
  | { kind: "waiting" }
  | { kind: "in-book"; rows: BookRow[]; total: number }
  | { kind: "out" }
  | { kind: "failed" };

/** The board fields the note reads. */
export interface BookNoteBoard {
  engineHistory: readonly GameState[];
  gameId: number;
}

/** The match fields the note reads. */
export type BookNoteMatch = Pick<MatchState, "lastChoice" | "opponentStatus">;

/**
 * What the book note shows. A failed opponent wins; then nothing yet (or a move from
 * another game) is waiting; a book move is in book, an engine move out.
 */
export function bookNoteView(board: BookNoteBoard, match: BookNoteMatch): BookNoteView {
  if (match.opponentStatus === "failed") return { kind: "failed" };
  const choice = match.lastChoice;
  if (choice === null || choice.gameId !== board.gameId) return { kind: "waiting" };
  if (choice.source === "engine" || choice.lookup === null) return { kind: "out" };

  const state = board.engineHistory[choice.ply];
  const legal: Omit<BookRow, "width">[] = [];
  if (state !== undefined) {
    for (const move of choice.lookup.moves) {
      const label = bookMoveLabel(state, choice.ply, move[0]);
      if (label === null) continue;
      legal.push({ uci: move[0], label, games: moveGames(move), played: move[0] === choice.uci });
    }
  }

  const shown = legal.slice(0, MAX_ROWS);
  const played = legal.slice(MAX_ROWS).find((row) => row.played);
  if (played) shown.push(played);

  const top = Math.max(0, ...legal.map((row) => row.games));
  const rows = shown.map((row) => ({ ...row, width: top === 0 ? 0 : Math.round((row.games / top) * 100) }));
  return { kind: "in-book", rows, total: choice.lookup.games };
}

/** The badge on his card: the games behind the note while in book, else `null`. */
export function liemBadge(view: BookNoteView): { games: number } | null {
  return view.kind === "in-book" ? { games: view.total } : null;
}
