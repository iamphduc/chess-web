import { describe, expect, it, vi } from "vitest";

import { createAppStore } from "app/store";
import { clickSquare, playOpponentMove, stop } from "features/board/BoardSlice";
import { GameOverType } from "features/board/gameOverType";
import { startLiemGame, switchMode } from "features/liem/liemActions";
import { setColorPick, setStrength } from "features/liem/matchSlice";
import { applyMove } from "game/engine/engine";
import { initialGameState } from "game/engine/game-state";
import { positionKey } from "game/opponent/position";
import type { Book, BookName } from "game/opponent/types";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LeftBookNote } from "../components/LeftBookNote";
import type { GameState } from "game/engine/game-state";
import { uciToMove } from "game/opponent/position";
import type { ReviewModel } from "game/review/types";
import {
  answerShown,
  evalReceived,
  momentOpened,
  type PositionEval,
} from "../reviewSlice";
import {
  backToGame,
  canOpenReview,
  keyStep,
  openReview,
  passStart,
  reviewModel,
  selectPosition,
  tryMove,
} from "../reviewActions";
import { REVIEW_LIMITS } from "../reviewLimits";

type Store = ReturnType<typeof createAppStore>;

const sq = (name: string) => ({ y: 8 - Number(name[1]), x: "abcdefgh".indexOf(name[0]) });

/** Plays UCI moves: the human's by clicking squares, his through `playOpponentMove`. */
function play(store: Store, ucis: readonly string[]): void {
  for (const uci of ucis) {
    const { board } = store.getState();
    const ply = board.engineHistory.length - 1;
    const state = board.engineHistory[ply];
    if (board.humanColor !== null && state.turn !== board.humanColor) {
      const move = uciToMove(state, uci);
      if (move === null) throw new Error(`illegal ${uci}`);
      store.dispatch(playOpponentMove({ gameId: board.gameId, ply, move }));
    } else {
      store.dispatch(clickSquare(sq(uci.slice(0, 2))));
      store.dispatch(clickSquare(sq(uci.slice(2, 4))));
    }
    if (store.getState().board.engineHistory.length !== ply + 2) throw new Error(`not played: ${uci}`);
  }
}

function liemGame(color: "white" | "black", ucis: readonly string[] = []): Store {
  const store = createAppStore();
  store.dispatch(switchMode("liem"));
  store.dispatch(setColorPick(color));
  store.dispatch(startLiemGame());
  play(store, ucis);
  return store;
}

const FOOLS_MATE = ["f2f3", "e7e5", "g2g4", "d8h4"];
// Sam Loyd's ten-move stalemate; White's 10.Qe6 leaves Black no move.
const STALEMATE = [
  "e2e3", "a7a5", "d1h5", "a8a6", "h5a5", "h7h5", "h2h4", "a6h6", "a5c7", "f7f6",
  "c7d7", "e8f7", "d7b7", "d8d3", "b7b8", "d3h7", "b8c8", "f7g6", "c8e6",
];

const can = (store: Store) => canOpenReview(store.getState().board, store.getState().match);

describe("when the review opens", () => {
  it("opens after a checkmate, either side mating", () => {
    const lost = liemGame("white", FOOLS_MATE);
    expect(lost.getState().board.gameOver).toBe(GameOverType.Win);
    expect(can(lost)).toBe(true);

    // As Black, he plays f3 and g4, and you mate.
    const won = liemGame("black", FOOLS_MATE);
    expect(won.getState().board.gameOver).toBe(GameOverType.Win);
    expect(can(won)).toBe(true);
  });

  it("opens after a stalemate", () => {
    const store = liemGame("white", STALEMATE);
    expect(store.getState().board.gameOver).toBe(GameOverType.Draw);
    expect(can(store)).toBe(true);
  });

  it("opens after a flag fall once you have moved", () => {
    const store = liemGame("white", ["e2e4", "e7e5"]);
    store.dispatch(stop());
    expect(store.getState().board.flagFallWinner).toBe("Black");
    expect(can(store)).toBe(true);
  });

  it("never opens with no move of yours", () => {
    const asWhite = liemGame("white");
    asWhite.dispatch(stop());
    expect(asWhite.getState().board.gameOver).toBe(GameOverType.Win);
    expect(can(asWhite)).toBe(false);

    const asBlack = liemGame("black", ["e2e4"]);
    asBlack.dispatch(stop());
    expect(can(asBlack)).toBe(false);
  });

  it("never opens mid-game", () => {
    expect(can(liemGame("white", ["e2e4", "e7e5"]))).toBe(false);
  });

  it("never opens in two players", () => {
    const store = createAppStore();
    store.dispatch(switchMode("two-player"));
    play(store, FOOLS_MATE);
    expect(store.getState().board.gameOver).toBe(GameOverType.Win);
    expect(can(store)).toBe(false);
  });

  it("never opens with a promotion still to pick or the card open", () => {
    const store = liemGame("white", ["e2e4", "e7e5"]);
    store.dispatch(stop());
    const { board, match } = store.getState();
    const pendingPromotion = { from: [1, 0], to: [0, 0] } as unknown as typeof board.pendingPromotion;
    expect(canOpenReview({ ...board, pendingPromotion }, match)).toBe(false);
    expect(canOpenReview(board, { ...match, setupOpen: true })).toBe(false);
  });

  it("openReview opens it for this game, and does nothing when it can't", () => {
    const midGame = liemGame("white", ["e2e4", "e7e5"]);
    midGame.dispatch(openReview());
    expect(midGame.getState().review.open).toBe(false);

    const store = liemGame("white", FOOLS_MATE);
    store.dispatch(openReview());
    const { review, board } = store.getState();
    expect(review.open).toBe(true);
    expect(review.gameId).toBe(board.gameId);
    expect(review.status).toBe("analysing");
    expect(review.evals).toHaveLength(5);
  });

  it("Back to game closes it and keeps what it found", () => {
    const store = liemGame("white", FOOLS_MATE);
    store.dispatch(openReview());
    const { gameId } = store.getState().board;
    store.dispatch(evalReceived({ gameId, index: 0, eval: { score: { cp: 20 }, best: "e2e4" } }));
    store.dispatch(backToGame());
    expect(store.getState().review.open).toBe(false);
    expect(store.getState().review.evals[0]).not.toBeNull();
    expect(can(store)).toBe(true);
  });
});

describe("review limits", () => {
  it("is depth 18, MultiPV 1 and a movetime from 100 to 1000 ms", () => {
    expect(REVIEW_LIMITS.depth).toBe(18);
    expect(REVIEW_LIMITS.multiPv).toBe(1);
    expect(Number.isInteger(REVIEW_LIMITS.movetimeMs)).toBe(true);
    expect(REVIEW_LIMITS.movetimeMs).toBeGreaterThanOrEqual(100);
    expect(REVIEW_LIMITS.movetimeMs).toBeLessThanOrEqual(1000);
  });
});

describe("the pass", () => {
  it("starts at the first position with no eval, or not at all", () => {
    const e: PositionEval = { score: { cp: 0 }, best: null };
    expect(passStart([null, null])).toBe(0);
    expect(passStart([e, e, null, e, null])).toBe(2);
    expect(passStart([e, e])).toBeNull();
    expect(passStart([])).toBeNull();
  });
});

/**
 * Fool's mate with you on White: the key moment is 2.g4 (ply 2), from the
 * position after 1.f3 e5, where Stockfish's best is b1c3.
 */
function atKeyMoment(): Store {
  const store = liemGame("white", FOOLS_MATE);
  store.dispatch(openReview());
  const { gameId } = store.getState().board;
  const evals: PositionEval[] = [
    { score: { cp: 30 }, best: "e2e4" },
    { score: { cp: 20 }, best: "e7e5" },
    { score: { cp: 0 }, best: "b1c3" }, // White to move: 50 %
    { score: { mate: 1 }, best: "d8h4" },
    { score: { mate: 0 }, best: null },
  ];
  evals.forEach((e, index) => store.dispatch(evalReceived({ gameId, index, eval: e })));
  store.dispatch(momentOpened(2));
  return store;
}

const status = (store: Store) => store.getState().review.moments[2];
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("trying a move", () => {
  it("Stockfish's best is found with no search", async () => {
    const store = atKeyMoment();
    const check = vi.fn<(s: GameState) => Promise<PositionEval>>();
    await store.dispatch(tryMove(2, "b1c3", check));
    expect(check).not.toHaveBeenCalled();
    expect(status(store)).toBe("found");
  });

  it("the move you played is wrong with no search", async () => {
    const store = atKeyMoment();
    const check = vi.fn<(s: GameState) => Promise<PositionEval>>();
    await store.dispatch(tryMove(2, "g2g4", check));
    expect(check).not.toHaveBeenCalled();
    expect(status(store)).toBe("wrong");
  });

  it("another move is checked on the position after it, and the check decides", async () => {
    // Black to move after the try: +50 cp for Black is White ~45 %, a drop under 10.
    const close = atKeyMoment();
    let answer!: (e: PositionEval) => void;
    const check = vi.fn((_: GameState) => new Promise<PositionEval>((r) => (answer = r)));
    const done = close.dispatch(tryMove(2, "d2d4", check));
    expect(status(close)).toBe("checking");
    expect(check).toHaveBeenCalledTimes(1);
    const after = check.mock.calls[0][0];
    expect(after.turn).toBe("black");
    expect(after.squares[4][3]).not.toBeNull(); // a pawn on d4
    answer({ score: { cp: 50 }, best: "d8h4" });
    await done;
    expect(status(close)).toBe("found");

    // +300 cp for Black is White ~25 %: too much.
    const far = atKeyMoment();
    await far.dispatch(tryMove(2, "d2d4", () => Promise.resolve({ score: { cp: 300 }, best: null })));
    expect(status(far)).toBe("wrong");
  });

  it("a check error gives check-failed", async () => {
    const store = atKeyMoment();
    await store.dispatch(tryMove(2, "d2d4", () => Promise.reject(new Error("engine died"))));
    expect(status(store)).toBe("check-failed");
  });

  it("does nothing unless that moment is waiting for a move", async () => {
    const store = atKeyMoment();
    store.dispatch(answerShown(2));
    const check = vi.fn(() => Promise.resolve<PositionEval>({ score: { cp: 0 }, best: null }));
    await store.dispatch(tryMove(2, "d2d4", check));
    await store.dispatch(tryMove(4, "d2d4", check));
    await flush();
    expect(check).not.toHaveBeenCalled();
    expect(status(store)).toBe("revealed");
  });

  it("ignores an illegal move", async () => {
    const store = atKeyMoment();
    const check = vi.fn(() => Promise.resolve<PositionEval>({ score: { cp: 0 }, best: null }));
    await store.dispatch(tryMove(2, "d2d5", check));
    expect(check).not.toHaveBeenCalled();
    expect(status(store)).toBe("trying");
  });
});

/** Just enough of a model for the graded checks: ply 2 is graded. */
const MODEL = {
  moves: [0, 1, 2, 3].map((ply) => ({ ply, grade: ply === 2 ? "blunder" : null })),
} as unknown as ReviewModel;

describe("stepping in the review", () => {
  it("arrow keys step one move, and not while a moment waits for a move", () => {
    const store = liemGame("white", FOOLS_MATE);
    store.dispatch(openReview());
    const review = () => store.getState().review;
    expect(review().cursor).toBe(4);
    expect(keyStep({ key: "ArrowLeft" }, review())).toBe(3);
    expect(keyStep({ key: "ArrowRight" }, review())).toBeNull();
    expect(keyStep({ key: "ArrowLeft", shiftKey: true }, review())).toBeNull();

    store.dispatch(momentOpened(2));
    expect(keyStep({ key: "ArrowLeft" }, review())).toBeNull();
    store.dispatch(answerShown(2));
    expect(keyStep({ key: "ArrowLeft" }, review())).toBe(1);
  });

  it("selecting a flagged move reopens the sheet; any other only moves the cursor", () => {
    const store = liemGame("white", FOOLS_MATE);
    store.dispatch(openReview());
    store.dispatch({ type: "review/sheetClosed" });
    store.dispatch(selectPosition(2, MODEL)); // after ply 1, not graded
    expect(store.getState().review.cursor).toBe(2);
    expect(store.getState().review.sheetOpen).toBe(false);
    store.dispatch(selectPosition(3, MODEL)); // after ply 2, the blunder
    expect(store.getState().review.cursor).toBe(3);
    expect(store.getState().review.sheetOpen).toBe(true);
  });
});

describe("the review model", () => {
  it("is built from the game, and is null instead of throwing on a broken game", () => {
    const store = liemGame("white", FOOLS_MATE);
    const positions = store.getState().board.engineHistory;
    const input = {
      positions,
      humanColor: "white" as const,
      evals: positions.map(() => null),
      books: null,
      locked: [],
    };
    const model = reviewModel(input);
    expect(model?.total).toBe(5);
    expect(model?.moves.map((m) => m.uci)).toEqual(FOOLS_MATE);

    // Positions that aren't one move apart.
    expect(reviewModel({ ...input, positions: [positions[0], positions[2]], evals: [null, null] })).toBeNull();
  });
});

describe("a sparring game", () => {
  /** His books: after 1.f3 he has played 1...e5 in 10 games, and nothing more. */
  const afterF3 = positionKey(applyMove(initialGameState(), uciToMove(initialGameState(), "f2f3")!));
  const book = (name: BookName): Book => ({
    format: 1,
    player: "le-quang-liem",
    book: name,
    minGames: 1,
    games: 10,
    gamesBySource: { otb: 0, lichess: 0, chesscom: 10 },
    positions: { [afterF3]: [["e7e5", 5, 1, 4, 0, 0, 10]] },
  });

  it("review after a sparring game", () => {
    // From the card the page opens with: 1400, White, Start game, then Fool's mate.
    const store = createAppStore();
    store.dispatch(setStrength(1400));
    store.dispatch(startLiemGame());
    play(store, FOOLS_MATE);
    expect(store.getState().match.strength).toBe(1400);
    expect(store.getState().board.gameOver).toBe(GameOverType.Win);

    // Review game is offered and opens.
    expect(can(store)).toBe(true);
    store.dispatch(openReview());
    expect(store.getState().review.open).toBe(true);

    // The review builds with his books, and says where the game left them.
    const positions = store.getState().board.engineHistory;
    const model = reviewModel({
      positions,
      humanColor: "white",
      evals: positions.map(() => null),
      books: { slow: book("slow"), online: book("online") },
      locked: [],
    });
    expect(model).not.toBeNull();
    expect(model!.leftBook).not.toBeNull();
    const note = renderToStaticMarkup(React.createElement(LeftBookNote, { model: model! }));
    expect(note).toMatch(/Left his book at move \d/);
  });
});
