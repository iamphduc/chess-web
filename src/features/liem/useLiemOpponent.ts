// Glue only: connects the opponent controller to the store. The rules live in
// liemTurn.ts (when it's his turn) and opponentController.ts (loading, stale
// answers, retries).
import { useCallback, useEffect, useRef } from "react";

import { useAppDispatch, useAppSelector } from "app/hooks";
import type { AppDispatch, RootState } from "app/store";
import { playOpponentMove } from "features/board/BoardSlice";
import { LIEM } from "game/opponent/players";
import { liemTurn } from "./liemTurn";
import { opponentMoved, setOpponentStatus } from "./matchSlice";
import { createOpponentController, type LiemOpponent, type OpponentController } from "./opponentController";

// A dynamic import, so the engine loader (and the book URLs and Stockfish behind
// it) stay out of the entry bundle until a vs-Liem game starts.
const loadLiemOpponent = (): Promise<LiemOpponent> =>
  import("./liemOpponent").then((m) => m.loadLiemOpponent());

/** A controller whose answers are played on the board and recorded for the book note. */
export function createLiemController(
  dispatch: AppDispatch,
  load: () => Promise<LiemOpponent> = loadLiemOpponent
): OpponentController {
  return createOpponentController({
    load,
    onMove: ({ gameId, ply, choice }) => {
      dispatch(playOpponentMove({ gameId, ply, move: choice.move }));
      dispatch(opponentMoved({ gameId, ply, uci: choice.uci, source: choice.source, lookup: choice.lookup }));
    },
    onStatus: (status) => dispatch(setOpponentStatus(status)),
  });
}

/** The vs-Liem game in progress (its `gameId`), or `null` in two players or while the card is open. */
export function liemGameId(board: RootState["board"], match: RootState["match"]): number | null {
  if (match.mode !== "liem" || match.setupOpen || board.humanColor === null) return null;
  return board.gameId;
}

/** Asks him to move when it's his turn; otherwise drops any answer still on its way. */
export function syncLiemTurn(
  controller: OpponentController,
  board: RootState["board"],
  match: RootState["match"]
): void {
  const request = liemTurn(board, match, LIEM.entry.rating);
  if (request) controller.request(request);
  else controller.cancel();
}

/**
 * Drives his moves while the board is mounted. Each mount makes its own
 * controller and disposes it on unmount, so StrictMode's second mount gets a
 * fresh one. Returns `retry` for the book note's Try again.
 */
export function useLiemOpponent(): { retry: () => void } {
  const dispatch = useAppDispatch();
  const board = useAppSelector((state) => state.board);
  const match = useAppSelector((state) => state.match);
  const controller = useRef<OpponentController | null>(null);

  useEffect(() => {
    const current = createLiemController(dispatch);
    controller.current = current;
    return () => {
      current.dispose();
      if (controller.current === current) controller.current = null;
    };
  }, [dispatch]);

  const gameId = liemGameId(board, match);
  useEffect(() => {
    if (gameId !== null) controller.current?.preload();
  }, [gameId]);

  useEffect(() => {
    if (controller.current) syncLiemTurn(controller.current, board, match);
  }, [board, match]);

  const retry = useCallback(() => controller.current?.retry(), []);
  return { retry };
}
