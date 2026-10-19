// Glue only: connects the analysis runner, his books and the review model to
// the store. The rules live in reviewActions.ts (when it opens, where the pass
// starts, trying a move, keys), reviewSlice.ts and src/game/review/.
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";

import { useAppDispatch, useAppSelector } from "app/hooks";
import type { RootState } from "app/store";
import type { Book, BookName } from "game/opponent/types";
import { createAnalysisRunner, type ReviewEngine } from "game/review/analysis-runner";
import type { ReviewModel } from "game/review/types";
import { keyStep, passStart, reviewModel, tryMove } from "./reviewActions";
import { REVIEW_LIMITS } from "./reviewLimits";
import {
  analysisFailed,
  analysisFinished,
  evalReceived,
  lockedPlies,
  type ReviewState,
  stepTo,
} from "./reviewSlice";

/** The review state. */
export const selectReview = (state: RootState): ReviewState => state.review;

type Books = Record<BookName, Book>;

/**
 * His books for the review, loaded once (a dynamic import, so they stay out of
 * the entry bundle). `undefined` until loaded, `null` when they failed to load.
 */
function createBooksStore(load: () => Promise<Books>) {
  let books: Books | null | undefined;
  let loading: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  return {
    get: (): Books | null | undefined => books,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    load(): Promise<void> {
      loading ??= load().then(
        (loaded) => {
          books = loaded;
        },
        () => {
          books = null;
        }
      ).then(() => listeners.forEach((l) => l()));
      return loading;
    },
  };
}

export const reviewBooks = createBooksStore(() =>
  import("features/liem/liemOpponent").then((m) => m.loadLiemBooks())
);

export interface GameReview {
  /** `null` outside the review. */
  model: ReviewModel | null;
  /** A move tried on the board at the open key moment. */
  onTry: (uci: string) => void;
}

/**
 * Runs the review while the board is mounted: the pass over the game while the
 * review is open and analysing (stopped on close or clear), the books, the
 * model, tried moves and the arrow keys.
 */
export function useGameReview(analyse: ReviewEngine["analyse"]): GameReview {
  const dispatch = useAppDispatch();
  const review = useAppSelector(selectReview);
  const positions = useAppSelector((state) => state.board.engineHistory);
  const humanColor = useAppSelector((state) => state.board.humanColor);
  const books = useSyncExternalStore(reviewBooks.subscribe, reviewBooks.get, reviewBooks.get);
  const runner = useMemo(() => createAnalysisRunner({ engine: { analyse }, limits: REVIEW_LIMITS }), [analyse]);

  const latest = useRef({ review, positions });
  latest.current = { review, positions };

  const { open, status, gameId } = review;

  useEffect(() => {
    if (open) void reviewBooks.load();
  }, [open]);

  // Closing the review, a new game or unmounting stops every search, checks included.
  useEffect(() => {
    if (!open) return;
    return () => runner.stop();
  }, [open, gameId, runner]);

  // The pass, from the first position with no eval.
  useEffect(() => {
    if (!open || status !== "analysing" || gameId === null) return;
    const from = passStart(latest.current.review.evals);
    if (from === null) {
      dispatch(analysisFinished({ gameId }));
      return;
    }
    let live = true;
    runner
      .start(latest.current.positions, from, (index, e) => {
        if (live) dispatch(evalReceived({ gameId, index, eval: e }));
      })
      .then(
        (result) => {
          if (live && result === "done") dispatch(analysisFinished({ gameId }));
        },
        () => {
          if (live) dispatch(analysisFailed({ gameId }));
        }
      );
    return () => {
      live = false;
    };
  }, [open, status, gameId, runner, dispatch]);

  // Arrow keys step through the game.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      const to = keyStep(event, latest.current.review);
      if (to === null) return;
      event.preventDefault();
      dispatch(stepTo(to));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dispatch]);

  const lockedKey = Object.keys(review.moments).join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const locked = useMemo(() => lockedPlies(latest.current.review), [lockedKey]);

  const model = useMemo(
    () =>
      open && humanColor !== null
        ? reviewModel({ positions, humanColor, evals: review.evals, books: books ?? null, locked })
        : null,
    [open, positions, humanColor, review.evals, books, locked]
  );

  const onTry = useCallback(
    (uci: string) => {
      const ply = latest.current.review.active;
      if (ply !== null) void dispatch(tryMove(ply, uci, (state) => runner.check(state)));
    },
    [dispatch, runner]
  );

  return { model, onTry };
}
