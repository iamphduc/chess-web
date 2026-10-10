// Skeleton: signatures only, filled in by the wiring commit.
import type { AppDispatch, RootState } from "app/store";
import type { LiemOpponent, OpponentController } from "./opponentController";

export function createLiemController(
  _dispatch: AppDispatch,
  _load?: () => Promise<LiemOpponent>
): OpponentController {
  const nothing = () => undefined;
  return { preload: nothing, request: nothing, cancel: nothing, retry: nothing, dispose: nothing };
}

export function liemGameId(_board: RootState["board"], _match: RootState["match"]): number | null {
  return -1;
}

export function syncLiemTurn(
  _controller: OpponentController,
  _board: RootState["board"],
  _match: RootState["match"]
): void {}

export function useLiemOpponent(): { retry: () => void } {
  return { retry: () => undefined };
}
