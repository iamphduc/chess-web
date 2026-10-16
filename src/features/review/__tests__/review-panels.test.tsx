import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ReviewModel, ReviewMove } from "game/review/types";
import { AccuracyPanel } from "../components/AccuracyPanel";
import { LeftBookNote } from "../components/LeftBookNote";
import { MoveList } from "../components/MoveList";
import { ReviewGraph } from "../components/ReviewGraph";
import { StepButtons, stepForKey } from "../components/StepButtons";

const noop = () => {};

const move = (ply: number, label: string, extra: Partial<ReviewMove> = {}): ReviewMove => ({
  ply,
  label,
  uci: "a1a1",
  byHuman: ply % 2 === 0,
  bookGames: null,
  drop: null,
  accuracy: null,
  grade: null,
  ...extra,
});

/**
 * Eight plies, the human on White. Plies 0–3 are in his book (moves 1–2), the
 * human left it with 3.Bc4 (a mistake, −22), and 4.Ng5 was a blunder (−44).
 */
function sample(over: Partial<ReviewModel> = {}): ReviewModel {
  return {
    moves: [
      move(0, "1.e4", { bookGames: 120, drop: 0.4, accuracy: 100 }),
      move(1, "1...e5"),
      move(2, "2.Nf3", { bookGames: 80, drop: 12, accuracy: 100 }),
      move(3, "2...Nc6"),
      move(4, "3.Bc4", { drop: 22.4, accuracy: 40, grade: "mistake" }),
      move(5, "3...Nf6"),
      move(6, "4.Ng5", { drop: 44.2, accuracy: 12, grade: "blunder" }),
      move(7, "4...d5"),
    ],
    whiteWin: [52, 52, 53, 52, 50, 28, 30, 8, 9],
    analysed: 9,
    total: 9,
    accuracy: 63,
    counts: { inaccuracy: 0, mistake: 1, blunder: 1 },
    keyMoments: [],
    bookPlies: 4,
    leftBook: {
      ply: 4,
      played: { uci: "f1c4", label: "3.Bc4" },
      his: [
        { uci: "f1b5", label: "3.Bb5", games: 60 },
        { uci: "d2d4", label: "3.d4", games: 20 },
      ],
    },
    ...over,
  };
}

const graph = (model: ReviewModel, cursor: number, side: "you" | "white" = "you") =>
  renderToStaticMarkup(
    <ReviewGraph model={model} humanColor="white" side={side} cursor={cursor} onSelect={noop} onSide={noop} />
  );

/** The `d` of every line path in the markup. */
const linePaths = (html: string) => [...html.matchAll(/class="review-graph__line" d="([^"]*)"/g)].map((m) => m[1]);
const pointCount = (d: string) => (d.match(/[ML]/g) ?? []).length;

describe("graph", () => {
  it("draws a point at each graded ply's resulting position, colored by grade", () => {
    const html = graph(sample(), 0);
    const points = [...html.matchAll(/class="review-graph__dot[^"]*"[^>]*data-ply="(\d+)" data-grade="(\w+)"/g)];
    expect(points.map((m) => [m[1], m[2]])).toEqual([
      ["4", "mistake"],
      ["6", "blunder"],
    ]);
    expect(html).toContain("review-graph__dot--mistake");
    expect(html).toContain("review-graph__dot--blunder");
    // Ply 4 ends at position 5 of 8: 62.5 % across.
    expect(html).toMatch(/data-ply="4"[^>]*style="left:62.5%/);
  });

  it("puts the olive book band over the book plies, and none without them", () => {
    expect(graph(sample(), 0)).toMatch(/data-book-band="true"[^>]*width="50"/);
    expect(graph(sample({ bookPlies: 0, leftBook: null }), 0)).not.toContain("data-book-band");
  });

  it("shows the selected move's tooltip with its mark and drop", () => {
    const html = graph(sample(), 7);
    expect(html).toContain("4.Ng5?? −44 %");
    expect(html).toMatch(/data-ply="6"[^>]*data-selected="true"/);
    expect(html).toMatch(/data-cursor="true"[^>]*left:87.5%/);
  });

  it("shows no drop for a book move or one of his moves, and no tooltip at the start", () => {
    expect(graph(sample(), 3)).toContain(">2.Nf3 · book<");
    expect(graph(sample(), 2)).toContain(">1...e5<");
    expect(graph(sample(), 0)).not.toContain("review-graph__tip");
  });

  it("draws no line for unanalysed positions", () => {
    const partial = sample({ whiteWin: [52, 52, 53, null, null, null, null, null, null], analysed: 3 });
    const paths = linePaths(graph(partial, 0));
    expect(paths).toHaveLength(1);
    expect(pointCount(paths[0])).toBe(3);
    const none = sample({ whiteWin: Array(9).fill(null), analysed: 0 });
    expect(linePaths(graph(none, 0))).toEqual([]);
  });

  it("marks the chosen side in the White / You switch, and flips the points", () => {
    const you = graph(sample(), 0, "you");
    expect(you).toMatch(/aria-checked="true"[^>]*>You</);
    expect(you).toMatch(/aria-checked="false"[^>]*>White</);
    const asBlack = renderToStaticMarkup(
      <ReviewGraph model={sample()} humanColor="black" side="you" cursor={0} onSelect={noop} onSide={noop} />
    );
    // White's 28 % at position 5 is Black's 72 %: 28 % down from the top.
    expect(asBlack).toMatch(/data-ply="4"[^>]*top:28%/);
    expect(graph(sample(), 0, "white")).toMatch(/data-ply="4"[^>]*top:72%/);
  });
});

describe("move list", () => {
  const list = (model: ReviewModel, cursor: number) =>
    renderToStaticMarkup(<MoveList model={model} cursor={cursor} onSelect={noop} />);

  it("marks grades inside the move buttons", () => {
    const html = list(sample(), 0);
    expect(html).toMatch(/data-ply="4" data-grade="mistake"[^>]*>Bc4<span class="review-grade--mistake"[^>]*>\?</);
    expect(html).toMatch(/data-ply="6" data-grade="blunder"[^>]*>Ng5<span class="review-grade--blunder"[^>]*>\?\?</);
    expect(html).not.toMatch(/data-ply="5"[^>]*data-grade/);
  });

  it("writes rows by move number", () => {
    const html = list(sample(), 0);
    expect(html).toMatch(/>3\.<\/span>.*data-ply="4".*data-ply="5"/);
    expect(html).toMatch(/>4\.<\/span>.*data-ply="6".*data-ply="7"/);
  });

  it("folds the book plies into one closed row with their moves and games", () => {
    const html = list(sample(), 8);
    expect(html).toContain("In his book");
    expect(html).toContain("Moves 1–2");
    expect(html).toContain("He faced this line in 80 games");
    expect(html).toMatch(/aria-expanded="false"/);
    expect(html).not.toContain('data-ply="0"');
    expect(html).not.toContain('data-ply="3"');
  });

  it("opens the fold when the selected move is inside it", () => {
    const html = list(sample(), 2);
    expect(html).toMatch(/aria-expanded="true"/);
    expect(html).toMatch(/data-ply="0"[^>]*data-book="true"/);
    expect(html).toMatch(/class="review-move review-move--selected"[^>]*data-ply="1"/);
  });

  it("marks the selected move, and none at the start", () => {
    expect(list(sample(), 7)).toMatch(/class="review-move review-move--selected"[^>]*data-ply="6"[^>]*aria-current="true"/);
    expect(list(sample(), 0)).not.toContain("review-move--selected");
  });

  it("has no fold without book plies, and folds half a move when he left on Black's ply", () => {
    expect(list(sample({ bookPlies: 0, leftBook: null }), 0)).not.toContain("In his book");
    expect(list(sample({ bookPlies: 0, leftBook: null }), 0)).toContain('data-ply="0"');
    const odd = list(sample({ bookPlies: 3 }), 8);
    expect(odd).toContain("Moves 1–2");
    // Ply 3 (2...Nc6) is outside the fold, on its own row after a gap for White.
    expect(odd).toMatch(/>2\.<\/span><span class="move-list__gap"[^>]*>…<\/span>.*data-ply="3"/);
  });

  it("folds everything when the game stayed in his book", () => {
    const html = list(sample({ bookPlies: 8, leftBook: null }), 8);
    expect(html).toContain("Moves 1–4");
    expect(html).toMatch(/aria-expanded="true"/);
  });
});

describe("accuracy", () => {
  const panel = (model: ReviewModel) => renderToStaticMarkup(<AccuracyPanel model={model} />);

  it("shows the rounded game accuracy", () => {
    expect(panel(sample({ accuracy: 71.4 }))).toMatch(/class="review-accuracy"[^>]*>71%</);
    expect(panel(sample({ accuracy: 99.9999 }))).toMatch(/class="review-accuracy"[^>]*>100%</);
    expect(panel(sample({ accuracy: 0 }))).toMatch(/class="review-accuracy"[^>]*>0%</);
  });

  it("shows — while it isn't ready", () => {
    const html = panel(sample({ accuracy: null }));
    expect(html).toMatch(/class="review-accuracy"[^>]*>—</);
    expect(html).toContain("Not ready yet");
  });

  it("shows each grade's count, and the book moves", () => {
    const html = panel(sample());
    expect(html).toMatch(/data-count="inaccuracy".*Inaccuracies.*<dd>0<\/dd>/);
    expect(html).toMatch(/data-count="mistake".*Mistakes.*<dd>1<\/dd>/);
    expect(html).toMatch(/data-count="blunder".*Blunders.*<dd>1<\/dd>/);
    expect(html).toMatch(/data-count="book".*Book moves.*<dd>2<\/dd>/);
    expect(panel(sample({ moves: sample().moves.map((m) => ({ ...m, bookGames: null })) }))).not.toContain(
      'data-count="book"'
    );
  });
});

describe("left his book note", () => {
  const note = (model: ReviewModel) => renderToStaticMarkup(<LeftBookNote model={model} />);

  it("says where he left his book, with his moves there and their share", () => {
    const html = note(sample());
    expect(html).toContain("Left his book at move 3");
    expect(html).toContain("You played 3.Bc4. In his 80 games here, he played:");
    expect(html).toMatch(/3\.Bb5<\/span><div class="liem-note__bar" style="width:75%"/);
    expect(html).toMatch(/3\.d4<\/span><div class="liem-note__bar" style="width:25%"/);
    expect(html).toContain(">60<");
  });

  it("names the move for a Black ply and copes with no moves of his there", () => {
    const html = note(sample({ leftBook: { ply: 1, played: { uci: "e7e5", label: "1...e5" }, his: [] } }));
    expect(html).toContain("Left his book at move 1");
    expect(html).toContain("You played 1...e5. He has no games from this position.");
    expect(html).not.toContain("liem-note__bar");
  });

  it("says when the game stayed in his book", () => {
    expect(note(sample({ leftBook: null, bookPlies: 8 }))).toContain("Stayed in his book the whole game");
  });

  it("shows nothing without his books", () => {
    expect(note(sample({ leftBook: null, bookPlies: 0 }))).toBe("");
  });
});

describe("step keys", () => {
  it("moves one position with the arrow keys", () => {
    expect(stepForKey("ArrowLeft", 5, 10)).toBe(4);
    expect(stepForKey("ArrowRight", 5, 10)).toBe(6);
    expect(stepForKey({ key: "ArrowRight" }, 0, 10)).toBe(1);
  });

  it("does nothing at the ends", () => {
    expect(stepForKey("ArrowLeft", 0, 10)).toBeNull();
    expect(stepForKey("ArrowRight", 10, 10)).toBeNull();
    expect(stepForKey("ArrowRight", 0, 0)).toBeNull();
  });

  it("ignores modifier keys and other keys", () => {
    for (const mod of ["altKey", "ctrlKey", "metaKey", "shiftKey"] as const) {
      expect(stepForKey({ key: "ArrowRight", [mod]: true }, 5, 10)).toBeNull();
    }
    for (const key of ["ArrowUp", "ArrowDown", "Home", "End", "a", " "]) {
      expect(stepForKey(key, 5, 10)).toBeNull();
    }
  });

  it("disables the buttons at the ends, and all of them when locked", () => {
    const disabledOf = (html: string) =>
      [...html.matchAll(/<button[^>]*aria-label="([^"]+)"([^>]*)>/g)].map((m) => [m[1], m[2].includes("disabled")]);
    const at = (cursor: number, last: number, disabled = false) =>
      disabledOf(
        renderToStaticMarkup(<StepButtons cursor={cursor} last={last} disabled={disabled} onStep={noop} />)
      );
    expect(at(0, 8)).toEqual([
      ["First move", true],
      ["Previous move", true],
      ["Next move", false],
      ["Last move", false],
    ]);
    expect(at(8, 8).map((b) => b[1])).toEqual([false, false, true, true]);
    expect(at(4, 8).map((b) => b[1])).toEqual([false, false, false, false]);
    expect(at(4, 8, true).map((b) => b[1])).toEqual([true, true, true, true]);
  });
});
