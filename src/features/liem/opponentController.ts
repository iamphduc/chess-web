import type { GameState } from "game/engine/game-state";
import { type MoveChoice, OpponentError, type OpponentSettings } from "game/opponent/opponent";
import type { TurnRequest } from "./liemTurn";
import type { OpponentStatus } from "./matchSlice";

/** The opponent the controller drives. `loadLiemOpponent`'s result fits it by shape. */
export interface LiemOpponent {
  chooseMove(state: GameState, settings: OpponentSettings): Promise<MoveChoice>;
  /** Starts a fresh game: aborts any choice in flight and resets the engine. */
  newGame(): void;
  dispose(): void;
}

/** His answer for one request. */
export interface OpponentMove {
  gameId: number;
  ply: number;
  choice: MoveChoice;
}

export interface OpponentController {
  /** Starts loading the opponent if it isn't loaded or loading. */
  preload(): void;
  /** Asks for his move. A repeat of the latest `(gameId, ply)` is ignored. */
  request(req: TurnRequest): void;
  /** Drops the latest request, so nothing in flight reaches `onMove`. */
  cancel(): void;
  /** After a failure, asks again (on a freshly loaded opponent when the old one broke). */
  retry(): void;
  /** Disposes the opponent for good. Later calls do nothing. */
  dispose(): void;
}

/** What a failed choice does to the turn. */
type Outcome = "silent" | "retry-same" | "retry-fresh";

function outcomeOf(error: unknown): Outcome {
  const code = error instanceof OpponentError ? error.code : null;
  switch (code) {
    case "superseded":
    case "disposed":
    case "no-legal-moves":
      return "silent";
    case "illegal-engine-move":
    case "engine-timeout":
      return "retry-same";
    default:
      // engine-failed, or anything unknown: the opponent may be broken, so drop it.
      return "retry-fresh";
  }
}

/**
 * Drives the opponent for the vs-Liem game: loads it once, asks it for each of
 * his turns, and passes on only the latest request's answer. No timers: a book
 * answer reaches `onMove` within the promise chain.
 */
export function createOpponentController(deps: {
  load: () => Promise<LiemOpponent>;
  onMove: (move: OpponentMove) => void;
  onStatus: (status: OpponentStatus) => void;
}): OpponentController {
  const { load, onMove, onStatus } = deps;

  let disposed = false;
  let loading: Promise<LiemOpponent> | null = null;
  let opponent: LiemOpponent | null = null;

  /** The latest request still waiting for an answer, by identity. */
  let latest: { req: TurnRequest } | null = null;
  /** The latest request's key, kept after it answers so a repeat is ignored. */
  let lastKey: { gameId: number; ply: number } | null = null;
  /** The previous request's game, for the reset between games (kept across cancel). */
  let lastGameId: number | null = null;
  let newGamePending = false;
  /** What `retry` re-runs: a failed request, or a failed preload. */
  let failed: TurnRequest | "preload" | null = null;

  let status: OpponentStatus | null = null;
  function setStatus(next: OpponentStatus): void {
    if (disposed || status === next) return;
    status = next;
    onStatus(next);
  }

  function dropOpponent(): void {
    opponent?.dispose();
    opponent = null;
    loading = null;
  }

  /** The loaded opponent, loading it on first use. A failed load is forgotten. */
  function getOpponent(): Promise<LiemOpponent> {
    if (loading !== null) return loading;
    const attempt: Promise<LiemOpponent> = load().then(
      (loaded) => {
        if (disposed || loading !== attempt) {
          loaded.dispose();
          throw new OpponentError("disposed");
        }
        opponent = loaded;
        return loaded;
      },
      (error: unknown) => {
        if (loading === attempt) loading = null;
        throw error;
      }
    );
    loading = attempt;
    return attempt;
  }

  /** Loads with no request waiting: loading, then idle or failed. */
  function startPreload(): void {
    if (opponent !== null || loading !== null) return;
    setStatus("loading");
    getOpponent().then(
      () => {
        if (latest === null && failed === null) setStatus("idle");
      },
      () => {
        if (disposed || latest !== null) return;
        failed = "preload";
        setStatus("failed");
      }
    );
  }

  async function run(req: TurnRequest): Promise<void> {
    const turn = { req };
    latest = turn;
    lastKey = { gameId: req.gameId, ply: req.ply };
    failed = null;
    const isCurrent = () => !disposed && latest === turn;

    setStatus(opponent === null ? "loading" : "thinking");
    let current: LiemOpponent;
    try {
      current = await getOpponent();
    } catch {
      if (!isCurrent()) return;
      latest = null;
      failed = req;
      setStatus("failed");
      return;
    }
    if (!isCurrent()) return;

    if (newGamePending) {
      newGamePending = false;
      current.newGame();
    }
    setStatus("thinking");

    let choice: MoveChoice;
    try {
      choice = await current.chooseMove(req.state, req.settings);
    } catch (error) {
      if (!isCurrent()) return;
      latest = null;
      const outcome = outcomeOf(error);
      if (outcome === "silent") {
        setStatus("idle");
        return;
      }
      if (outcome === "retry-fresh" && opponent === current) dropOpponent();
      failed = req;
      setStatus("failed");
      return;
    }
    if (!isCurrent()) return;
    latest = null;
    setStatus("idle");
    onMove({ gameId: req.gameId, ply: req.ply, choice });
  }

  return {
    preload() {
      if (disposed) return;
      startPreload();
    },

    request(req) {
      if (disposed) return;
      if (lastKey !== null && lastKey.gameId === req.gameId && lastKey.ply === req.ply) return;
      if (lastGameId !== null && lastGameId !== req.gameId) newGamePending = true;
      lastGameId = req.gameId;
      void run(req);
    },

    cancel() {
      if (disposed) return;
      latest = null;
      lastKey = null;
      failed = null;
      setStatus(loading !== null && opponent === null ? "loading" : "idle");
    },

    retry() {
      if (disposed || failed === null) return;
      const again = failed;
      failed = null;
      if (again === "preload") startPreload();
      else void run(again);
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      latest = null;
      failed = null;
      dropOpponent();
    },
  };
}
