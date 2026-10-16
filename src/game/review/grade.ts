// Relative imports only, no React.
import type { PieceColor } from "../engine/game-state";
import type { Grade, PositionEval } from "./types";

export const INACCURACY = 10;
export const MISTAKE = 20;
export const BLUNDER = 30;

export function winFor(e: PositionEval, sideToMove: PieceColor, viewer: PieceColor): number {
  void e; void sideToMove; void viewer;
  return -1;
}

export function moveDrop(before: number, after: number): number {
  void before; void after;
  return -1;
}

export function moveAccuracy(before: number, after: number): number {
  void before; void after;
  return -1;
}

export function gradeForDrop(drop: number): Grade | null {
  void drop;
  return null;
}

export function gradeMove(
  before: PositionEval,
  after: PositionEval
): { drop: number; accuracy: number; grade: Grade | null } {
  void before; void after;
  return { drop: -1, accuracy: -1, grade: null };
}

export function isFound(input: {
  tried: string;
  best: string | null;
  played: string;
  before: number;
  after: number;
}): boolean {
  void input;
  return false;
}
