# Stockfish is named

## What it is
The app says plainly who you're playing. It names a sparring level or Liem himself, and it names Stockfish once his book runs out. The places that say it:
- The home page's Level picker and the engine line under it.
- His card above or below the board.
- The out-of-book note.
- The grey "Stockfish" pill that replaces "★ Book · N" on his card.
- The top bar ("vs Medium · you play White").

## How it works
- `levelView(step)` (`src/features/liem/levelView.ts`) is a pure function that returns every text a step shows. Components read from it and add no words of their own. `LEVEL_NAMES` in the same file is the one place the names live.
- **Sparring (1400–2500):** the names Easy, Medium, Hard, Harder, Expert and Master. The ♞ glyph replaces a photo, the card reads the name with "Plays Liem's openings" ("Liem's openings" below 768 px), and there's no GM tag. `rating` is `null`. Engine line: "A sparring bot plays his openings, then Stockfish at the Medium level." Out of book: "Stockfish at the Medium level plays from here. It isn't trained on his games."
- **Liem (`"full"`):** his photo, GM tag and "GM · 2732" ("2732" below 768 px). The step reads "★ Liem", in ink with an ochre ★ (`Star.tsx`), and its `aria-label` is "Liem (2732)". The engine and out-of-book lines name full-strength Stockfish 18.
- His short name "Liem" is the last word of `name` in `player.json`.

## Why it's this way
- **Names, not ratings** (the human's choice; the names are a default): a 1000-rated player who beats "1400" easily would think the app is wrong. Turned down: "Sparring · N" and "about N". See `pod-docs/decisions.md` → "Levels have names, not ratings".
- **One module for every text:** one place and one test file (`level-view.test.ts`) to change a word.
- **Phone lines:** see `pod-docs/decisions.md` → "Phone lines after the refresh".

## Watch out
- No sparring text or `aria-label` may contain a 4-digit number or "about". `level-view.test.ts` checks every string field.
- The numbers stay in `STRENGTH_STEPS`, `strengthLabel` and `npm run calibrate`. Don't remove them from code or docs.
- There's still no star by his name on the in-game card. The ★ is on the "★ Liem" step and the "★ Book" badge.
- At 375 px his name may end "Le Quang Li…": `pod-docs/decisions.md` → "His name may end in an ellipsis at 375 px".
- Phone texts are hidden from sight only. Screen readers still get the full line, and tests check both.

## History
- 2026-10-12 · human-style-strength · setup card, his card and the out-of-book note name Stockfish · [report](../reports/human-style-strength.html)
- 2026-10-18 · sparring-ladder · sparring and Liem labels from `levelView`, ♞ card, "★ Liem" step; in-game star removed · [report](../reports/sparring-ladder.html), [PR #79](https://github.com/iamphduc/chess-web/pull/79)
- 2026-10-19 · ui-refresh · level names replace ratings; texts move to the home page and the top bar; ochre ★ via `Star.tsx` · [report](../reports/ui-refresh.html), [PR #84](https://github.com/iamphduc/chess-web/pull/84)
