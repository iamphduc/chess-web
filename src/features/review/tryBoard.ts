/**
 * Click-to-move rules for the review board, where the human tries a move at a
 * key moment. Pure: squares are names (`"e2"`), moves come out as UCI.
 * No drag: click a piece of the side to move, then a legal target.
 */
import { legalMoves, type Move, type Position } from "game/engine/engine";
import type { GameState } from "game/engine/game-state";
import { colorOf } from "game/engine/moves/classify";
import { moveToUci, squareName } from "game/opponent/position";

export type PromotionPiece = "q" | "r" | "b" | "n";

export interface TrySelection {
  /** The square of the picked piece, or `null`. */
  selected: string | null;
  /** A pawn move to the last rank waiting for its piece. */
  promotion: { from: string; to: string } | null;
}

export interface TryStep {
  selection: TrySelection;
  /** The move to try, in UCI, once it's complete. */
  move: string | null;
}

export const NO_SELECTION: TrySelection = { selected: null, promotion: null };

const FILES = "abcdefgh";
const LETTER: Record<NonNullable<Move["promotion"]>, PromotionPiece> = {
  queen: "q",
  rook: "r",
  bishop: "b",
  knight: "n",
};

function toPosition(name: string): Position | null {
  if (!/^[a-h][1-8]$/.test(name)) return null;
  return [8 - Number(name[1]), FILES.indexOf(name[0])];
}

/** The piece on `name` belongs to the side to move. */
function ownPiece(game: GameState, name: string): boolean {
  const at = toPosition(name);
  if (at === null) return false;
  const piece = game.squares[at[0]][at[1]];
  return piece !== null && colorOf(piece) === game.turn;
}

function movesFrom(game: GameState, name: string): Move[] {
  const at = toPosition(name);
  return at === null || !ownPiece(game, name) ? [] : legalMoves(game, at);
}

const step = (selection: TrySelection, move: string | null = null): TryStep => ({ selection, move });

/** The legal target squares of the picked piece, one per square (a promotion's four kinds count once). */
export function targetsOf(game: GameState, selection: TrySelection): string[] {
  if (selection.selected === null) return [];
  return Array.from(new Set(movesFrom(game, selection.selected).map((m) => squareName(m.to))));
}

export function clickSquare(game: GameState, selection: TrySelection, square: string): TryStep {
  // Any square click while a promotion waits cancels it.
  if (selection.promotion !== null) return step(NO_SELECTION);

  const { selected } = selection;
  if (selected === square) return step(NO_SELECTION);
  if (ownPiece(game, square)) return step({ selected: square, promotion: null });
  if (selected === null) return step(NO_SELECTION);

  const moves = movesFrom(game, selected).filter((m) => squareName(m.to) === square);
  if (moves.length === 0) return step(NO_SELECTION);
  if (moves.some((m) => m.promotion !== undefined)) {
    return step({ selected, promotion: { from: selected, to: square } });
  }
  return step(NO_SELECTION, moveToUci(moves[0]));
}

export function choosePromotion(game: GameState, selection: TrySelection, piece: PromotionPiece): TryStep {
  const pending = selection.promotion;
  if (pending === null) return step(NO_SELECTION);
  const move = movesFrom(game, pending.from).find(
    (m) => squareName(m.to) === pending.to && m.promotion !== undefined && LETTER[m.promotion] === piece
  );
  return step(NO_SELECTION, move === undefined ? null : moveToUci(move));
}
