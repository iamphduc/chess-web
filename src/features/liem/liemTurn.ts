import type { GameState, PieceColor } from "game/engine/game-state";
import type { OpponentSettings } from "game/opponent/opponent";
import { STEP_PROFILES } from "game/opponent/step-profiles";
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

/** His turn to move, or `null` when it isn't. The step picks his search and how he picks moves. */
export function liemTurn(board: LiemTurnBoard, match: MatchState): TurnRequest | null {
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
    settings: { profile: STEP_PROFILES[match.strength], clock: { baseMs: TOTAL_MS, incrementMs: 0 } },
  };
}
