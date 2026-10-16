// Relative imports only, no React.
import type { GameState } from "../engine/game-state";

export function gameMoves(positions: readonly GameState[]): string[] {
  void positions;
  return [];
}

export function moveLabel(state: GameState, uci: string, ply: number): string {
  void state;
  void ply;
  return uci;
}
