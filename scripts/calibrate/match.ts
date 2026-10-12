// Stub: filled in by the feat commit.
import type { GameState } from "../../src/game/engine/game-state";
import type { EngineLine } from "../../src/game/opponent/engine/lines";
export interface Opening { name: string; moves: readonly string[] }
export interface MovePlayed { uci: string; lines?: readonly EngineLine[] }
export interface MatchPlayer { readonly name: string; readonly slipAbove?: number; newGame(): void; move(state: GameState): Promise<MovePlayed> }
export const OPENINGS: readonly Opening[] = [];
export const gamePlan = (..._a: unknown[]): unknown[] => [];
export const moveLoss = (..._a: unknown[]): number | null => -1;
export const eloGap = (..._a: unknown[]): number | null => NaN;
export const playGame = async (..._a: unknown[]): Promise<any> => ({});
export const playMatch = async (..._a: unknown[]): Promise<any> => ({ records: [] });
export const summarize = (..._a: unknown[]): any => ({});
