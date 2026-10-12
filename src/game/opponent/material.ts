// Relative imports only: the Node scripts (run with tsx) may load this file.
import { Move } from "../engine/engine";
import { GameState } from "../engine/game-state";

export function hangsMaterial(_state: GameState, _move: Move): boolean {
  return false;
}
