import { afterEach, describe, expect, it, vi } from "vitest";
import { applyMove } from "../../engine/engine";
import {
  EngineSquare,
  GameState,
  initialGameState,
} from "../../engine/game-state";
import { PieceType } from "../../piece-type";
import { lookupBook } from "../book";
import { EngineError, type MoveEngine } from "../engine/move-engine";
import { createOpponent, OpponentError } from "../opponent";
import { positionKey, toFen, uciToMove } from "../position";
import type { Book, BookMove, BookName } from "../types";

const P = PieceType;
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const SETTINGS = { elo: 2100, clock: null };

// ---- fixtures ---------------------------------------------------------------

/** Play UCI moves from `state`, failing loudly if any is rejected. */
function play(state: GameState, ...ucis: string[]): GameState {
  return ucis.reduce((s, uci) => {
    const move = uciToMove(s, uci);
    if (move === null) throw new Error(`rejected ${uci}`);
    return applyMove(s, move);
  }, state);
}

const NO_RIGHTS = {
  white: { kingSide: false, queenSide: false },
  black: { kingSide: false, queenSide: false },
};

/** A custom position from `{ e1: piece, ... }`, no castling rights by default. */
function board(
  pieces: Record<string, PieceType>,
  overrides: Partial<GameState> = {}
): GameState {
  const grid: EngineSquare[][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => null as EngineSquare)
  );
  for (const [sq, piece] of Object.entries(pieces)) {
    grid[8 - Number(sq[1])]["abcdefgh".indexOf(sq[0])] = piece;
  }
  return { ...initialGameState(), squares: grid, castling: NO_RIGHTS, ...overrides };
}

/** A book move with all its games from one source (OTB) and all wins. */
function bm(uci: string, games: number): BookMove {
  return [uci, games, 0, 0, games, 0, 0];
}

function makeBook(name: BookName, positions: Record<string, BookMove[]>): Book {
  return {
    format: 1,
    player: "fixture",
    book: name,
    minGames: 1,
    games: 0,
    gamesBySource: { otb: 0, lichess: 0, chesscom: 0 },
    positions,
  };
}

function makeBooks(
  slow: Record<string, BookMove[]> = {},
  online: Record<string, BookMove[]> = {}
): Record<BookName, Book> {
  return { slow: makeBook("slow", slow), online: makeBook("online", online) };
}

// ---- fake engine ------------------------------------------------------------

type Answer =
  | string
  | null
  | Error
  | ((signal: AbortSignal | undefined) => Promise<string | null>);

/** A scripted MoveEngine: each bestMove call takes the next answer. */
function fakeEngine(...answers: Answer[]) {
  const calls: {
    fen: string;
    opts: { elo: number; movetimeMs?: number };
    signal: AbortSignal | undefined;
  }[] = [];
  let disposed = 0;
  let newGames = 0;
  /** What reached the engine, in order: "search", "abort", "newGame". */
  const events: string[] = [];
  const engine: MoveEngine = {
    bestMove(fen, opts, signal) {
      calls.push({ fen, opts, signal });
      events.push("search");
      signal?.addEventListener("abort", () => events.push("abort"));
      const answer = answers.shift();
      if (answer === undefined) return Promise.reject(new Error("unscripted call"));
      if (typeof answer === "function") return answer(signal);
      if (answer instanceof Error) return Promise.reject(answer);
      return Promise.resolve(answer);
    },
    newGame() {
      newGames += 1;
      events.push("newGame");
    },
    dispose() {
      disposed += 1;
    },
  };
  return { engine, calls, events, disposed: () => disposed, newGames: () => newGames };
}

/** An answer that waits until its search is aborted, then rejects `aborted`. */
const untilAborted = (signal: AbortSignal | undefined) =>
  new Promise<string | null>((_, reject) => {
    signal?.addEventListener("abort", () => reject(new EngineError("aborted")));
  });

/** An answer the test resolves by hand; it ignores the abort signal. */
function deferred() {
  let resolve!: (uci: string | null) => void;
  const promise = new Promise<string | null>((r) => (resolve = r));
  return { answer: () => promise, resolve };
}

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(OpponentError);
    return (e as OpponentError).code;
  }
  throw new Error("expected a rejection");
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

afterEach(() => {
  vi.useRealTimers();
});

// ---- tests ------------------------------------------------------------------

describe("book move first", () => {
  const start = initialGameState();
  const key = positionKey(start);

  it("returns a weighted book move with the lookup, and never calls the engine", async () => {
    const books = makeBooks({ [key]: [bm("e2e4", 3), bm("d2d4", 1)] });
    const fake = fakeEngine();
    const opponent = createOpponent({ books, engine: fake.engine });

    const first = await opponent.chooseMove(start, { ...SETTINGS, random: () => 0 });
    expect(first).toEqual({
      move: uciToMove(start, "e2e4"),
      uci: "e2e4",
      source: "book",
      lookup: lookupBook(books, start, null),
    });

    const second = await opponent.chooseMove(start, { ...SETTINGS, random: () => 0.8 });
    expect(second.uci).toBe("d2d4");
    expect(second.move).toEqual(uciToMove(start, "d2d4"));
    expect(fake.calls).toHaveLength(0);
  });

  it("reads the book the clock picks", async () => {
    const books = makeBooks(
      { [key]: [bm("e2e4", 5)] },
      { [key]: [bm("c2c4", 5)] }
    );
    const opponent = createOpponent({ books, engine: fakeEngine().engine });
    const blitz = { baseMs: 180_000, incrementMs: 2000 };
    const choice = await opponent.chooseMove(start, { elo: 2100, clock: blitz });
    expect(choice.uci).toBe("c2c4");
    expect(choice.lookup?.book).toBe("online");
  });

  it("uses Math.random when no random is given", async () => {
    const books = makeBooks({ [key]: [bm("e2e4", 3), bm("d2d4", 1)] });
    const opponent = createOpponent({ books, engine: fakeEngine().engine });
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.9);
    try {
      expect((await opponent.chooseMove(start, SETTINGS)).uci).toBe("d2d4");
    } finally {
      spy.mockRestore();
    }
  });
});

describe("illegal book moves are dropped", () => {
  const start = initialGameState();
  const key = positionKey(start);

  it("skips an illegal move and re-weighs the rest", async () => {
    // e2e5 is illegal. Among the rest (1:1), r = 0.6 passes a's 0.5 share.
    const books = makeBooks({
      [key]: [bm("e2e5", 10), bm("d2d4", 1), bm("g1f3", 1)],
    });
    const fake = fakeEngine();
    const opponent = createOpponent({ books, engine: fake.engine });

    expect((await opponent.chooseMove(start, { ...SETTINGS, random: () => 0 })).uci).toBe("d2d4");
    expect((await opponent.chooseMove(start, { ...SETTINGS, random: () => 0.6 })).uci).toBe("g1f3");
    expect(fake.calls).toHaveLength(0);
  });

  it("drops malformed text and a promotion suffix on a quiet move", async () => {
    const books = makeBooks({ [key]: [bm("junk", 5), bm("e2e4q", 5), bm("c2c4", 1)] });
    const opponent = createOpponent({ books, engine: fakeEngine().engine });
    expect((await opponent.chooseMove(start, { ...SETTINGS, random: () => 0 })).uci).toBe("c2c4");
  });

  it("uses the engine when every book move is illegal, and keeps the lookup", async () => {
    const books = makeBooks({ [key]: [bm("e2e5", 4), bm("e7e5", 2)] });
    const fake = fakeEngine("g1f3");
    const opponent = createOpponent({ books, engine: fake.engine });

    const choice = await opponent.chooseMove(start, { ...SETTINGS, random: () => 0 });
    expect(choice.source).toBe("engine");
    expect(choice.uci).toBe("g1f3");
    expect(choice.lookup).toEqual(lookupBook(books, start, null));
    expect(fake.calls).toHaveLength(1);
  });
});

describe("engine move through legalMoves", () => {
  it("sends toFen(state) and the elo, and returns our Move", async () => {
    const start = initialGameState();
    const fake = fakeEngine("g1f3");
    const opponent = createOpponent({ books: makeBooks(), engine: fake.engine });

    const choice = await opponent.chooseMove(start, { elo: 1700, clock: null });
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0].fen).toBe(toFen(start));
    expect(fake.calls[0].fen).toBe(START_FEN);
    expect(fake.calls[0].opts).toEqual({ elo: 1700 });
    expect(fake.calls[0].signal).toBeInstanceOf(AbortSignal);
    expect(choice).toEqual({
      move: { from: [7, 6], to: [5, 5] },
      uci: "g1f3",
      source: "engine",
      lookup: null,
    });
  });

  it("handles castling, en passant and a promotion", async () => {
    const castle = board(
      { e1: P.WhiteKing, h1: P.WhiteKingRook, e8: P.BlackKing },
      { castling: { ...NO_RIGHTS, white: { kingSide: true, queenSide: false } } }
    );
    const ep = play(initialGameState(), "e2e4", "a7a6", "e4e5", "d7d5");
    const promo = board({ e1: P.WhiteKing, h8: P.BlackKing, b7: P.WhitePawnB });

    const fake = fakeEngine("e1g1", "e5d6", "b7b8n");
    const opponent = createOpponent({ books: makeBooks(), engine: fake.engine });

    const c = await opponent.chooseMove(castle, SETTINGS);
    expect(c.move).toEqual({ from: [7, 4], to: [7, 6] });
    expect(applyMove(castle, c.move).squares[7][5]).toBe(P.WhiteKingRook);

    const e = await opponent.chooseMove(ep, SETTINGS);
    expect(e.move).toEqual({ from: [3, 4], to: [2, 3] });
    expect(applyMove(ep, e.move).squares[3][3]).toBeNull();

    const p = await opponent.chooseMove(promo, SETTINGS);
    expect(p.move).toEqual({ from: [1, 1], to: [0, 1], promotion: "knight" });
    expect(p.uci).toBe("b7b8n");

    expect(fake.calls.map((c) => c.fen)).toEqual([
      toFen(castle),
      toFen(ep),
      toFen(promo),
    ]);
  });
});

describe("rejects engine moves not in legalMoves", () => {
  const start = initialGameState();

  it("asks once more after an illegal answer, and uses the second", async () => {
    const fake = fakeEngine("e2e5", "d2d4");
    const opponent = createOpponent({ books: makeBooks(), engine: fake.engine });
    const choice = await opponent.chooseMove(start, SETTINGS);
    expect(choice.uci).toBe("d2d4");
    expect(fake.calls).toHaveLength(2);
    expect(fake.calls[1].fen).toBe(START_FEN);
  });

  it("asks once more after a null answer", async () => {
    const fake = fakeEngine(null, "c2c4");
    const opponent = createOpponent({ books: makeBooks(), engine: fake.engine });
    expect((await opponent.chooseMove(start, SETTINGS)).uci).toBe("c2c4");
    expect(fake.calls).toHaveLength(2);
  });

  it("rejects illegal-engine-move after two bad answers, asking only twice", async () => {
    for (const pair of [
      ["e2e5", "e7e5"],
      [null, null],
      ["e2e4q", null],
    ] as const) {
      const fake = fakeEngine(...pair);
      const opponent = createOpponent({ books: makeBooks(), engine: fake.engine });
      expect(await codeOf(opponent.chooseMove(start, SETTINGS))).toBe("illegal-engine-move");
      expect(fake.calls).toHaveLength(2);
    }
  });

  it("rejects a promotion without its suffix", async () => {
    const promo = board({ e1: P.WhiteKing, h8: P.BlackKing, b7: P.WhitePawnB });
    const fake = fakeEngine("b7b8", "b7b8");
    const opponent = createOpponent({ books: makeBooks(), engine: fake.engine });
    expect(await codeOf(opponent.chooseMove(promo, SETTINGS))).toBe("illegal-engine-move");
  });
});

describe("no legal moves", () => {
  it("rejects checkmate and stalemate without calling the engine", async () => {
    const mated = play(initialGameState(), "f2f3", "e7e5", "g2g4", "d8h4");
    const stalemate = board(
      { a8: P.BlackKing, b6: P.WhiteQueen, h1: P.WhiteKing },
      { turn: "black" }
    );
    // Even a book entry for the position must not be used.
    const books = makeBooks({ [positionKey(mated)]: [bm("e1f2", 5)] });
    const fake = fakeEngine("e1f2", "a8b8");
    const opponent = createOpponent({ books, engine: fake.engine });

    expect(await codeOf(opponent.chooseMove(mated, SETTINGS))).toBe("no-legal-moves");
    expect(await codeOf(opponent.chooseMove(stalemate, SETTINGS))).toBe("no-legal-moves");
    expect(fake.calls).toHaveLength(0);
  });
});

describe("repeats and engine failures", () => {
  const start = initialGameState();

  it("a second chooseMove aborts the first engine call; the first rejects superseded", async () => {
    const fake = fakeEngine(untilAborted, "d2d4");
    const opponent = createOpponent({ books: makeBooks(), engine: fake.engine });

    const first = opponent.chooseMove(start, SETTINGS);
    const firstCode = codeOf(first);
    await flush();
    expect(fake.calls[0].signal?.aborted).toBe(false);

    const second = opponent.chooseMove(start, SETTINGS);
    expect(fake.calls[0].signal?.aborted).toBe(true);
    expect(await firstCode).toBe("superseded");
    expect((await second).uci).toBe("d2d4");
  });

  it("the first rejects superseded even if its engine answers anyway", async () => {
    const late = deferred();
    const fake = fakeEngine(late.answer, "d2d4");
    const opponent = createOpponent({ books: makeBooks(), engine: fake.engine });

    const firstCode = codeOf(opponent.chooseMove(start, SETTINGS));
    await flush();
    const second = opponent.chooseMove(start, SETTINGS);
    expect((await second).uci).toBe("d2d4");
    late.resolve("e2e4");
    expect(await firstCode).toBe("superseded");
  });

  it("a superseded call does not ask the engine again after a bad answer", async () => {
    const late = deferred();
    const fake = fakeEngine(late.answer, "d2d4");
    const opponent = createOpponent({ books: makeBooks(), engine: fake.engine });

    const firstCode = codeOf(opponent.chooseMove(start, SETTINGS));
    await flush();
    const second = opponent.chooseMove(start, SETTINGS);
    late.resolve("e2e5"); // illegal: a live call would retry
    expect(await firstCode).toBe("superseded");
    expect((await second).uci).toBe("d2d4");
    await flush();
    expect(fake.calls).toHaveLength(2);
  });

  it("maps engine timeout, failed and disposed, and other errors to engine-failed", async () => {
    const cases: [Error, string][] = [
      [new EngineError("timeout"), "engine-timeout"],
      [new EngineError("failed"), "engine-failed"],
      [new EngineError("disposed"), "disposed"],
      [new RangeError("bad elo"), "engine-failed"],
    ];
    for (const [error, code] of cases) {
      const fake = fakeEngine(error);
      const opponent = createOpponent({ books: makeBooks(), engine: fake.engine });
      expect(await codeOf(opponent.chooseMove(start, SETTINGS))).toBe(code);
      // An engine failure is not retried.
      expect(fake.calls).toHaveLength(1);
    }
  });

  it("keeps the engine error as the cause", async () => {
    const error = new EngineError("timeout");
    const opponent = createOpponent({ books: makeBooks(), engine: fakeEngine(error).engine });
    try {
      await opponent.chooseMove(start, SETTINGS);
      throw new Error("expected a rejection");
    } catch (e) {
      expect((e as OpponentError).cause).toBe(error);
    }
  });

  it("works again after a failed move", async () => {
    const fake = fakeEngine(new EngineError("timeout"), "e2e4");
    const opponent = createOpponent({ books: makeBooks(), engine: fake.engine });
    expect(await codeOf(opponent.chooseMove(start, SETTINGS))).toBe("engine-timeout");
    expect((await opponent.chooseMove(start, SETTINGS)).uci).toBe("e2e4");
  });

  it("dispose rejects the move in flight and every later one with disposed", async () => {
    const fake = fakeEngine(untilAborted, "e2e4");
    const opponent = createOpponent({ books: makeBooks(), engine: fake.engine });

    const inFlight = codeOf(opponent.chooseMove(start, SETTINGS));
    await flush();
    opponent.dispose();
    expect(await inFlight).toBe("disposed");
    expect(fake.disposed()).toBe(1);

    expect(await codeOf(opponent.chooseMove(start, SETTINGS))).toBe("disposed");
    expect(fake.calls).toHaveLength(1);
    opponent.dispose();
    expect(fake.disposed()).toBe(1);
  });
});

describe("new game", () => {
  const start = initialGameState();

  it("newGame resets the engine", async () => {
    // The move in flight rejects superseded; the engine hears abort, then newGame, once.
    const fake = fakeEngine(untilAborted, "e2e4");
    const opponent = createOpponent({ books: makeBooks(), engine: fake.engine });
    const inFlight = codeOf(opponent.chooseMove(start, SETTINGS));
    await flush();
    opponent.newGame();
    expect(await inFlight).toBe("superseded");
    expect(fake.newGames()).toBe(1);
    expect(fake.events).toEqual(["search", "abort", "newGame"]);

    // The next game plays on.
    expect((await opponent.chooseMove(start, SETTINGS)).uci).toBe("e2e4");
    expect(fake.newGames()).toBe(1);

    // After dispose, newGame neither throws nor reaches the engine.
    opponent.dispose();
    expect(() => opponent.newGame()).not.toThrow();
    expect(fake.newGames()).toBe(1);
  });

  it("a move whose engine answers after newGame still rejects superseded", async () => {
    const late = deferred();
    const fake = fakeEngine(late.answer);
    const opponent = createOpponent({ books: makeBooks(), engine: fake.engine });
    const inFlight = codeOf(opponent.chooseMove(start, SETTINGS));
    await flush();
    opponent.newGame();
    late.resolve("e2e4");
    expect(await inFlight).toBe("superseded");
  });

  it("an illegal late answer after newGame is not asked again", async () => {
    const late = deferred();
    const fake = fakeEngine(late.answer);
    const opponent = createOpponent({ books: makeBooks(), engine: fake.engine });
    const inFlight = codeOf(opponent.chooseMove(start, SETTINGS));
    await flush();
    opponent.newGame();
    late.resolve("e2e5");
    expect(await inFlight).toBe("superseded");
    expect(fake.calls).toHaveLength(1);
  });

  it("newGame with nothing in flight just resets the engine", async () => {
    const fake = fakeEngine("e2e4");
    const opponent = createOpponent({ books: makeBooks(), engine: fake.engine });
    opponent.newGame();
    opponent.newGame();
    expect(fake.newGames()).toBe(2);
    expect((await opponent.chooseMove(start, SETTINGS)).uci).toBe("e2e4");
  });

  it("an engine failure that lands after newGame reads superseded, not engine-failed", async () => {
    let fail!: (e: Error) => void;
    const fake = fakeEngine(() => new Promise<string | null>((_, reject) => (fail = reject)));
    const opponent = createOpponent({ books: makeBooks(), engine: fake.engine });
    const inFlight = codeOf(opponent.chooseMove(start, SETTINGS));
    await flush();
    opponent.newGame();
    fail(new EngineError("timeout"));
    expect(await inFlight).toBe("superseded");
  });
});

describe("no added delay", () => {
  const start = initialGameState();

  /** Settles `p` using only microtasks; fails if it needs a timer. */
  async function settlesWithoutTimers(p: Promise<unknown>) {
    let settled = false;
    p.then(
      () => (settled = true),
      () => (settled = true)
    );
    for (let i = 0; i < 50 && !settled; i++) await Promise.resolve();
    expect(settled).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  }

  it("an engine move settles in the same microtask chain", async () => {
    vi.useFakeTimers();
    const opponent = createOpponent({ books: makeBooks(), engine: fakeEngine("e2e4").engine });
    await settlesWithoutTimers(opponent.chooseMove(start, SETTINGS));
  });

  it("a book move and a retried engine move settle the same way", async () => {
    vi.useFakeTimers();
    const books = makeBooks({ [positionKey(start)]: [bm("e2e4", 3)] });
    const inBook = createOpponent({ books, engine: fakeEngine().engine });
    await settlesWithoutTimers(inBook.chooseMove(start, SETTINGS));

    const retried = createOpponent({ books: makeBooks(), engine: fakeEngine(null, "e2e4").engine });
    await settlesWithoutTimers(retried.chooseMove(start, SETTINGS));
  });
});
