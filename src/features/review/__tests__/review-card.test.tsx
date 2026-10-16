import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { applyMove } from "game/engine/engine";
import { type GameState, initialGameState } from "game/engine/game-state";
import { uciToMove } from "game/opponent/position";
import type { KeyMoment, ReviewModel } from "game/review/types";
import type { ReviewState } from "../reviewSlice";
import { BottomSheet } from "../components/BottomSheet";
import { KeyMomentCard, KeyMomentCardBody } from "../components/KeyMomentCard";
import { ReviewBoard } from "../components/ReviewBoard";
import { keyMomentView } from "../keyMomentView";

function play(start: GameState, ucis: readonly string[]): GameState {
  return ucis.reduce((state, uci) => {
    const move = uciToMove(state, uci);
    if (move === null) throw new Error(`rejected ${uci}`);
    return applyMove(state, move);
  }, start);
}

/** What a reader sees or hears: the markup without its tags. */
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
const count = (html: string, pattern: RegExp) => (html.match(pattern) ?? []).length;
/** The visible labels of the buttons, in order. */
const buttons = (html: string) =>
  Array.from(html.matchAll(/<button[^>]*>(.*?)<\/button>/g)).map((m) => text(m[1]).trim());

const noop = () => {};

describe("review components", () => {
  it("review board", () => {
    const start = initialGameState();
    const board = (props: Partial<React.ComponentProps<typeof ReviewBoard>> = {}) =>
      renderToStaticMarkup(
        <ReviewBoard state={start} flipped={false} size={52} highlight={null} interactive={false} onMove={noop} {...props} />
      );

    // Unflipped: a8 first, h1 last; every square named, 32 pieces drawn.
    const plain = board();
    const squares = Array.from(plain.matchAll(/data-square="([a-h][1-8])"/g)).map((m) => m[1]);
    expect(squares).toHaveLength(64);
    expect(squares[0]).toBe("a8");
    expect(squares[63]).toBe("h1");
    expect(count(plain, /class="piece /g)).toBe(32);
    expect(plain).toContain('style="width:416px"');

    // Flipped: h1 first, a8 last, labels still on the left and bottom edges.
    const flipped = board({ flipped: true });
    const flippedSquares = Array.from(flipped.matchAll(/data-square="([a-h][1-8])"/g)).map((m) => m[1]);
    expect(flippedSquares[0]).toBe("h1");
    expect(flippedSquares[63]).toBe("a8");
    expect(count(flipped, /square__label--rank/g)).toBe(8);
    expect(count(flipped, /square__label--file/g)).toBe(8);

    // Not interactive: no square takes input.
    expect(plain).toContain('data-interactive="false"');
    expect(plain).not.toContain('role="button"');
    expect(plain).not.toContain("tabindex");

    // Interactive: every square is a button you can reach.
    const live = board({ interactive: true });
    expect(live).toContain('data-interactive="true"');
    expect(count(live, /role="button"/g)).toBe(64);

    // The highlighted move tints its two squares; a king in check glows.
    const afterE4 = play(start, ["e2e4"]);
    const lit = board({ state: afterE4, highlight: "e2e4" });
    expect(count(lit, /overlay--highlight/g)).toBe(2);
    expect(lit).not.toContain("overlay--check");
    const check = play(start, ["e2e4", "f7f6", "d1h5"]);
    expect(board({ state: check })).toContain("overlay--check");
    // No promotion picker until a promotion waits.
    expect(plain).not.toContain("review-board__promotion");
  });

  const moment = (ply: number, over: Partial<KeyMoment> = {}): KeyMoment => ({
    ply,
    grade: "mistake",
    drop: 23,
    played: { uci: "f1d3", label: "20.Bd3" },
    best: { uci: "f1c4", label: "20.Bc4" },
    liem: null,
    ...over,
  });
  const model = (keyMoments: KeyMoment[], analysed = 77): ReviewModel => ({
    moves: [],
    whiteWin: [],
    analysed,
    total: 77,
    accuracy: null,
    counts: { inaccuracy: 0, mistake: 0, blunder: 0 },
    keyMoments,
    bookPlies: 0,
    leftBook: null,
  });
  type Review = Pick<ReviewState, "status" | "moments" | "active">;
  const card = (m: ReviewModel, r: Partial<Review>) =>
    renderToStaticMarkup(
      <KeyMomentCard
        model={m}
        review={{ status: "done", moments: {}, active: null, ...r }}
        humanColor="white"
        onStart={noop}
        onShowAnswer={noop}
        onSkip={noop}
        onNext={noop}
        onRetry={noop}
      />
    );
  const THREE = [moment(24, { played: { uci: "c3d5", label: "13.Nd5" }, best: { uci: "c3e2", label: "13.Ne2" } }), moment(38), moment(52, { grade: "blunder", drop: 44 })];

  it("key-moment card", () => {
    // Trying: the hidden-move prompt, its place, stars, Show answer and Skip.
    const trying = card(model(THREE), { active: 38, moments: { 24: "found", 38: "trying" } });
    expect(trying).toContain('data-moment-status="trying"');
    expect(trying).toContain("review-card--red");
    expect(text(trying)).toContain("Key moment 2 of 3");
    expect(text(trying)).toContain("Find the better move");
    expect(text(trying)).toContain("White to play. Your move is hidden. Make a move on the board.");
    expect(buttons(trying)).toEqual(["Show answer", "Skip"]);
    // Stars: one per moment, filled per found, and the count for screen readers.
    expect(Array.from(trying.matchAll(/data-found="(true|false)"/g)).map((m) => m[1])).toEqual(["true", "false", "false"]);
    expect(count(trying, /review-star--found/g)).toBe(1);
    expect(trying).toContain('aria-label="1 of 3 found"');

    // Checking: the buttons wait.
    const checking = card(model(THREE), { active: 38, moments: { 38: "checking" } });
    expect(text(checking)).toContain("Checking your move");
    expect(count(checking, /<button[^>]*disabled/g)).toBe(2);

    // Wrong and a failed check: Try again, Show answer, Skip.
    const wrong = card(model(THREE), { active: 38, moments: { 38: "wrong" } });
    expect(buttons(wrong)).toEqual(["Try again", "Show answer", "Skip"]);
    expect(text(wrong)).toContain("Not that one");
    const checkFailed = card(model(THREE), { active: 38, moments: { 38: "check-failed" } });
    expect(buttons(checkFailed)).toEqual(["Try again", "Show answer", "Skip"]);
    expect(text(checkFailed)).toContain("couldn't check");

    // Found: gold edge, the reveal without Liem, Next moment.
    const found = card(model(THREE), { active: 38, moments: { 24: "revealed", 38: "found" } });
    expect(found).toContain('data-moment-status="found"');
    expect(found).toContain("review-card--gold");
    expect(text(found)).toContain("You found it");
    expect(text(found)).toContain("You played 20.Bd3 · Stockfish: 20.Bc4");
    expect(text(found)).not.toContain("Liem played");
    expect(buttons(found)).toEqual(["Next moment"]);
    expect(count(found, /review-star--found/g)).toBe(1);

    // Revealed with Liem: his move and games; one game reads singular.
    const withLiem = [moment(24, { liem: { uci: "c3e2", label: "13.Ne2", games: 11 }, played: { uci: "c3d5", label: "13.Nd5" }, best: { uci: "c3e2", label: "13.Ne2" } })];
    const revealed = card(model(withLiem), { active: 24, moments: { 24: "revealed" } });
    expect(text(revealed)).toContain("You played 13.Nd5 · Stockfish: 13.Ne2 · Liem played 13.Ne2 in 11 games");
    expect(count(revealed, /review-star--found/g)).toBe(0);
    const oneGame = [moment(24, { liem: { uci: "c3e2", label: "13.Ne2", games: 1 } })];
    expect(text(card(model(oneGame), { active: 24, moments: { 24: "skipped" } }))).toContain("in 1 game");
    // The played move carries its grade color; Stockfish's the best color; Liem's the book color.
    expect(revealed).toMatch(/review-grade--mistake[^>]*>13\.Nd5/);
    expect(revealed).toMatch(/review-grade--best[^>]*>13\.Ne2/);
    expect(revealed).toMatch(/review-grade--book[^>]*>13\.Ne2/);

    // Waiting: the progress label and an 8 px olive bar, no buttons.
    const waiting = card(model([], 27), { status: "analysing" });
    expect(waiting).toContain('data-moment-status="waiting"');
    expect(waiting).toContain("review-card--olive");
    expect(text(waiting)).toContain("Analysing move 14 of 38");
    expect(waiting).toMatch(/role="progressbar"[^>]*aria-valuenow="27"/);
    expect(waiting).toMatch(/review-progress__bar" style="width:35(\.\d+)?%"/);
    expect(buttons(waiting)).toEqual([]);

    // Intro: a start button for the first moment.
    const intro = card(model(THREE), {});
    expect(intro).toContain('data-moment-status="intro"');
    expect(buttons(intro)).toEqual(["Start with move 13"]);

    // None, failed.
    const none = card(model([]), {});
    expect(none).toContain('data-moment-status="none"');
    expect(text(none)).toContain("No mistakes found");
    expect(buttons(none)).toEqual([]);
    const failed = card(model(THREE), { status: "failed" });
    expect(failed).toContain('data-moment-status="failed"');
    expect(buttons(failed)).toEqual(["Try again"]);

    // Summary: k of K found with the stars, no buttons.
    const view = keyMomentView({
      model: model(THREE),
      review: { status: "done", active: 52, moments: { 24: "found", 38: "skipped", 52: "found" } },
      humanColor: "white",
      summary: true,
    });
    const summary = renderToStaticMarkup(
      <KeyMomentCardBody view={view} onStart={noop} onShowAnswer={noop} onSkip={noop} onNext={noop} onRetry={noop} />
    );
    expect(summary).toContain('data-moment-status="summary"');
    expect(text(summary)).toContain("2 of 3 found");
    expect(count(summary, /review-star--found/g)).toBe(2);
    expect(buttons(summary)).toEqual([]);
  });

  it("reopened card with every moment done shows the summary", () => {
    // Back to game, then Review game, mounts the card again: all done → the summary, not the last reveal.
    const reopened = card(model(THREE), { active: 52, moments: { 24: "found", 38: "skipped", 52: "found" } });
    expect(reopened).toContain('data-moment-status="summary"');
    expect(text(reopened)).toContain("Review done");
    expect(text(reopened)).toContain("2 of 3 found");
    expect(buttons(reopened)).toEqual([]);
    // One moment: found it, reopen → "1 of 1 found".
    const single = card(model([moment(2)]), { active: 2, moments: { 2: "found" } });
    expect(single).toContain('data-moment-status="summary"');
    expect(text(single)).toContain("1 of 1 found");
    // Still analysing with every moment so far done: the summary keeps the progress bar.
    const analysing = card(model(THREE, 40), { status: "analysing", active: 52, moments: { 24: "found", 38: "skipped", 52: "revealed" } });
    expect(analysing).toContain('data-moment-status="summary"');
    expect(analysing).toContain('role="progressbar"');
    // A moment not done: reopening shows the active moment as today.
    const open = card(model(THREE), { active: 38, moments: { 24: "found", 38: "found" } });
    expect(open).toContain('data-moment-status="found"');
    expect(buttons(open)).toEqual(["Next moment"]);
    // No moment opened yet: the intro.
    expect(card(model(THREE), {})).toContain('data-moment-status="intro"');
    // No moments yet while analysing: waiting, not an empty summary.
    expect(card(model([], 27), { status: "analysing" })).toContain('data-moment-status="waiting"');
  });

  it("bottom sheet", () => {
    const sheet = (open: boolean, low: boolean) =>
      renderToStaticMarkup(
        <BottomSheet open={open} low={low} onClose={noop}>
          <p>card</p>
        </BottomSheet>
      );

    // Open: the sheet, its grab bar and close button, and the scrim behind.
    const open = sheet(true, false);
    expect(open).toContain('data-sheet-open="true"');
    expect(open).toContain("review-sheet");
    expect(open).not.toContain("review-sheet--low");
    expect(open).toContain("review-scrim");
    expect(open).toContain("review-sheet__grab");
    expect(open).toMatch(/class="review-sheet__close"[^>]*aria-label="Close"/);
    expect(text(open)).toContain("card");

    // Low: no scrim, so the board stays usable.
    const low = sheet(true, true);
    expect(low).toContain("review-sheet--low");
    expect(low).not.toContain("review-scrim");
    expect(low).toContain('data-sheet-open="true"');

    // Closed: hidden, no scrim; the card stays mounted.
    const closed = sheet(false, false);
    expect(closed).toContain('data-sheet-open="false"');
    expect(closed).toMatch(/data-sheet-open="false"[^>]*hidden/);
    expect(closed).not.toContain("review-scrim");
    expect(text(closed)).toContain("card");
  });
});
