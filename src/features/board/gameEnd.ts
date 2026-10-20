import type { PieceColor } from "game/engine/game-state";
import { GameOverType } from "./components/GameOver";

/** How a game ended. */
export type EndReason = "checkmate" | "stalemate" | "time" | "resigned";

/** The result of a finished game. `winner: null` is a draw. */
export interface GameEnd {
  winner: PieceColor | null;
  reason: EndReason;
}

/** The board fields the game's end depends on (a subset of the `board` state). */
export interface GameEndBoard {
  isPlaying: boolean;
  gameOver: GameOverType;
  /** Set once, when the game ends; only `reset` and `newGame` clear it. */
  result: GameEnd | null;
}

/** How the game ended, or `null` while it goes on. */
export function gameEnd(board: Pick<GameEndBoard, "result">): GameEnd | null {
  return board.result;
}

/** A running game can be resigned: vs Liem from the start, in Two players once Play is pressed. */
export function canResign(board: Pick<GameEndBoard, "isPlaying" | "gameOver">): boolean {
  return board.isPlaying && board.gameOver === GameOverType.Continue;
}
