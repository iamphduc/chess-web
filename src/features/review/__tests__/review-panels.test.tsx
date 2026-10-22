import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { applyMove } from "game/engine/engine";
import { initialGameState } from "game/engine/game-state";
import { uciToMove } from "game/opponent/position";
import { buildReview } from "game/review/build-review";
import type { PositionEval, ReviewModel, ReviewMove } from "game/review/types";
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

const graph = (model: ReviewModel, cursor: number, humanColor: "white" | "black" = "white") =>
  renderToStaticMarkup(
    <ReviewGraph model={model} humanColor={humanColor} cursor={cursor} onSelect={noop} />
  );

/** The `d` of every line path in the markup. */
const linePaths = (html: string) =>
  Array.from(html.matchAll(/class="review-graph__line" d="([^"]*)"/g)).map((m) => m[1]);
const pointCount = (d: string) => (d.match(/[ML]/g) ?? []).length;

describe("graph", () => {
  it("draws a point at each graded ply's resulting position, colored by grade", () => {
    const html = graph(sample(), 0);
    const points = Array.from(
      html.matchAll(/class="review-graph__dot[^"]*"[^>]*data-ply="(\d+)" data-grade="(\w+)"/g)
    );
    expect(points.map((m) => [m[1], m[2]])).toEqual([
      ["4", "mistake"],
      ["6", "blunder"],
    ]);
    expect(html).toContain("review-graph__dot--mistake");
    expect(html).toContain("review-graph__dot--blunder");
    // Ply 4 ends at position 5 of 8: 62.5 % across.
    expect(html).toMatch(/data-ply="4"[^>]*style="left:62.5%/);
  });

  it("draws no point for his graded moves, and his tooltip is only the label", () => {
    const base = sample();
    const moves = base.moves.map((m) =>
      m.ply === 5 ? { ...m, drop: 35, accuracy: 10, grade: "blunder" as const } : m
    );
    const model = sample({ moves });
    const plies = Array.from(graph(model, 0).matchAll(/class="review-graph__dot[^"]*"[^>]*data-ply="(\d+)"/g)).map(
      (m) => m[1]
    );
    expect(plies).toEqual(["4", "6"]);
    expect(graph(model, 6)).toContain(">3...Nf6<");
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
    const partial = sample({
      whiteWin: [52, 52, 53, null, null, null, null, null, null],
      analysed: 3,
    });
    const paths = linePaths(graph(partial, 0));
    expect(paths).toHaveLength(1);
    expect(pointCount(paths[0])).toBe(3);
    const none = sample({ whiteWin: Array(9).fill(null), analysed: 0 });
    expect(linePaths(graph(none, 0))).toEqual([]);
  });

  it("graph shows your side", () => {
    // No White / You switch any more.
    const asWhite = graph(sample(), 0, "white");
    expect(asWhite).not.toMatch(/role="radio"/);
    expect(asWhite).not.toMatch(/review-graph__sides|Graph side/);
    expect(asWhite).toContain("Win % · you");
    // As White, White's 28 % at position 5 is your 28 %: 72 % down from the top.
    expect(asWhite).toMatch(/data-ply="4"[^>]*top:72%/);
    // As Black it's your 72 %: 28 % down from the top.
    expect(graph(sample(), 0, "black")).toMatch(/data-ply="4"[^>]*top:28%/);
  });

  it("a click still selects the nearest position", () => {
    const calls: number[] = [];
    const el = ReviewGraph({ model: sample(), humanColor: "white", cursor: 0, onSelect: (n) => calls.push(n) });
    // Find the plot's onClick in the element tree.
    const find = (node: unknown): ((e: unknown) => void) | null => {
      if (!node || typeof node !== "object") return null;
      const props = (node as { props?: { className?: string; onClick?: (e: unknown) => void; children?: unknown } }).props;
      if (props?.className === "review-graph__plot" && props.onClick) return props.onClick;
      const kids = props?.children;
      for (const kid of Array.isArray(kids) ? kids.flat(Infinity) : [kids]) {
        const hit = find(kid);
        if (hit) return hit;
      }
      return null;
    };
    const onClick = find(el);
    expect(onClick).not.toBeNull();
    const target = { getBoundingClientRect: () => ({ left: 100, width: 200 }) };
    // 8 plies over 200 px: 25 px a position. 160 px in is position 6.4, so 6.
    onClick!({ currentTarget: target, clientX: 260 });
    // Past the right edge it clamps to the last position.
    onClick!({ currentTarget: target, clientX: 500 });
    expect(calls).toEqual([6, 8]);
  });
});

describe("move list", () => {
  const list = (model: ReviewModel, cursor: number) =>
    renderToStaticMarkup(<MoveList model={model} cursor={cursor} onSelect={noop} />);

  it("marks grades inside the move buttons", () => {
    const html = list(sample(), 0);
    expect(html).toMatch(
      /data-ply="4" data-grade="mistake"[^>]*>Bc4<span class="review-grade--mistake"[^>]*>\?</
    );
    expect(html).toMatch(
      /data-ply="6" data-grade="blunder"[^>]*>Ng5<span class="review-grade--blunder"[^>]*>\?\?</
    );
    expect(html).not.toMatch(/data-ply="5"[^>]*data-grade/);
  });

  it("marks his moves with the same chips as yours, from the real model", () => {
    // 1.e4 e5 2.Nf3 Qh4: by the searches, his 2...Qh4 drops his win from 50 to 10.
    const ucis = ["e2e4", "e7e5", "g1f3", "d8h4"];
    const positions = [initialGameState()];
    for (const uci of ucis) {
      const last = positions[positions.length - 1];
      positions.push(applyMove(last, uciToMove(last, uci)!));
    }
    const cp = (win: number) => -Math.log(2 / (1 + (win - 50) / 50) - 1) / 0.00368208;
    // Each position's eval from the side to move: White to move at 0, 2, 4.
    const evals: PositionEval[] = [50, 50, 50, 50, 90].map((white, i) => ({
      score: { cp: i % 2 === 0 ? cp(white) : -cp(white) },
      best: null,
    }));
    const model = buildReview({
      positions,
      humanColor: "white",
      clock: { baseMs: 600_000, incrementMs: 0 },
      evals,
      books: null,
      locked: [],
    });
    expect(model.counts.blunder).toBe(0);
    const html = list(model, 0);
    expect(html).toMatch(
      /data-ply="3" data-grade="blunder"[^>]*aria-label="2...Qh4, blunder"[^>]*>Qh4<span class="review-grade--blunder"[^>]*>\?\?</
    );
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
    expect(list(sample(), 7)).toMatch(
      /class="review-move review-move--selected"[^>]*data-ply="6"[^>]*aria-current="true"/
    );
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

describe("accuracy line", () => {
  /** The summary card's accuracy line, from the graph card's markup. */
  const line = (model: ReviewModel) => {
    const html = graph(model, 0);
    const at = html.indexOf('class="review-summary__accuracy"');
    expect(at, "the accuracy line is in the summary card").toBeGreaterThan(-1);
    return html.slice(at, html.indexOf("</p>", at));
  };
  const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  it("sits under the graph, in the same card", () => {
    const html = graph(sample(), 0);
    expect(html.indexOf("review-summary__accuracy")).toBeGreaterThan(html.indexOf("review-graph__plot"));
    expect(html.indexOf("review-summary__accuracy")).toBeLessThan(html.lastIndexOf("</section>"));
    expect(html.match(/<section/g)).toHaveLength(1);
  });

  it("reads the accuracy, then each grade's count in its grade color", () => {
    const html = line(sample({ accuracy: 40, counts: { inaccuracy: 1, mistake: 0, blunder: 1 } }));
    expect(html).toMatch(/class="review-accuracy"[^>]*>40 %</);
    const parts = ["40 %", "?! 1", "? 0", "?? 1"];
    const t = text(html);
    let from = 0;
    for (const p of parts) {
      const at = t.indexOf(p, from);
      expect(at, `"${p}" after ${from} in "${t}"`).toBeGreaterThanOrEqual(from);
      from = at + p.length;
    }
    for (const [grade, mark, n] of [
      ["inaccuracy", "?!", 1],
      ["mistake", "?", 0],
      ["blunder", "??", 1],
    ] as const) {
      expect(html).toMatch(
        new RegExp(`data-count="${grade}"[^>]*class="review-grade--${grade}"[^>]*>${mark.replace(/\?/g, "\\?")} ${n}<`)
      );
    }
    // No book-move count.
    expect(html).not.toContain('data-count="book"');
    expect(t).not.toMatch(/book/i);
  });

  it("rounds the accuracy and shows zeros", () => {
    expect(line(sample({ accuracy: 71.4 }))).toMatch(/class="review-accuracy"[^>]*>71 %</);
    expect(line(sample({ accuracy: 99.9999 }))).toMatch(/class="review-accuracy"[^>]*>100 %</);
    expect(line(sample({ accuracy: 0 }))).toMatch(/class="review-accuracy"[^>]*>0 %</);
    const zeros = text(line(sample({ counts: { inaccuracy: 0, mistake: 0, blunder: 0 } })));
    expect(zeros).toContain("?! 0");
    expect(zeros).toContain("? 0");
    expect(zeros).toContain("?? 0");
  });

  it("shows — until it's ready", () => {
    const html = line(sample({ accuracy: null }));
    expect(html).toMatch(/class="review-accuracy"[^>]*>—</);
    expect(html).toContain("Not ready yet");
    expect(html).not.toMatch(/\d %/);
  });
});

describe("left his book line", () => {
  const list = (model: ReviewModel, cursor = 8) =>
    renderToStaticMarkup(<MoveList model={model} cursor={cursor} onSelect={noop} />);
  /** The list's first child, and its text. */
  const first = (html: string) => {
    const m = /^<div class="move-list scoresheet"[^>]*>(<(\w+)[^>]*>[\s\S]*?<\/\2>)/.exec(html);
    expect(m, "the list has a first item").not.toBeNull();
    return m![1];
  };
  const text = (html: string) => html.replace(/<[^>]+>/g, "");

  it("left with his moves: his most-played move there and its games", () => {
    const item = first(list(sample()));
    expect(item).toMatch(/data-left-book="4"/);
    expect(text(item)).toBe("Left his book at move 3 · he played 3.Bb5 in 60 games");
  });

  it("picks his most-played move even when it isn't listed first", () => {
    const html = list(
      sample({
        leftBook: {
          ply: 1,
          played: { uci: "c7c5", label: "1...c5" },
          his: [
            { uci: "c7c6", label: "1...c6", games: 3 },
            { uci: "e7e5", label: "1...e5", games: 1807 },
            { uci: "d7d5", label: "1...d5", games: undefined },
          ],
        },
        bookPlies: 1,
      })
    );
    expect(text(first(html))).toBe("Left his book at move 1 · he played 1...e5 in 1,807 games");
  });

  it("says one game, not one games", () => {
    const html = list(
      sample({ leftBook: { ply: 4, played: { uci: "f1c4", label: "3.Bc4" }, his: [{ uci: "f1b5", label: "3.Bb5", games: 1 }] } })
    );
    expect(text(first(html))).toBe("Left his book at move 3 · he played 3.Bb5 in 1 game");
  });

  it("left with none of his games there", () => {
    for (const his of [[], [{ uci: "f1b5", label: "3.Bb5", games: undefined }], [{ uci: "f1b5", label: "3.Bb5", games: 0 }]]) {
      const item = first(list(sample({ leftBook: { ply: 4, played: { uci: "f1c4", label: "3.Bc4" }, his } })));
      expect(text(item)).toBe("Left his book at move 3");
    }
  });

  it("stayed in his book", () => {
    const item = first(list(sample({ leftBook: null, bookPlies: 8 })));
    expect(item).toMatch(/data-left-book="stayed"/);
    expect(text(item)).toBe("Stayed in his book the whole game");
  });

  it("no line without his books", () => {
    const html = list(sample({ leftBook: null, bookPlies: 0 }));
    expect(html).not.toContain("data-left-book");
    expect(html).not.toMatch(/his book/i);
  });

  it("comes before the book fold and the moves", () => {
    const html = list(sample());
    const at = html.indexOf("data-left-book");
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(html.indexOf("move-list__fold"));
    expect(at).toBeLessThan(html.indexOf("data-ply="));
    // One line, not a card with his move bars.
    expect(html).not.toContain("liem-note");
    expect(html.match(/data-left-book/g)).toHaveLength(1);
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
      Array.from(html.matchAll(/<button[^>]*aria-label="([^"]+)"([^>]*)>/g)).map((m) => [
        m[1],
        m[2].includes("disabled"),
      ]);
    const at = (cursor: number, last: number, disabled = false) =>
      disabledOf(
        renderToStaticMarkup(
          <StepButtons cursor={cursor} last={last} disabled={disabled} onStep={noop} />
        )
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
