import { GameState, PieceColor } from "game/engine/game-state";
import { PieceKind } from "game/engine/moves/classify";

export type CapturedKind = Exclude<PieceKind, "king">;

export interface MaterialLine {
  captured: CapturedKind[];
  advantage: number;
}

export function materialLine(_state: GameState, _color: PieceColor): MaterialLine {
  throw new Error("not built yet");
}
