import { describe, expect, it } from "vitest";

import { applyMove } from "game/engine/engine";
import { initialGameState, type GameState } from "game/engine/game-state";
import type { BookLookup } from "game/opponent/book";
import { uciToMove } from "game/opponent/position";
import type { BookMove } from "game/opponent/types";
import { bookMoveLabel, bookNoteView, liemBadge, type BookNoteBoard, type BookNoteMatch } from "../bookNote";
import type { LastChoice } from "../matchSlice";

/** Every position along the moves, the start included. */
function line(...ucis: string[]): GameState[] {
  const states = [initialGameState()];
  for (const uci of ucis) {
    const last = states[states.length - 1];
    const move = uciToMove(last, uci);
    if (move === null) throw new Error(`rejected ${uci}`);
    states.push(applyMove(last, move));
  }
  return states;
}

/** The position after the moves, and the plies played to reach it. */
function at(...ucis: string[]): [GameState, number] {
  const states = line(...ucis);
  return [states[states.length - 1], ucis.length];
}

/** A book move with `games` games, all from one source. */
const bm = (uci: string, games: number): BookMove => [uci, games, 0, 0, games, 0, 0];

describe("bookMoveLabel", () => {
  it("move labels", () => {
    expect(bookMoveLabel(...at(), "e2e4")).toBe("1.e4");
    expect(bookMoveLabel(...at(), "g1f3")).toBe("1.Nf3");
    expect(bookMoveLabel(...at("e2e4"), "e7e5")).toBe("1...e5");
    expect(bookMoveLabel(...at("e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5"), "e1g1")).toBe("4.O-O");
    expect(
      bookMoveLabel(...at("d2d4", "d7d5", "b1c3", "b8c6", "c1f4", "c8f5", "d1d2", "d8d7"), "e1c1")
    ).toBe("5.O-O-O");
    // Black castles too.
    expect(bookMoveLabel(...at("e2e4", "e7e5", "g1f3", "g8f6", "f1c4", "f8c5", "b1c3"), "e8g8")).toBe(
      "4...O-O"
    );
    // En passant: the target square is empty, still a pawn capture.
    expect(bookMoveLabel(...at("e2e4", "a7a6", "e4e5", "d7d5"), "e5d6")).toBe("3.exd6");
    // A pawn capture and a capturing promotion.
    const promo = ["a2a4", "b7b5", "a4b5", "a7a6", "b5a6", "c8b7"];
    expect(bookMoveLabel(...at(...promo), "a6b7")).toBe("4.axb7");
    expect(bookMoveLabel(...at(...promo, "a6b7", "b8c6"), "b7a8q")).toBe("5.bxa8=Q");
    expect(bookMoveLabel(...at(...promo, "a6b7", "b8c6"), "b7a8n")).toBe("5.bxa8=N");
    // A piece capture.
    expect(bookMoveLabel(...at("e2e4", "d7d5"), "e4d5")).toBe("2.exd5");
    expect(bookMoveLabel(...at("e2e4", "d7d5", "e4d5"), "d8d5")).toBe("2...Qxd5");
    // Two knights can reach d2: the from-file tells them apart.
    expect(bookMoveLabel(...at("d2d4", "d7d5", "g1f3", "g8f6"), "b1d2")).toBe("3.Nbd2");
  });

  it("no + or #", () => {
    expect(bookMoveLabel(...at("e2e4", "f7f5"), "d1h5")).toBe("2.Qh5");
    expect(bookMoveLabel(...at("f2f3", "e7e5", "g2g4"), "d8h4")).toBe("2...Qh4");
  });

  it("an illegal move has no label", () => {
    expect(bookMoveLabel(...at(), "e2e5")).toBeNull();
    expect(bookMoveLabel(...at(), "nonsense")).toBeNull();
  });
});

// After 1.d4 Nf6 2.c4 e6, he (White) played 3.Nf3.
const OPENING = ["d2d4", "g8f6", "c2c4", "e7e6"];
const BEFORE = line(...OPENING);
const PLAYED = line(...OPENING, "g1f3");
const LOOKUP: BookLookup = {
  book: "online",
  moves: [bm("g1f3", 188), bm("g2g3", 87), bm("b1c3", 37)],
  games: 320,
};

function board(over: Partial<BookNoteBoard> = {}): BookNoteBoard {
  return { engineHistory: PLAYED, gameId: 4, ...over };
}

function choice(over: Partial<LastChoice> = {}): LastChoice {
  return { gameId: 4, ply: BEFORE.length - 1, uci: "g1f3", source: "book", lookup: LOOKUP, ...over };
}

function match(over: Partial<BookNoteMatch> = {}): BookNoteMatch {
  return { lastChoice: choice(), opponentStatus: "idle", ...over };
}

describe("bookNoteView", () => {
  it("note states", () => {
    expect(bookNoteView(board(), match({ lastChoice: null }))).toEqual({ kind: "waiting" });
    expect(bookNoteView(board({ gameId: 5 }), match())).toEqual({ kind: "waiting" });

    expect(bookNoteView(board(), match())).toEqual({
      kind: "in-book",
      total: 320,
      rows: [
        { uci: "g1f3", label: "3.Nf3", games: 188, width: 100, played: true },
        { uci: "g2g3", label: "3.g3", games: 87, width: 46, played: false },
        { uci: "b1c3", label: "3.Nc3", games: 37, width: 20, played: false },
      ],
    });

    // Stored order, even when the played move isn't the top one.
    const second = bookNoteView(board(), match({ lastChoice: choice({ uci: "g2g3" }) }));
    expect(second.kind === "in-book" && second.rows.map((r) => [r.uci, r.played])).toEqual([
      ["g1f3", false],
      ["g2g3", true],
      ["b1c3", false],
    ]);

    expect(bookNoteView(board(), match({ lastChoice: choice({ source: "engine", lookup: null }) }))).toEqual({
      kind: "out",
    });

    // Failed wins over every other kind.
    expect(bookNoteView(board(), match({ opponentStatus: "failed" }))).toEqual({ kind: "failed" });
    expect(bookNoteView(board(), match({ opponentStatus: "failed", lastChoice: null }))).toEqual({
      kind: "failed",
    });
    expect(
      bookNoteView(board(), match({ opponentStatus: "failed", lastChoice: choice({ source: "engine" }) }))
    ).toEqual({ kind: "failed" });

    // Thinking or loading keeps the last move's note.
    expect(bookNoteView(board(), match({ opponentStatus: "thinking" })).kind).toBe("in-book");
    expect(bookNoteView(board(), match({ opponentStatus: "loading", lastChoice: null })).kind).toBe("waiting");
  });

  it("a book choice with no lookup reads as out of book", () => {
    expect(bookNoteView(board(), match({ lastChoice: choice({ lookup: null }) }))).toEqual({ kind: "out" });
  });

  it("a ply past the board's history shows no rows", () => {
    const view = bookNoteView(board(), match({ lastChoice: choice({ ply: 40 }) }));
    expect(view).toEqual({ kind: "in-book", total: 320, rows: [] });
  });

  it("moves with no games get a zero-width bar", () => {
    const lookup: BookLookup = { book: "slow", moves: [bm("g1f3", 0), bm("g2g3", 0)], games: 0 };
    const view = bookNoteView(board(), match({ lastChoice: choice({ lookup }) }));
    expect(view.kind === "in-book" && view.rows.map((r) => r.width)).toEqual([0, 0]);
  });
});

describe("rows", () => {
  const SEVEN = [
    bm("e2e4", 100),
    bm("d2d4", 90),
    bm("g1f3", 80),
    bm("c2c4", 70),
    bm("g2g3", 60),
    bm("b2b3", 50),
    bm("f2f4", 40),
  ];
  const start = line();
  const view = (uci: string, moves: BookMove[] = SEVEN) =>
    bookNoteView(
      { engineHistory: line(uci), gameId: 1 },
      {
        lastChoice: { gameId: 1, ply: 0, uci, source: "book", lookup: { book: "online", moves, games: 490 } },
        opponentStatus: "idle",
      }
    );
  const ucis = (v: ReturnType<typeof view>) => (v.kind === "in-book" ? v.rows.map((r) => r.uci) : null);

  it("row cap and played move", () => {
    expect(start).toHaveLength(1);
    // 7 moves show 5 rows.
    expect(ucis(view("e2e4"))).toEqual(["e2e4", "d2d4", "g1f3", "c2c4", "g2g3"]);
    // A played 7th move is added as a 6th row, marked.
    const seventh = view("f2f4");
    expect(ucis(seventh)).toEqual(["e2e4", "d2d4", "g1f3", "c2c4", "g2g3", "f2f4"]);
    expect(seventh.kind === "in-book" && seventh.rows[5]).toMatchObject({ played: true, label: "1.f4", width: 40 });
    // The played 6th, just below the cap, is added too.
    expect(ucis(view("b2b3"))).toEqual(["e2e4", "d2d4", "g1f3", "c2c4", "g2g3", "b2b3"]);
    // A played 5th stays in place, no extra row.
    expect(ucis(view("g2g3"))).toEqual(["e2e4", "d2d4", "g1f3", "c2c4", "g2g3"]);

    // An illegal UCI row is left out, and the next legal move fills its place.
    const withIllegal = [bm("e2e4", 100), bm("e2e5", 95), ...SEVEN.slice(1)];
    expect(ucis(view("e2e4", withIllegal))).toEqual(["e2e4", "d2d4", "g1f3", "c2c4", "g2g3"]);
    // An illegal top move doesn't set the bar scale.
    const illegalTop = [bm("a1a8", 500), bm("e2e4", 100), bm("d2d4", 50)];
    const scaled = view("e2e4", illegalTop);
    expect(scaled.kind === "in-book" && scaled.rows.map((r) => [r.uci, r.width])).toEqual([
      ["e2e4", 100],
      ["d2d4", 50],
    ]);
  });
});

describe("liemBadge", () => {
  it("badge follows the note", () => {
    expect(liemBadge(bookNoteView(board(), match()))).toEqual({ games: 320 });
    expect(liemBadge(bookNoteView(board(), match({ lastChoice: choice({ source: "engine" }) })))).toBeNull();
    expect(liemBadge(bookNoteView(board(), match({ lastChoice: null })))).toBeNull();
    expect(liemBadge(bookNoteView(board(), match({ opponentStatus: "failed" })))).toBeNull();
  });
});
