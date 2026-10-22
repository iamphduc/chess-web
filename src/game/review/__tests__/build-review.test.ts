import { describe, expect, it } from "vitest";
import { applyMove } from "../../engine/engine";
import { GameState, initialGameState, PieceColor } from "../../engine/game-state";
import type { GameClock } from "../../opponent/book";
import { positionKey, uciToMove } from "../../opponent/position";
import type { Book, BookMove, BookName } from "../../opponent/types";
import { buildReview, pickKeyMoments } from "../build-review";
import { moveAccuracy } from "../grade";
import type { BuildReviewInput, PositionEval } from "../types";

const CLOCK: GameClock = { baseMs: 10 * 60_000, incrementMs: 0 };

/** Every position of a game from the start, start included. */
function positionsOf(ucis: readonly string[]): GameState[] {
  const out = [initialGameState()];
  for (const uci of ucis) {
    const last = out[out.length - 1];
    const move = uciToMove(last, uci);
    if (move === null) throw new Error(`rejected ${uci}`);
    out.push(applyMove(last, move));
  }
  return out;
}

// Human White: plies 0, 2, 4, 6, 8 are his; Liem plays 1, 3, 5, 7, 9.
const GAME = [
  "e2e4", "e7e5",
  "g1f3", "b8c6",
  "f1c4", "g8f6",
  "d2d3", "f8c5",
  "b1c3", "d7d6",
];
const POS = positionsOf(GAME);

/** The cp score whose win % is `win` (the inverse of the Lichess formula). */
function cpFor(win: number): number {
  const p = (win - 50) / 50;
  return -Math.log((1 - p) / (1 + p)) / 0.00368208;
}

/**
 * Evals from the human's win % per position (`null` = not analysed), turned
 * into the side to move's view. `best` is a legal move there when given.
 */
function evalsFrom(
  wins: readonly (number | null)[],
  human: PieceColor = "white",
  best: Record<number, string> = {}
): (PositionEval | null)[] {
  return wins.map((w, i) => {
    if (w === null) return null;
    const own = POS[i].turn === human;
    return { score: { cp: own ? cpFor(w) : -cpFor(w) }, best: best[i] ?? null };
  });
}

function bm(uci: string, games: number): BookMove {
  return [uci, games, 0, 0, games, 0, 0];
}

function makeBooks(positions: Record<string, BookMove[]>): Record<BookName, Book> {
  const book = (name: BookName): Book => ({
    format: 1,
    player: "fixture",
    book: name,
    minGames: 1,
    games: 0,
    gamesBySource: { otb: 0, lichess: 0, chesscom: 0 },
    positions: name === "online" ? positions : {},
  });
  return { slow: book("slow"), online: book("online") };
}

/** Book entries at the given positions of POS. */
function booksAt(entries: Record<number, BookMove[]>): Record<BookName, Book> {
  const positions: Record<string, BookMove[]> = {};
  for (const [i, moves] of Object.entries(entries)) positions[positionKey(POS[Number(i)])] = moves;
  return makeBooks(positions);
}

function input(over: Partial<BuildReviewInput> = {}): BuildReviewInput {
  return {
    positions: POS,
    humanColor: "white",
    clock: CLOCK,
    evals: POS.map(() => null),
    books: null,
    locked: [],
    ...over,
  };
}

// Human win % per position: flat at 50 unless a test says otherwise.
const FLAT = POS.map(() => 50);

describe("moves", () => {
  it("lists every ply with its label, UCI and side", () => {
    const model = buildReview(input());
    expect(model.moves.map((m) => m.label)).toEqual([
      "1.e4", "1...e5", "2.Nf3", "2...Nc6", "3.Bc4", "3...Nf6", "4.d3", "4...Bc5", "5.Nc3", "5...d6",
    ]);
    expect(model.moves.map((m) => m.uci)).toEqual(GAME);
    expect(model.moves.map((m) => m.byHuman)).toEqual(GAME.map((_, i) => i % 2 === 0));
    expect(model.moves.map((m) => m.ply)).toEqual(GAME.map((_, i) => i));
    expect(model.total).toBe(11);
    expect(model.analysed).toBe(0);
    expect(model.whiteWin).toEqual(POS.map(() => null));
  });

  it("grades his plies with the same rule and levels as yours", () => {
    const wins = [...FLAT];
    wins[2] = 90; // his ply 1 lifts your win from 50 to 90: he lost 40 points
    wins[4] = 90;
    wins[5] = 60;
    wins[6] = 75; // his ply 5: 60 → 75 for you, he lost 15
    wins[7] = 75;
    wins[8] = 75; // his ply 7 holds: no grade
    const model = buildReview(input({ evals: evalsFrom(wins) }));
    expect(model.moves[1]).toMatchObject({ byHuman: false, grade: "blunder", bookGames: null });
    expect(model.moves[1].drop).toBeCloseTo(40, 6);
    expect(model.moves[1].accuracy).toBeCloseTo(moveAccuracy(50, 10), 6);
    expect(model.moves[5].grade).toBe("inaccuracy");
    expect(model.moves[7]).toMatchObject({ grade: null });
    expect(model.moves[7].drop).toBeCloseTo(0, 6);
  });

  it("his marks stay out of your counts and key moments", () => {
    const wins = POS.map((_, i) => (i >= 2 ? 90 : 50)); // only his ply 1 moves the eval
    const model = buildReview(input({ evals: evalsFrom(wins) }));
    expect(model.moves[1].grade).toBe("blunder");
    expect(model.counts).toEqual({ inaccuracy: 0, mistake: 0, blunder: 0 });
    expect(model.keyMoments).toEqual([]);
  });

  it("a locked ply of his never becomes a key moment", () => {
    const wins = POS.map((_, i) => (i >= 2 ? 90 : 50)); // only his ply 1 moves the eval
    const model = buildReview(input({ evals: evalsFrom(wins), locked: [1] }));
    expect(model.keyMoments).toEqual([]);
  });

  it("grades his plies as Black's moves when you play Black", () => {
    const wins = POS.map((_, i) => (i >= 1 ? 90 : 50)); // his ply 0 (White) lifts your win from 50 to 90
    const model = buildReview(input({ humanColor: "black", evals: evalsFrom(wins, "black") }));
    expect(model.moves[0]).toMatchObject({ byHuman: false, grade: "blunder" });
    expect(model.counts).toEqual({ inaccuracy: 0, mistake: 0, blunder: 0 });
  });

  it("whiteWin is White's win % per analysed position, and counts analysed", () => {
    const wins: (number | null)[] = [...FLAT];
    wins[3] = 70;
    wins[4] = null;
    const model = buildReview(input({ humanColor: "white", evals: evalsFrom(wins) }));
    expect(model.whiteWin[3]).toBeCloseTo(70, 6);
    expect(model.whiteWin[4]).toBeNull();
    expect(model.analysed).toBe(10);
  });

  it("whiteWin for a Black human is 100 minus his win", () => {
    const wins = [...FLAT];
    wins[3] = 70;
    const model = buildReview(input({ humanColor: "black", evals: evalsFrom(wins, "black") }));
    expect(model.whiteWin[3]).toBeCloseTo(30, 6);
  });

  it("treats evals missing from a short array as not analysed", () => {
    const model = buildReview(input({ evals: evalsFrom(FLAT).slice(0, 3) }));
    expect(model.analysed).toBe(3);
    expect(model.moves[2].drop).toBeNull();
  });
});

describe("book moves are never flagged", () => {
  it("a human move into a book position scores 100 and carries its games, even with a 50-point drop", () => {
    const wins = [...FLAT];
    wins[0] = 75;
    wins[1] = 25;
    const model = buildReview(
      input({ evals: evalsFrom(wins), books: booksAt({ 1: [bm("e7e5", 30), bm("c7c5", 10)] }) })
    );
    expect(model.moves[0]).toMatchObject({ byHuman: true, bookGames: 40, accuracy: 100, grade: null });
    expect(model.counts).toEqual({ inaccuracy: 0, mistake: 0, blunder: 0 });
    expect(model.keyMoments).toEqual([]);
  });

  it("a book move scores 100 before it's analysed", () => {
    const model = buildReview(input({ books: booksAt({ 1: [bm("e7e5", 5)] }) }));
    expect(model.moves[0]).toMatchObject({ bookGames: 5, accuracy: 100, grade: null });
  });

  it("only human moves carry book games", () => {
    const model = buildReview(input({ books: booksAt({ 2: [bm("g1f3", 5)] }) }));
    expect(model.moves[1].bookGames).toBeNull();
  });
});

describe("his moves in his book", () => {
  // You leave his book with 3.Bc4 (ply 4): his plies 1 and 3 came before that.
  const BOOKS = booksAt({ 1: [bm("e7e5", 30)], 3: [bm("b8c6", 20)], 4: [bm("f1c4", 5)] });
  /** Your win jumps by 40 on each of his plies, then comes back on yours. */
  const swings = (): number[] => POS.map((_, i) => (i % 2 === 0 ? 50 : 10));

  it("are never graded before he leaves his book; after it they are", () => {
    const model = buildReview(input({ evals: evalsFrom(swings()), books: BOOKS }));
    expect(model.bookPlies).toBe(4);
    for (const ply of [1, 3]) {
      expect(model.moves[ply]).toMatchObject({ drop: null, accuracy: null, grade: null, bookGames: null });
    }
    expect(model.moves[5].grade).toBe("blunder");
    expect(model.moves[7].grade).toBe("blunder");
  });

  it("are never graded in a game that stayed in his book", () => {
    const books = booksAt({ 1: [bm("e7e5", 9)], 3: [bm("b8c6", 9)], 5: [bm("g8f6", 9)], 7: [bm("f8c5", 9)], 9: [bm("d7d6", 9)] });
    const model = buildReview(input({ evals: evalsFrom(swings()), books }));
    expect(model.moves.filter((m) => !m.byHuman).every((m) => m.grade === null && m.drop === null)).toBe(true);
  });

  it("are graded from his first move without his books", () => {
    const model = buildReview(input({ evals: evalsFrom(swings()), books: null }));
    expect(model.moves[1].grade).toBe("blunder");
  });

  it("when he's White, his first move is in his book until you leave it", () => {
    // You play Black and leave his book with 1...e5 (ply 1): his ply 0 came before it.
    const wins = POS.map((_, i) => (i % 2 === 1 ? 50 : 10));
    const books = booksAt({ 0: [bm("e2e4", 50)] });
    const model = buildReview(input({ humanColor: "black", evals: evalsFrom(wins, "black"), books }));
    expect(model.bookPlies).toBe(1);
    expect(model.moves[0]).toMatchObject({ byHuman: false, grade: null, drop: null });
    expect(model.moves[2].grade).toBe("blunder");
  });
});

describe("the engine's best move is never graded", () => {
  it("your move that is Stockfish's best scores 0 and 100 with no grade, even when the next search scores it lower", () => {
    const wins = [...FLAT];
    wins[3] = 15; // ply 2 (2.Nf3) drops 35 by the next search
    const model = buildReview(input({ evals: evalsFrom(wins, "white", { 2: "g1f3" }) }));
    expect(model.moves[2]).toMatchObject({ drop: 0, accuracy: 100, grade: null });
    expect(model.counts).toEqual({ inaccuracy: 0, mistake: 0, blunder: 0 });
    expect(model.keyMoments).toEqual([]);
  });

  it("stays out of the key moments even when it was locked", () => {
    const wins = [...FLAT];
    wins[3] = 15;
    const model = buildReview(input({ evals: evalsFrom(wins, "white", { 2: "g1f3" }), locked: [2] }));
    expect(model.keyMoments).toEqual([]);
  });

  it("his move that is Stockfish's best has no mark", () => {
    const wins = [...FLAT];
    wins[2] = 90; // ply 1 (1...e5) costs him 40 by the next search
    const model = buildReview(input({ evals: evalsFrom(wins, "white", { 1: "e7e5" }) }));
    expect(model.moves[1]).toMatchObject({ drop: 0, accuracy: 100, grade: null });
  });

  it("holds before the position after it is analysed", () => {
    const wins: (number | null)[] = [...FLAT];
    wins[3] = null;
    const model = buildReview(input({ evals: evalsFrom(wins, "white", { 2: "g1f3" }) }));
    expect(model.moves[2]).toMatchObject({ drop: 0, accuracy: 100, grade: null });
  });

  it("a mate rule doesn't grade it either", () => {
    const evals = evalsFrom(FLAT, "white", { 2: "g1f3" });
    evals[2] = { score: { mate: 3 }, best: "g1f3" };
    evals[3] = { score: { cp: 0 }, best: null }; // the mate is gone by the next search
    const model = buildReview(input({ evals }));
    expect(model.moves[2]).toMatchObject({ drop: 0, accuracy: 100, grade: null });
  });

  it("another move than the best is still graded", () => {
    const wins = [...FLAT];
    wins[3] = 15;
    const model = buildReview(input({ evals: evalsFrom(wins, "white", { 2: "f1c4" }) }));
    expect(model.moves[2].grade).toBe("blunder");
    expect(model.keyMoments.map((k) => k.ply)).toEqual([2]);
  });
});

describe("no books", () => {
  it("gives no book moves, bookPlies 0 and leftBook null", () => {
    const wins = [...FLAT];
    wins[1] = 5;
    const model = buildReview(input({ evals: evalsFrom(wins), books: null }));
    expect(model.moves.every((m) => m.bookGames === null)).toBe(true);
    expect(model.bookPlies).toBe(0);
    expect(model.leftBook).toBeNull();
    expect(model.moves[0].grade).toBe("blunder");
  });
});

describe("left his book", () => {
  it("is the first out-of-book human move, with his moves there by games", () => {
    const books = booksAt({
      1: [bm("e7e5", 30)],
      3: [bm("b8c6", 20)],
      4: [bm("f1c4", 5), bm("f1b5", 20)],
    });
    // positions[5] (after 3.Bc4) isn't in his book.
    const model = buildReview(input({ books }));
    expect(model.leftBook).toEqual({
      ply: 4,
      played: { uci: "f1c4", label: "3.Bc4" },
      his: [
        { uci: "f1b5", label: "3.Bb5", games: 20 },
        { uci: "f1c4", label: "3.Bc4", games: 5 },
      ],
    });
    expect(model.bookPlies).toBe(4);
    expect(model.moves.slice(0, 4).filter((m) => m.byHuman).map((m) => m.bookGames)).toEqual([30, 20]);
  });

  it("has no moves of his when the position before isn't in his book", () => {
    const model = buildReview(input({ books: booksAt({ 1: [bm("e7e5", 30)] }) }));
    expect(model.leftBook).toEqual({ ply: 2, played: { uci: "g1f3", label: "2.Nf3" }, his: [] });
    expect(model.bookPlies).toBe(2);
  });

  it("skips a stored move that isn't legal there", () => {
    const books = booksAt({ 1: [bm("e7e5", 30)], 2: [bm("g1f3", 9), bm("e1e3", 99)] });
    const model = buildReview(input({ books }));
    expect(model.leftBook?.his).toEqual([{ uci: "g1f3", label: "2.Nf3", games: 9 }]);
  });

  it("is null for a game fully in his book, with bookPlies n", () => {
    const books = booksAt({ 1: [bm("e7e5", 9)], 3: [bm("b8c6", 9)], 5: [bm("g8f6", 9)], 7: [bm("f8c5", 9)], 9: [bm("d7d6", 9)] });
    const model = buildReview(input({ books }));
    expect(model.leftBook).toBeNull();
    expect(model.bookPlies).toBe(10);
  });

  it("the first exit counts even when a later move returns to his book", () => {
    const books = booksAt({ 1: [bm("e7e5", 9)], 5: [bm("g8f6", 9)] });
    const model = buildReview(input({ books }));
    expect(model.leftBook?.ply).toBe(2);
    expect(model.moves[4]).toMatchObject({ bookGames: 9, grade: null, accuracy: 100 });
  });
});

describe("game accuracy", () => {
  it("is Lichess's game accuracy, with book moves at their real accuracy", () => {
    // Ply 0 is a book move with a 30-point drop; ply 4 drops 11; the rest hold.
    const wins = [50, 20, 20, 20, 40, 29, 29, 29, 29, 29, 29];
    const books = booksAt({ 1: [bm("e7e5", 9)] });
    const model = buildReview(input({ evals: evalsFrom(wins), books }));
    // The per-move numbers don't change: the book move still shows 100.
    expect(model.moves[0]).toMatchObject({ accuracy: 100, grade: null });
    expect(model.moves[4].accuracy).toBeCloseTo(moveAccuracy(40, 29), 6);
    // 10 plies → windows of 2; White's win % is the human's here.
    const acc = (drop: number) =>
      Math.min(100, 103.1668100711649 * Math.exp(-0.04354415386753951 * drop) - 3.166924740191411 + 1);
    // Lichess starts from +15 cp, whatever the engine said about position 0.
    const start = 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * 15)) - 1);
    const plies = [
      { acc: acc(start - 20), w: 12 }, // start → 20, sd above 12 clamped
      { acc: 100, w: 0.5 }, // 20 → 20
      { acc: acc(11), w: 5.5 }, // 40 → 29
      { acc: 100, w: 0.5 },
      { acc: 100, w: 0.5 },
    ];
    const weighted = plies.reduce((s, p) => s + p.acc * p.w, 0) / plies.reduce((s, p) => s + p.w, 0);
    const harmonic = plies.length / plies.reduce((s, p) => s + 1 / p.acc, 0);
    expect(model.accuracy).toBeCloseTo((weighted + harmonic) / 2, 6);
    expect(model.counts).toEqual({ inaccuracy: 1, mistake: 0, blunder: 0 });
  });

  it("starts from Lichess's fixed +15 cp, not the engine's eval of the start", () => {
    const at = (cp: number) => {
      const evals = evalsFrom(FLAT);
      evals[0] = { score: { cp }, best: null };
      return buildReview(input({ evals }));
    };
    const engine = at(200);
    expect(engine.accuracy).toBeCloseTo(at(15).accuracy!, 9);
    // The graph still shows the engine's eval of the start.
    expect(engine.whiteWin[0]).toBeGreaterThan(65);
  });

  it("is null while a book move of the human lacks its evals", () => {
    const wins: (number | null)[] = [...FLAT];
    wins[1] = null;
    const books = booksAt({ 1: [bm("e7e5", 9)] });
    expect(buildReview(input({ evals: evalsFrom(wins), books })).accuracy).toBeNull();
  });

  it("scores a lost game well below the plain average", () => {
    // Steady small losses with one collapse: the plain average hides it.
    const wins = [50, 47, 44, 41, 38, 35, 32, 29, 26, 5, 5];
    const model = buildReview(input({ evals: evalsFrom(wins) }));
    const human = model.moves.filter((m) => m.byHuman);
    const plain = human.reduce((s, m) => s + (m.accuracy ?? 0), 0) / human.length;
    expect(model.accuracy).not.toBeNull();
    expect(model.accuracy!).toBeLessThan(plain - 10);
  });

  it("is null while any human ply lacks its evals", () => {
    const wins: (number | null)[] = [...FLAT];
    wins[9] = null; // after the human's ply 8
    expect(buildReview(input({ evals: evalsFrom(wins) })).accuracy).toBeNull();
  });

  it("doesn't wait for Liem's last ply", () => {
    const wins: (number | null)[] = [...FLAT];
    wins[10] = null; // after Liem's ply 9
    expect(buildReview(input({ evals: evalsFrom(wins) })).accuracy).not.toBeNull();
  });

  it("is null with no human plies", () => {
    const model = buildReview(input({ positions: POS.slice(0, 2), humanColor: "black", evals: [null, null] }));
    expect(model.accuracy).toBeNull();
    expect(model.moves).toHaveLength(1);
    expect(model.moves[0].byHuman).toBe(false);
  });

  it("works for a game with no moves", () => {
    const model = buildReview(input({ positions: POS.slice(0, 1), evals: [null] }));
    expect(model).toMatchObject({ moves: [], total: 1, accuracy: null, keyMoments: [], bookPlies: 0 });
  });
});

/** Human win % so that ply 2k (human) drops by `drops[k]`, holding level otherwise. */
function winsWithDrops(drops: readonly (number | null)[]): (number | null)[] {
  const wins: (number | null)[] = [];
  let w = 80;
  for (let k = 0; k < 5; k++) {
    wins.push(w);
    const d = drops[k];
    if (d === null) {
      wins.push(null);
      continue;
    }
    w -= d;
    wins.push(w);
    w = Math.min(80, w + d); // Liem gives it back
  }
  return [...wins, w].slice(0, 11);
}

describe("key moments pick the biggest drops", () => {
  it("takes the top 3 drops at inaccuracy or worse, in game order", () => {
    const wins = winsWithDrops([12, 35, 9, 25, 15]);
    const model = buildReview(input({ evals: evalsFrom(wins) }));
    expect(model.keyMoments.map((k) => k.ply)).toEqual([2, 6, 8]);
    expect(model.keyMoments.map((k) => k.grade)).toEqual(["blunder", "mistake", "inaccuracy"]);
    expect(model.keyMoments[0].drop).toBeCloseTo(35, 6);
    expect(model.counts).toEqual({ inaccuracy: 2, mistake: 1, blunder: 1 });
  });

  it("gives fewer when fewer are graded", () => {
    const model = buildReview(input({ evals: evalsFrom(winsWithDrops([5, 11, 0, 9.9, 3])) }));
    expect(model.keyMoments.map((k) => k.ply)).toEqual([2]);
    expect(buildReview(input({ evals: evalsFrom(FLAT) })).keyMoments).toEqual([]);
  });

  it("breaks ties by the worse grade, then the earlier ply", () => {
    const picked = pickKeyMoments(
      [
        { ply: 2, grade: "inaccuracy", drop: 25 },
        { ply: 4, grade: "mistake", drop: 25 },
        { ply: 6, grade: "mistake", drop: 25 },
        { ply: 8, grade: "mistake", drop: 25 },
        { ply: 0, grade: "inaccuracy", drop: 12 },
      ],
      []
    );
    expect(picked).toEqual([4, 6, 8]);
    expect(
      pickKeyMoments(
        [
          { ply: 8, grade: "blunder", drop: 40 },
          { ply: 2, grade: "inaccuracy", drop: 40 },
          { ply: 4, grade: "inaccuracy", drop: 40 },
          { ply: 6, grade: "inaccuracy", drop: 40 },
        ],
        []
      )
    ).toEqual([2, 4, 8]);
  });
});

describe("key moments keep opened ones", () => {
  it("a locked moment stays when a bigger drop arrives", () => {
    // Analysed so far: plies 0, 2, 4 graded; 6 and 8 not yet.
    const early = winsWithDrops([12, 15, 11, null, null]);
    const first = buildReview(input({ evals: evalsFrom(early) }));
    expect(first.keyMoments.map((k) => k.ply)).toEqual([0, 2, 4]);

    // Plies 6 and 8 arrive with bigger drops; the human had opened ply 4.
    const later = winsWithDrops([12, 15, 11, 30, 25]);
    const model = buildReview(input({ evals: evalsFrom(later), locked: [4] }));
    expect(model.keyMoments.map((k) => k.ply)).toEqual([4, 6, 8]);
  });

  it("keeps every locked moment, even past 3", () => {
    const wins = winsWithDrops([12, 35, 11, 25, 15]);
    const model = buildReview(input({ evals: evalsFrom(wins), locked: [0, 4, 6, 8] }));
    expect(model.keyMoments.map((k) => k.ply)).toEqual([0, 4, 6, 8]);
  });

  it("drops a locked ply that isn't graded (out of range or not a moment)", () => {
    const wins = winsWithDrops([12, 35, 0, 25, 15]);
    const model = buildReview(input({ evals: evalsFrom(wins), locked: [4, 99] }));
    expect(model.keyMoments.map((k) => k.ply)).toEqual([2, 6, 8]);
  });

  it("never picks an unanalysed ply", () => {
    const wins = winsWithDrops([12, 35, 11, 25, 15]);
    wins[7] = null; // after ply 6
    const model = buildReview(input({ evals: evalsFrom(wins) }));
    expect(model.moves[6]).toMatchObject({ drop: null, accuracy: null, grade: null });
    expect(model.keyMoments.map((k) => k.ply)).toEqual([0, 2, 8]);
  });
});

describe("key moment moves", () => {
  it("names the move played, Stockfish's best and Liem's most-played move", () => {
    const wins = winsWithDrops([0, 35, 0, 0, 0]);
    const books = booksAt({ 2: [bm("b1c3", 4), bm("g1f3", 12), bm("f1c4", 12)] });
    const model = buildReview(input({ evals: evalsFrom(wins, "white", { 2: "d2d4" }), books }));
    expect(model.keyMoments).toEqual([
      {
        ply: 2,
        grade: "blunder",
        drop: expect.closeTo(35, 6),
        played: { uci: "g1f3", label: "2.Nf3" },
        best: { uci: "d2d4", label: "2.d4" },
        liem: { uci: "g1f3", label: "2.Nf3", games: 12 },
      },
    ]);
  });

  it("liem is null out of his book, and best null without a best move", () => {
    const wins = winsWithDrops([0, 35, 0, 0, 0]);
    const model = buildReview(input({ evals: evalsFrom(wins), books: booksAt({}) }));
    expect(model.keyMoments[0]).toMatchObject({ ply: 2, best: null, liem: null });
    const noBooks = buildReview(input({ evals: evalsFrom(wins, "white", { 2: "d2d4" }) }));
    expect(noBooks.keyMoments[0].liem).toBeNull();
  });

  it("best is null when the engine's move isn't legal there", () => {
    const wins = winsWithDrops([0, 35, 0, 0, 0]);
    const model = buildReview(input({ evals: evalsFrom(wins, "white", { 2: "e7e5" }) }));
    expect(model.keyMoments[0].best).toBeNull();
  });
});
