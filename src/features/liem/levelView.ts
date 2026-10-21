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
}

export function levelView(step: StrengthStep, entry: PlayerEntry = LIEM.entry): LevelView {
  const short = shortName(entry);
  if (step === "full") {
    return {
      sparring: false,
      name: entry.name,
      title: entry.title,
      glyph: null,
      avatar: entry.avatar,
      stepName: short,
      starred: true,
      opponentName: short,
      rating: `${entry.title} · ${entry.rating}`,
      stepLabel: `${short} (${entry.rating})`,
      engineLine: `${entry.name}: his openings, then full-strength Stockfish 18.`,
    };
  }

  const level = LEVEL_NAMES[step];
  return {
    sparring: true,
    name: level,
    title: null,
    glyph: "♞",
    avatar: null,
    stepName: level,
    starred: false,
    opponentName: level,
    rating: null,
    stepLabel: level,
    engineLine: `A sparring bot plays his openings, then Stockfish at the ${level} level.`,
  };
}
