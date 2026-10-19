import { describe, expect, it } from "vitest";

import { createAppStore } from "app/store";
import { LIEM } from "game/opponent/players";
import { STRENGTH_STEPS, type StrengthStep } from "game/opponent/strength";
import { LEVEL_NAMES, levelView } from "../levelView";

const SPARRING = [1400, 1700, 1900, 2100, 2300, 2500] as const;
const NAMES = ["Easy", "Medium", "Hard", "Harder", "Expert", "Master"] as const;

describe("levelView", () => {
  it("level names", () => {
    expect(STRENGTH_STEPS.map((s) => levelView(s).stepName)).toEqual([...NAMES, "Liem"]);
    expect(STRENGTH_STEPS.map((s) => LEVEL_NAMES[s])).toEqual([...NAMES, "Liem"]);
  });

  it("sparring view", () => {
    expect(levelView(1700)).toEqual({
      sparring: true,
      name: "Medium",
      title: null,
      glyph: "♞",
      avatar: null,
      detail: "Plays Liem's openings",
      shortDetail: "Liem's openings",
      detailLead: "Plays ",
      stepName: "Medium",
      starred: false,
      opponentName: "Medium",
      rating: null,
      stepLabel: "Medium",
      engineLine: "A sparring bot plays his openings, then Stockfish at the Medium level.",
      outText: "Stockfish at the Medium level plays from here. It isn't trained on his games.",
    });

    SPARRING.forEach((n, i) => {
      const name = NAMES[i];
      expect(levelView(n)).toMatchObject({
        name,
        stepName: name,
        opponentName: name,
        stepLabel: name,
        starred: false,
        rating: null,
        engineLine: `A sparring bot plays his openings, then Stockfish at the ${name} level.`,
        outText: `Stockfish at the ${name} level plays from here. It isn't trained on his games.`,
      });
    });
  });

  it("liem view", () => {
    expect(levelView("full")).toEqual({
      sparring: false,
      name: "Le Quang Liem",
      title: "GM",
      glyph: null,
      avatar: LIEM.entry.avatar,
      detail: "GM · 2732",
      // The GM tag sits by his name, so phones keep just the rating.
      shortDetail: "2732",
      detailLead: "GM · ",
      stepName: "Liem",
      starred: true,
      opponentName: "Liem",
      rating: "GM · 2732",
      stepLabel: "Liem (2732)",
      engineLine: "Le Quang Liem: his openings, then full-strength Stockfish 18.",
      outText: "Full-strength Stockfish 18 plays from here. It isn't trained on his games.",
    });
  });

  it("no ratings on sparring levels", () => {
    for (const step of SPARRING) {
      const view = levelView(step);
      for (const [field, value] of Object.entries(view)) {
        if (typeof value !== "string") continue;
        expect(value, `${step} ${field}`).not.toMatch(/\d{4}/);
        expect(value, `${step} ${field}`).not.toMatch(/about/i);
      }
    }
  });

  it("the default level is Harder", () => {
    const strength = createAppStore().getState().match.strength;
    expect(strength).toBe(2100);
    expect(levelView(strength).stepName).toBe("Harder");
  });

  it("covers every step, and only full is him", () => {
    expect(STRENGTH_STEPS.filter((s) => !levelView(s).sparring)).toEqual(["full"]);
    expect(STRENGTH_STEPS.filter((s) => levelView(s).starred)).toEqual(["full"]);
    expect(STRENGTH_STEPS.filter((s) => levelView(s).rating !== null)).toEqual(["full"]);
  });

  it("the parts add up to the whole line, so phones and screen readers agree", () => {
    for (const step of STRENGTH_STEPS) {
      const v = levelView(step);
      expect(v.detailLead + v.shortDetail).toBe(v.detail);
      // Exactly one of the glyph and the photo.
      expect((v.glyph === null) !== (v.avatar === null)).toBe(true);
    }
  });

  it("reads his name, title and rating from the entry passed in", () => {
    const entry = { ...LIEM.entry, name: "Nguyen Van Test", title: "IM", rating: 2500 };
    const him = levelView("full", entry);
    expect(him).toMatchObject({
      name: "Nguyen Van Test",
      title: "IM",
      detail: "IM · 2500",
      stepName: "Test",
      opponentName: "Test",
      rating: "IM · 2500",
      stepLabel: "Test (2500)",
      engineLine: "Nguyen Van Test: his openings, then full-strength Stockfish 18.",
    });
    // A sparring level keeps its own name whoever's openings it plays.
    expect(levelView(1400, entry)).toMatchObject({
      name: "Easy",
      detail: "Plays Test's openings",
      shortDetail: "Test's openings",
    });
  });

  it("a one-word name is its own short name", () => {
    const entry = { ...LIEM.entry, name: "Magnus" };
    expect(levelView("full", entry).stepName).toBe("Magnus");
    expect(levelView(1700 as StrengthStep, entry).shortDetail).toBe("Magnus's openings");
  });
});
