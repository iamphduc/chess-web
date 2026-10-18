import { LIEM } from "game/opponent/players";
import type { StrengthStep } from "game/opponent/strength";
import type { PlayerEntry } from "game/opponent/types";

/**
 * Every text the app shows for a strength step (plan sparring-ladder, ## Look).
 * 1400 to 2500 are sparring bots that play his openings; `"full"` is him.
 * Components read these and add no words of their own.
 */
export interface LevelView {
  /** A sparring bot, not him. */
  sparring: boolean;
  /** His card's name: "Sparring · 1400", or his name. */
  name: string;
  /** The tag before the name: his title, or `null` for a sparring bot. */
  title: string | null;
  /** The gold star by the name: his card only. */
  star: boolean;
  /** The glyph in place of a photo (♞), or `null` when the card shows `avatar`. */
  glyph: string | null;
  /** His photo's file name, or `null` when the card shows `glyph`. */
  avatar: string | null;
  /** The card's line under the name, in full (read out at every width). */
  detail: string;
  /** The line on phones: the end of `detail`. */
  shortDetail: string;
  /** What phones leave out: `detail` is `detailLead + shortDetail`. */
  detailLead: string;
  /** The setup card's value: "about 1400", or "★ Liem". */
  value: string;
  /** The soft word before the value ("about"), or `null`. */
  valueLead: string | null;
  /** The gold part of the value. */
  valueMain: string;
  /** The strength step's `aria-label`. */
  stepLabel: string;
  /** The setup card's line under the steps. */
  engineLine: string;
  /** The book note's text once the game leaves his book. */
  outText: string;
}

/** The name people call him by: the last word of his name ("Le Quang Liem" is "Liem"). */
function shortName(entry: PlayerEntry): string {
  const words = entry.name.trim().split(/\s+/);
  return words[words.length - 1];
}

const NOT_TRAINED = "It isn't trained on his games.";

export function levelView(step: StrengthStep, entry: PlayerEntry = LIEM.entry): LevelView {
  const short = shortName(entry);
  if (step === "full") {
    // On phones the title is left out: it already sits by his name.
    const detailLead = `${entry.title} · `;
    const shortDetail = String(entry.rating);
    return {
      sparring: false,
      name: entry.name,
      title: entry.title,
      star: true,
      glyph: null,
      avatar: entry.avatar,
      detail: detailLead + shortDetail,
      shortDetail,
      detailLead,
      value: `★ ${short}`,
      valueLead: null,
      valueMain: `★ ${short}`,
      stepLabel: `${short} (${entry.rating})`,
      engineLine: `${entry.name}: his openings, then full-strength Stockfish 18.`,
      outText: `Full-strength Stockfish 18 plays from here. ${NOT_TRAINED}`,
    };
  }

  const shortDetail = `${short}'s openings`;
  return {
    sparring: true,
    name: `Sparring · ${step}`,
    title: null,
    star: false,
    glyph: "♞",
    avatar: null,
    detail: `Plays ${shortDetail}`,
    shortDetail,
    detailLead: "Plays ",
    value: `about ${step}`,
    valueLead: "about",
    valueMain: String(step),
    stepLabel: String(step),
    engineLine: `A sparring bot plays his openings, then Stockfish at about ${step}.`,
    outText: `Stockfish at about ${step} plays from here. ${NOT_TRAINED}`,
  };
}
