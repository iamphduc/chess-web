// Stub: filled in by the feature commit.
import type { PieceColor } from "game/engine/game-state";
import type { GraphSide } from "./reviewSlice";

export interface GraphPoint { index: number; x: number; y: number; win: number }
export const sideWin = (_w: number | null, _s: GraphSide, _c: PieceColor): number | null => null;
export const positionX = (_i: number, _last: number, _width: number): number => -1;
export const graphPoints = (
  _w: readonly (number | null)[],
  _o: { side: GraphSide; humanColor: PieceColor; width: number; height: number }
): (GraphPoint | null)[] => [];
export const lineRuns = (_p: readonly (GraphPoint | null)[]): GraphPoint[][] => [[]];
export const moveTicks = (_plies: number): { move: number; index: number }[] => [];
export const nearestPosition = (_x: number, _last: number, _width: number): number => -1;
