import { describe, expect, it } from "vitest";

import { LIEM } from "game/opponent/players";
import { STRENGTH_STEPS, type StrengthStep } from "game/opponent/strength";
import { levelView } from "../levelView";

const SPARRING = [1400, 1700, 1900, 2100, 2300, 2500] as const;

describe("levelView", () => {
  it("texts per level", () => {
    for (const n of SPARRING) {
      expect(levelView(n)).toEqual({
        sparring: true,
        name: `Sparring · ${n}`,
        title: null,
        glyph: "♞",
        avatar: null,
        detail: "Plays Liem's openings",
        shortDetail: "Liem's openings",
        detailLead: "Plays ",
        value: `about ${n}`,
        valueLead: "about",
        valueMain: String(n),
        stepLabel: String(n),
        engineLine: `A sparring bot plays his openings, then Stockfish at about ${n}.`,
        outText: `Stockfish at about ${n} plays from here. It isn't trained on his games.`,
      });
    }

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
      value: "★ Liem",
      valueLead: null,
      valueMain: "★ Liem",
      stepLabel: "Liem (2732)",
      engineLine: "Le Quang Liem: his openings, then full-strength Stockfish 18.",
      outText: "Full-strength Stockfish 18 plays from here. It isn't trained on his games.",
    });
  });

  it("covers every step, and only full is him", () => {
    expect(STRENGTH_STEPS.filter((s) => !levelView(s).sparring)).toEqual(["full"]);
  });

  it("the parts add up to the whole line, so phones and screen readers agree", () => {
    for (const step of STRENGTH_STEPS) {
      const v = levelView(step);
      expect(v.detailLead + v.shortDetail).toBe(v.detail);
      expect(v.valueLead === null ? v.valueMain : `${v.valueLead} ${v.valueMain}`).toBe(v.value);
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
      value: "★ Test",
      stepLabel: "Test (2500)",
      engineLine: "Nguyen Van Test: his openings, then full-strength Stockfish 18.",
    });
    expect(levelView(1400, entry)).toMatchObject({ detail: "Plays Test's openings", shortDetail: "Test's openings" });
  });

  it("a one-word name is its own short name", () => {
    const entry = { ...LIEM.entry, name: "Magnus" };
    expect(levelView("full", entry).value).toBe("★ Magnus");
    expect(levelView(1700 as StrengthStep, entry).shortDetail).toBe("Magnus's openings");
  });
});
