import type { GameState, PieceColor } from "game/engine/game-state";
import type { OpponentSettings } from "game/opponent/opponent";
import { strengthElo } from "game/opponent/strength";
import { TOTAL_MS } from "features/board/clock";
import { GameOverType } from "features/board/components/GameOver";
import type { MatchState } from "./matchSlice";

/** The board fields his turn depends on (a subset of the `board` state). */
export interface LiemTurnBoard {
  engineHistory: readonly GameState[];
  gameId: number;
  humanColor: PieceColor | null;
  isPlaying: boolean;
  gameOver: GameOverType;
  flagFallWinner: "White" | "Black" | null;
  pendingPromotion: unknown;
}

/** One ask for his move: the position after `ply` plies of game `gameId`. */
export interface TurnRequest {
  gameId: number;
  ply: number;
  state: GameState;
  settings: OpponentSettings;
}

/** His turn to move, or `null` when it isn't. `rating` is his own Elo, for the Full step. */
export function liemTurn(board: LiemTurnBoard, match: MatchState, rating: number): TurnRequest | null {
  if (match.mode !== "liem" || match.setupOpen) return null;
  if (board.humanColor === null || !board.isPlaying) return null;
  if (board.gameOver !== GameOverType.Continue || board.flagFallWinner !== null) return null;
  if (board.pendingPromotion) return null;

  const ply = board.engineHistory.length - 1;
  const state = board.engineHistory[ply];
  if (state.turn === board.humanColor) return null;

  return {
    gameId: board.gameId,
    ply,
    state,
    settings: { elo: strengthElo(match.strength, rating), clock: { baseMs: TOTAL_MS, incrementMs: 0 } },
  };
}
