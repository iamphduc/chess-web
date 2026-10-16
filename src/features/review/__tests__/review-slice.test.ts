import { describe, expect, it } from "vitest";

import { createAppStore } from "app/store";
import { newGame, reset } from "features/board/BoardSlice";
import { type GameState, initialGameState } from "game/engine/game-state";

import {
  analysisFailed,
  analysisFinished,
  analysisRetried,
  answerShown,
  checkFailed,
  evalReceived,
  isMomentDone,
  lockedPlies,
  momentOpened,
  momentSkipped,
  moveTried,
  type PositionEval,
  reviewClosed,
  reviewOpened,
  reviewSlice,
  type ReviewState,
  setGraphSide,
  sheetClosed,
  sheetOpened,
  stepBy,
  stepTo,
  tryChecked,
} from "../reviewSlice";

const reducer = reviewSlice.reducer;
const initial = (): ReviewState => reducer(undefined, { type: "@@init" });

/** `count` positions; the slice only reads how many there are. */
const positions = (count: number): GameState[] => Array.from({ length: count }, () => initialGameState());

const EVAL: PositionEval = { score: { cp: 30 }, best: "e2e4" };
const EVAL2: PositionEval = { score: { mate: 2 }, best: "d1h5" };

/** Game 7 opened with 11 positions (10 plies). */
function opened(gameId = 7, count = 11): ReviewState {
  return reducer(initial(), reviewOpened({ gameId, positions: positions(count) }));
}

function apply(state: ReviewState, ...actions: Parameters<typeof reducer>[1][]): ReviewState {
  return actions.reduce(reducer, state);
}

describe("opening a new review", () => {
  it("starts closed and empty", () => {
    expect(initial()).toEqual({
      open: false,
      gameId: null,
      status: "idle",
      evals: [],
      cursor: 0,
      graphSide: "you",
      moments: {},
      active: null,
      sheetOpen: false,
    });
  });

  it("opens fresh: analysing, every eval null, the cursor on the last position, the sheet up", () => {
    expect(opened(7, 11)).toEqual({
      open: true,
      gameId: 7,
      status: "analysing",
      evals: Array(11).fill(null),
      cursor: 10,
      graphSide: "you",
      moments: {},
      active: null,
      sheetOpen: true,
    });
  });

  it("drops the last game's review when another game opens", () => {
    const old = apply(
      opened(7, 11),
      evalReceived({ gameId: 7, index: 0, eval: EVAL }),
      setGraphSide("white"),
      momentOpened(3),
      analysisFailed({ gameId: 7 }),
    );
    const fresh = reducer(old, reviewOpened({ gameId: 8, positions: positions(5) }));
    expect(fresh).toEqual({ ...opened(8, 5) });
  });

  it("a game with no moves opens on position 0", () => {
    const s = opened(3, 1);
    expect(s.cursor).toBe(0);
    expect(s.evals).toEqual([null]);
  });

  it("ignores a game with no positions", () => {
    const s = opened(7, 11);
    expect(reducer(s, reviewOpened({ gameId: 8, positions: [] }))).toEqual(s);
  });
});

describe("back to game and review again", () => {
  it("closing keeps the data", () => {
    const before = apply(opened(), evalReceived({ gameId: 7, index: 2, eval: EVAL }), momentOpened(4));
    const closed = reducer(before, reviewClosed());
    expect(closed).toEqual({ ...before, open: false });
  });

  it("reopening the same game keeps evals, moments, cursor, graph side and sheet", () => {
    let s = apply(
      opened(),
      evalReceived({ gameId: 7, index: 2, eval: EVAL }),
      setGraphSide("white"),
      momentOpened(4),
      momentSkipped(4),
      stepTo(6),
      sheetClosed(),
      reviewClosed(),
    );
    const closed = s;
    s = reducer(s, reviewOpened({ gameId: 7, positions: positions(11) }));
    expect(s).toEqual({ ...closed, open: true, status: "analysing" });
    expect(s.evals[2]).toEqual(EVAL);
    expect(s.moments).toEqual({ 4: "skipped" });
    expect(s.cursor).toBe(6);
    expect(s.sheetOpen).toBe(false);
  });

  it("a pass stopped part way resumes as analysing", () => {
    const s = apply(
      opened(7, 3),
      evalReceived({ gameId: 7, index: 0, eval: EVAL }),
      reviewClosed(),
      reviewOpened({ gameId: 7, positions: positions(3) }),
    );
    expect(s.status).toBe("analysing");
  });

  it("a pass with every eval in is done on reopening", () => {
    const s = apply(
      opened(7, 2),
      evalReceived({ gameId: 7, index: 0, eval: EVAL }),
      evalReceived({ gameId: 7, index: 1, eval: EVAL }),
      reviewClosed(),
      reviewOpened({ gameId: 7, positions: positions(2) }),
    );
    expect(s.status).toBe("done");
  });

  it("a finished pass stays done on reopening", () => {
    const s = apply(
      opened(7, 1),
      evalReceived({ gameId: 7, index: 0, eval: EVAL }),
      analysisFinished({ gameId: 7 }),
      reviewClosed(),
      reviewOpened({ gameId: 7, positions: positions(1) }),
    );
    expect(s.status).toBe("done");
  });

  it("a failed pass stays failed on reopening, so Try again still shows", () => {
    const s = apply(opened(7, 3), analysisFailed({ gameId: 7 }), reviewClosed(), reviewOpened({ gameId: 7, positions: positions(3) }));
    expect(s.status).toBe("failed");
  });

  it("the same game id with a different length starts fresh", () => {
    const s = apply(opened(7, 3), evalReceived({ gameId: 7, index: 0, eval: EVAL }), reviewClosed());
    const reopened = reducer(s, reviewOpened({ gameId: 7, positions: positions(5) }));
    expect(reopened).toEqual(opened(7, 5));
  });
});

describe("a new game clears the review", () => {
  it("the board's reset clears it", () => {
    const store = createAppStore();
    store.dispatch(reviewOpened({ gameId: 0, positions: positions(4) }));
    store.dispatch(momentOpened(1));
    store.dispatch(reset());
    expect(store.getState().review).toEqual(initial());
  });

  it("the board's newGame clears it", () => {
    const store = createAppStore();
    store.dispatch(reviewOpened({ gameId: 0, positions: positions(4) }));
    store.dispatch(evalReceived({ gameId: 0, index: 1, eval: EVAL }));
    store.dispatch(reviewClosed());
    store.dispatch(newGame({ humanColor: "black" }));
    expect(store.getState().review).toEqual(initial());
  });

  it("the store starts with the review closed", () => {
    expect(createAppStore().getState().review).toEqual(initial());
  });
});

describe("stale evals are dropped", () => {
  it("stores an eval for the open game at its index", () => {
    const s = reducer(opened(7, 3), evalReceived({ gameId: 7, index: 1, eval: EVAL }));
    expect(s.evals).toEqual([null, EVAL, null]);
  });

  it("a repeat overwrites", () => {
    const s = apply(opened(7, 3), evalReceived({ gameId: 7, index: 1, eval: EVAL }), evalReceived({ gameId: 7, index: 1, eval: EVAL2 }));
    expect(s.evals[1]).toEqual(EVAL2);
  });

  it("keeps evals that arrive while the review is closed", () => {
    const s = apply(opened(7, 3), reviewClosed(), evalReceived({ gameId: 7, index: 2, eval: EVAL }));
    expect(s.evals[2]).toEqual(EVAL);
  });

  it("ignores another game's eval, finish and failure", () => {
    const start = opened(7, 3);
    expect(reducer(start, evalReceived({ gameId: 6, index: 1, eval: EVAL }))).toEqual(start);
    expect(reducer(start, analysisFinished({ gameId: 6 }))).toEqual(start);
    expect(reducer(start, analysisFailed({ gameId: 6 }))).toEqual(start);
  });

  it("ignores everything before any review opened", () => {
    expect(reducer(initial(), evalReceived({ gameId: 0, index: 0, eval: EVAL }))).toEqual(initial());
    expect(reducer(initial(), analysisFinished({ gameId: 0 }))).toEqual(initial());
  });

  it("ignores indexes out of range or not whole", () => {
    const start = opened(7, 3);
    for (const index of [-1, 3, 4, 1.5, Number.NaN]) {
      expect(reducer(start, evalReceived({ gameId: 7, index, eval: EVAL }))).toEqual(start);
    }
  });

  it("finish and failure apply only while analysing; retry only after a failure", () => {
    const done = reducer(opened(7, 3), analysisFinished({ gameId: 7 }));
    expect(done.status).toBe("done");
    expect(reducer(done, analysisFailed({ gameId: 7 })).status).toBe("done");
    expect(reducer(done, analysisRetried()).status).toBe("done");

    const failed = reducer(opened(7, 3), analysisFailed({ gameId: 7 }));
    expect(failed.status).toBe("failed");
    expect(reducer(failed, analysisFinished({ gameId: 7 })).status).toBe("failed");
    expect(reducer(failed, analysisRetried()).status).toBe("analysing");
    expect(reducer(opened(7, 3), analysisRetried()).status).toBe("analysing");
    expect(reducer(initial(), analysisRetried()).status).toBe("idle");
  });
});

describe("stepping", () => {
  it("steps to a position and by a count, clamped to 0..n", () => {
    let s = opened(7, 11);
    s = reducer(s, stepTo(4));
    expect(s.cursor).toBe(4);
    s = reducer(s, stepBy(-1));
    expect(s.cursor).toBe(3);
    s = reducer(s, stepTo(-5));
    expect(s.cursor).toBe(0);
    s = reducer(s, stepBy(-1));
    expect(s.cursor).toBe(0);
    s = reducer(s, stepTo(99));
    expect(s.cursor).toBe(10);
    s = reducer(s, stepBy(1));
    expect(s.cursor).toBe(10);
    s = reducer(s, stepBy(-100));
    expect(s.cursor).toBe(0);
  });

  it("ignores a step that isn't a whole number", () => {
    const s = reducer(opened(7, 11), stepTo(4));
    expect(reducer(s, stepTo(2.5)).cursor).toBe(4);
    expect(reducer(s, stepTo(Number.NaN)).cursor).toBe(4);
    expect(reducer(s, stepBy(Number.NaN)).cursor).toBe(4);
  });

  it("stays at 0 with no review", () => {
    expect(reducer(initial(), stepBy(1)).cursor).toBe(0);
    expect(reducer(initial(), stepTo(3)).cursor).toBe(0);
  });

  it("is locked while the active moment is trying, checking, wrong or check-failed", () => {
    const trying = reducer(opened(7, 11), momentOpened(3));
    const checking = reducer(trying, moveTried(3));
    const wrong = reducer(checking, tryChecked({ ply: 3, found: false }));
    const failed = reducer(checking, checkFailed(3));
    for (const s of [trying, checking, wrong, failed]) {
      expect(s.cursor).toBe(3);
      expect(reducer(s, stepTo(0)).cursor).toBe(3);
      expect(reducer(s, stepBy(1)).cursor).toBe(3);
    }
  });

  it("is free again once the active moment is done", () => {
    const trying = reducer(opened(7, 11), momentOpened(3));
    const done = [
      apply(trying, moveTried(3), tryChecked({ ply: 3, found: true })),
      reducer(trying, answerShown(3)),
      reducer(trying, momentSkipped(3)),
    ];
    for (const s of done) {
      expect(reducer(s, stepBy(1)).cursor).toBe(4);
      expect(reducer(s, stepTo(0)).cursor).toBe(0);
    }
  });
});

describe("moment transitions", () => {
  it("opening a moment makes it active, moves the cursor to it and raises the sheet", () => {
    const s = apply(opened(7, 11), sheetClosed(), momentOpened(5));
    expect(s.active).toBe(5);
    expect(s.cursor).toBe(5);
    expect(s.sheetOpen).toBe(true);
    expect(s.moments).toEqual({ 5: "trying" });
  });

  it("walks trying → checking → found or wrong", () => {
    let s = apply(opened(), momentOpened(2), moveTried(2));
    expect(s.moments[2]).toBe("checking");
    expect(reducer(s, tryChecked({ ply: 2, found: true })).moments[2]).toBe("found");
    s = reducer(s, tryChecked({ ply: 2, found: false }));
    expect(s.moments[2]).toBe("wrong");
  });

  it("checking → check-failed, and opening it again tries again", () => {
    let s = apply(opened(), momentOpened(2), moveTried(2), checkFailed(2));
    expect(s.moments[2]).toBe("check-failed");
    s = reducer(s, momentOpened(2));
    expect(s.moments[2]).toBe("trying");
    s = apply(s, moveTried(2), tryChecked({ ply: 2, found: false }), momentOpened(2));
    expect(s.moments[2]).toBe("trying");
  });

  it("show answer and skip work from trying, wrong and check-failed", () => {
    const trying = apply(opened(), momentOpened(2));
    const wrong = apply(trying, moveTried(2), tryChecked({ ply: 2, found: false }));
    const failed = apply(trying, moveTried(2), checkFailed(2));
    for (const s of [trying, wrong, failed]) {
      expect(reducer(s, answerShown(2)).moments[2]).toBe("revealed");
      expect(reducer(s, momentSkipped(2)).moments[2]).toBe("skipped");
    }
  });

  it("ignores an action whose status doesn't match", () => {
    const trying = apply(opened(), momentOpened(2));
    expect(reducer(trying, tryChecked({ ply: 2, found: true }))).toEqual(trying);
    expect(reducer(trying, checkFailed(2))).toEqual(trying);
    const checking = reducer(trying, moveTried(2));
    expect(reducer(checking, moveTried(2))).toEqual(checking);
    expect(reducer(checking, answerShown(2))).toEqual(checking);
    expect(reducer(checking, momentSkipped(2))).toEqual(checking);
    const wrong = reducer(checking, tryChecked({ ply: 2, found: false }));
    expect(reducer(wrong, moveTried(2))).toEqual(wrong);
    expect(reducer(wrong, tryChecked({ ply: 2, found: true }))).toEqual(wrong);
  });

  it("ignores actions for a ply that isn't active, so a late check result is dropped", () => {
    let s = apply(opened(), momentOpened(2), moveTried(2), momentOpened(6));
    expect(s.active).toBe(6);
    const before = s;
    s = apply(s, tryChecked({ ply: 2, found: true }), checkFailed(2), answerShown(2), momentSkipped(2), moveTried(2));
    expect(s).toEqual(before);
    expect(s.moments).toEqual({ 2: "checking", 6: "trying" });
  });

  it("a late check result for a moment opened again is dropped", () => {
    const s = apply(opened(), momentOpened(2), moveTried(2), momentOpened(2), tryChecked({ ply: 2, found: true }));
    expect(s.moments[2]).toBe("trying");
  });

  it("does nothing with no active moment", () => {
    const s = opened();
    expect(apply(s, moveTried(2), answerShown(2), momentSkipped(2))).toEqual(s);
  });

  it("a done moment never changes again, and opening it keeps its status", () => {
    const found = apply(opened(), momentOpened(2), moveTried(2), tryChecked({ ply: 2, found: true }));
    const revealed = apply(opened(), momentOpened(2), answerShown(2));
    const skipped = apply(opened(), momentOpened(2), momentSkipped(2));
    for (const s of [found, revealed, skipped]) {
      const status = s.moments[2];
      const after = apply(
        s,
        momentOpened(2),
        moveTried(2),
        tryChecked({ ply: 2, found: false }),
        checkFailed(2),
        answerShown(2),
        momentSkipped(2),
      );
      expect(after.moments[2]).toBe(status);
      expect(after.active).toBe(2);
    }
  });

  it("opening a done moment moves the cursor and raises the sheet", () => {
    const s = apply(opened(), momentOpened(2), momentSkipped(2), stepTo(9), sheetClosed(), momentOpened(2));
    expect(s.cursor).toBe(2);
    expect(s.sheetOpen).toBe(true);
  });

  it("ignores a ply that isn't a move of the game", () => {
    const s = opened(7, 11);
    for (const ply of [-1, 10, 11, 2.5, Number.NaN]) {
      expect(reducer(s, momentOpened(ply))).toEqual(s);
    }
    expect(reducer(initial(), momentOpened(0))).toEqual(initial());
  });

  it("names the done statuses and the locked plies", () => {
    expect(["found", "revealed", "skipped"].every((m) => isMomentDone(m as never))).toBe(true);
    expect(["trying", "checking", "wrong", "check-failed"].some((m) => isMomentDone(m as never))).toBe(false);
    const s = apply(opened(), momentOpened(6), momentSkipped(6), momentOpened(2));
    expect(lockedPlies(s)).toEqual([2, 6]);
    expect(lockedPlies(initial())).toEqual([]);
  });
});

describe("graph side and sheet", () => {
  it("sets the graph side", () => {
    expect(reducer(opened(), setGraphSide("white")).graphSide).toBe("white");
    expect(apply(opened(), setGraphSide("white"), setGraphSide("you")).graphSide).toBe("you");
  });

  it("closes and opens the sheet", () => {
    const closed = reducer(opened(), sheetClosed());
    expect(closed.sheetOpen).toBe(false);
    expect(reducer(closed, sheetOpened()).sheetOpen).toBe(true);
  });
});
