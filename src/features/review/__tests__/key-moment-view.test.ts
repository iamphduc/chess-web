import { describe, expect, it } from "vitest";

import type { KeyMoment, ReviewModel } from "game/review/types";
import type { MomentStatus, ReviewState } from "../reviewSlice";
import { keyMomentView, nextMomentPly, progressLabel, type CardInput } from "../keyMomentView";

const moment = (ply: number, over: Partial<KeyMoment> = {}): KeyMoment => ({
  ply,
  grade: "mistake",
  drop: 23,
  played: { uci: "f1d3", label: `${Math.floor(ply / 2) + 1}.Bd3` },
  best: { uci: "f1c4", label: `${Math.floor(ply / 2) + 1}.Bc4` },
  liem: null,
  ...over,
});

/** A 76-ply game (38 moves) with the given key moments, `analysed` positions of 77. */
function model(keyMoments: KeyMoment[], analysed = 77): ReviewModel {
  return {
    moves: [],
    whiteWin: [],
    analysed,
    total: 77,
    accuracy: null,
    counts: { inaccuracy: 0, mistake: 0, blunder: 0 },
    keyMoments,
    bookPlies: 0,
    leftBook: null,
  };
}

type Review = Pick<ReviewState, "status" | "moments" | "active">;
const review = (over: Partial<Review> = {}): Review => ({ status: "done", moments: {}, active: null, ...over });

const input = (m: ReviewModel, r: Review, summary = false): CardInput => ({
  model: m,
  review: r,
  humanColor: "white",
  summary,
});

const THREE = [moment(24), moment(38, { grade: "blunder", drop: 44 }), moment(52, { grade: "inaccuracy", drop: 12 })];

describe("keyMomentView", () => {
  it("card states", () => {
    // A failed pass, with or without moments, asks to try again.
    expect(keyMomentView(input(model([]), review({ status: "failed" }))).state).toBe("failed");
    expect(keyMomentView(input(model(THREE), review({ status: "failed" }))).state).toBe("failed");

    // Done with no moments: nothing to fix.
    const none = keyMomentView(input(model([]), review()));
    expect(none.state).toBe("none");
    expect(none.title).toBe("No mistakes found");
    expect(none.stars).toEqual([]);

    // Analysing with no moments yet: waiting, olive, with progress.
    const waiting = keyMomentView(input(model([], 20), review({ status: "analysing" })));
    expect(waiting.state).toBe("waiting");
    expect(waiting.edge).toBe("olive");
    expect(waiting.progress).toEqual({ label: "Analysing move 11 of 38", analysed: 20, total: 77 });

    // Analysing with one moment: intro, still olive, progress shown, start at that move.
    const early = keyMomentView(input(model([moment(24)], 30), review({ status: "analysing" })));
    expect(early.state).toBe("intro");
    expect(early.edge).toBe("olive");
    expect(early.progress?.label).toBe("Analysing move 16 of 38");
    expect(early.startPly).toBe(24);
    expect(early.startLabel).toBe("Start with move 13");
    expect(early.stars).toEqual([false]);

    // Done with moments, none opened: intro without progress, red edge.
    const intro = keyMomentView(input(model(THREE), review()));
    expect(intro.state).toBe("intro");
    expect(intro.edge).toBe("red");
    expect(intro.progress).toBeNull();
    expect(intro.title).toBe("3 key moments");
    expect(intro.startPly).toBe(24);

    // The active moment's own status, with its place and the moment's details.
    const statuses: MomentStatus[] = ["trying", "checking", "wrong", "check-failed", "revealed", "skipped"];
    for (const status of statuses) {
      const v = keyMomentView(input(model(THREE), review({ active: 38, moments: { 24: "found", 38: status } })));
      expect(v.state).toBe(status);
      expect(v.edge).toBe("red");
      expect(v.step).toBe("Key moment 2 of 3");
      expect(v.moment?.ply).toBe(38);
      expect(v.moment?.moveNumber).toBe(20);
    }
    const trying = keyMomentView(input(model(THREE), review({ active: 38, moments: { 38: "trying" } })));
    expect(trying.title).toBe("Find the better move");
    expect(trying.moment?.side).toBe("White");
    expect(trying.low).toBe(true);
    expect(keyMomentView({ ...input(model(THREE), review({ active: 38, moments: { 38: "trying" } })), humanColor: "black" }).moment?.side).toBe("Black");
    // Only trying puts the sheet low.
    expect(keyMomentView(input(model(THREE), review({ active: 38, moments: { 38: "wrong" } }))).low).toBe(false);

    // Found: gold edge, its star filled; revealed and skipped stars stay empty.
    const found = keyMomentView(input(model(THREE), review({ active: 38, moments: { 24: "revealed", 38: "found" } })));
    expect(found.state).toBe("found");
    expect(found.edge).toBe("gold");
    expect(found.title).toBe("You found it");
    expect(found.stars).toEqual([false, true, false]);
    expect(found.foundLabel).toBe("1 of 3 found");

    // A moment opened while still analysing shows the moment, not the progress card.
    const mid = keyMomentView(input(model([moment(24)], 30), review({ status: "analysing", active: 24, moments: { 24: "trying" } })));
    expect(mid.state).toBe("trying");

    // Summary only once asked for and every moment is done.
    const allDone = review({ active: 52, moments: { 24: "found", 38: "skipped", 52: "found" } });
    expect(keyMomentView(input(model(THREE), allDone)).state).toBe("found");
    const summary = keyMomentView(input(model(THREE), allDone, true));
    expect(summary.state).toBe("summary");
    expect(summary.title).toBe("2 of 3 found");
    expect(summary.edge).toBe("gold");
    expect(summary.stars).toEqual([true, false, true]);
    // None found: the summary keeps the red edge.
    const noneFound = review({ active: 52, moments: { 24: "skipped", 38: "revealed", 52: "skipped" } });
    expect(keyMomentView(input(model(THREE), noneFound, true)).edge).toBe("red");
    // A new moment arrives after the summary: back to the active moment, Next opens it.
    const grown = keyMomentView(input(model([...THREE, moment(60)]), allDone, true));
    expect(grown.state).toBe("found");
    expect(grown.nextPly).toBe(60);

    // An active ply that isn't a key moment is ignored.
    expect(keyMomentView(input(model(THREE), review({ active: 10, moments: { 10: "trying" } }))).state).toBe("intro");
    // An idle review (never opened) waits.
    expect(keyMomentView(input(model([], 0), review({ status: "idle" }))).state).toBe("waiting");
  });

  it("progress label", () => {
    // 77 positions = 76 plies = 38 moves.
    expect(progressLabel(0, 77)).toBe("Analysing move 1 of 38");
    expect(progressLabel(1, 77)).toBe("Analysing move 1 of 38");
    expect(progressLabel(27, 77)).toBe("Analysing move 14 of 38");
    expect(progressLabel(76, 77)).toBe("Analysing move 38 of 38");
    expect(progressLabel(77, 77)).toBe("Analysing move 38 of 38");
    // An odd number of plies: 75 plies end on White's 38th move.
    expect(progressLabel(76, 76)).toBe("Analysing move 38 of 38");
    // A one-ply game.
    expect(progressLabel(0, 2)).toBe("Analysing move 1 of 1");
    expect(progressLabel(2, 2)).toBe("Analysing move 1 of 1");
  });

  it("next moment", () => {
    // From the first: the next one in game order.
    expect(nextMomentPly(THREE, { 24: "found" }, 24)).toBe(38);
    // Done ones are skipped.
    expect(nextMomentPly(THREE, { 24: "found", 38: "skipped" }, 24)).toBe(52);
    // Past the last, it wraps to one not done earlier.
    expect(nextMomentPly(THREE, { 24: "trying", 52: "revealed" }, 52)).toBe(24);
    expect(nextMomentPly(THREE, { 52: "revealed" }, 52)).toBe(24);
    // Opened but not done counts as not done.
    expect(nextMomentPly(THREE, { 24: "found", 38: "wrong" }, 24)).toBe(38);
    // All done: the summary.
    expect(nextMomentPly(THREE, { 24: "found", 38: "skipped", 52: "revealed" }, 52)).toBeNull();
    // No active moment: the first not done.
    expect(nextMomentPly(THREE, {}, null)).toBe(24);
    expect(nextMomentPly([], {}, null)).toBeNull();
    // The active one itself is never next.
    expect(nextMomentPly([moment(24)], { 24: "trying" }, 24)).toBeNull();

    // The view carries it.
    expect(keyMomentView(input(model(THREE), review({ active: 24, moments: { 24: "found" } }))).nextPly).toBe(38);
  });
});
