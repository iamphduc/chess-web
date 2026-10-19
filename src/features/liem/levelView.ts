import { LIEM } from "game/opponent/players";
import type { StrengthStep } from "game/opponent/strength";
import type { PlayerEntry } from "game/opponent/types";

/** The name people call him by: the last word of his name ("Le Quang Liem" is "Liem"). */
function shortName(entry: PlayerEntry): string {
  const words = entry.name.trim().split(/\s+/);
  return words[words.length - 1];
}

/**
 * The name of each strength step, the one place to change them (plan ui-refresh). People read
 * names, not ratings: the numbers stay in `STRENGTH_STEPS`, `strengthLabel` and `npm run calibrate`.
 */
export const LEVEL_NAMES: Readonly<Record<StrengthStep, string>> = {
  1400: "Easy",
  1700: "Medium",
  1900: "Hard",
  2100: "Harder",
  2300: "Expert",
  2500: "Master",
  full: shortName(LIEM.entry),
};

/**
 * Every text the app shows for a strength step (plans sparring-ladder and ui-refresh, ## Look).
 * 1400 to 2500 are sparring bots that play his openings; `"full"` is him. No sparring level
 * shows a rating. Components read these and add no words of their own.
 */
export interface LevelView {
  /** A sparring bot, not him. */
  sparring: boolean;
  /** His card's name: the level's name ("Medium"), or his full name. */
  name: string;
  /** The tag before the name: his title, or `null` for a sparring bot. */
  title: string | null;
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
  /** The level picker's name for the step: "Medium", or "Liem". */
  stepName: string;
  /** Only at his step: an ochre ★ is drawn before `stepName`. */
  starred: boolean;
  /** Who you play, in short: "Medium", or "Liem" ("vs Medium"). */
  opponentName: string;
  /** His title and rating ("GM · 2732") at his step; `null` for a sparring bot. */
  rating: string | null;
  /** The strength step's `aria-label`. */
  stepLabel: string;
  /** The line under the level picker. */
  engineLine: string;
  /** The book note's text once the game leaves his book. */
  outText: string;
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
      glyph: null,
      avatar: entry.avatar,
      detail: detailLead + shortDetail,
      shortDetail,
      detailLead,
      stepName: short,
      starred: true,
      opponentName: short,
      rating: detailLead + shortDetail,
      stepLabel: `${short} (${entry.rating})`,
      engineLine: `${entry.name}: his openings, then full-strength Stockfish 18.`,
      outText: `Full-strength Stockfish 18 plays from here. ${NOT_TRAINED}`,
    };
  }

  const level = LEVEL_NAMES[step];
  const shortDetail = `${short}'s openings`;
  return {
    sparring: true,
    name: level,
    title: null,
    glyph: "♞",
    avatar: null,
    detail: `Plays ${shortDetail}`,
    shortDetail,
    detailLead: "Plays ",
    stepName: level,
    starred: false,
    opponentName: level,
    rating: null,
    stepLabel: level,
    engineLine: `A sparring bot plays his openings, then Stockfish at the ${level} level.`,
    outText: `Stockfish at the ${level} level plays from here. ${NOT_TRAINED}`,
  };
}
