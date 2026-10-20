# Home page

## What it is
The first screen at `#/`. It shows the ♞ mark and "Sparring", the hero "Practice a grandmaster's openings.", and one paragraph about his openings, then Stockfish, then a review. Below that are the Level picker (Easy, Medium, Hard, Harder, Expert, Master, ★ Liem), the engine line, You play (White, Black, Random), **Play**, "Two players on one board →" and a three-part strip. It has no photo and no "beat him" copy.

## How it works
- `src/features/home/` holds `Home` and a small `RadioGroup` (arrow keys, Home and End move the pick and wrap).
- The picker writes `setStrength` and `setColorPick` on the `match` slice. Every word comes from `levelView` (see [stockfish-is-named](stockfish-is-named.md)). The rating shows beside the label only at Liem ("GM · 2732").
- **Play** dispatches `startLiemGame()`, then `goTo("play")`. The engine and books load only then.
- Home is a store state, not just a hash: `mode: "liem"`, `setupOpen: true` and the review closed. `arriveAt("home")` puts the store there (see [screens-by-hash-link](screens-by-hash-link.md)).
- Layout: one column, at most 480 px wide and centred. At 375 px the level steps wrap 4 then 3.

## Why it's this way
- **A front door before the board** (the human's choice). Turned down: opening straight on vs Liem. See `pod-docs/decisions.md` → "The site opens on the home page".
- **No photo, no "beat him"** (the human's choice): the page is about practising his openings, not about one match.
- **Picks last until a reload, not saved.** They live in the store, as the old setup card's did. Saving them would need storage the way the Sound setting is saved.
- **The default stays Harder (2100) and White.** See `pod-docs/decisions.md` → "The default level stays Harder".

## Watch out
- `setupOpen: true` now means "on the home page". The comment on `initialState` in `matchSlice.ts` still talks about the setup card; that card is gone.
- His name and title in the paragraph come from `LIEM.entry`. Don't type them in.
- "★ Liem" is ink text with an ochre ★ (`Star.tsx`). Ochre (`--gold`) is never a text color, because it fails 4.5:1 on cream.
- No sparring text or `aria-label` may contain 1400–2500 or "about". `home.test.tsx` checks the markup.
- `emulate` in the browser tools reloads the page, which drops the picks.

## History
- 2026-10-19 · ui-refresh · new home page with the level picker, color and Play; replaces the challenge card · [report](../reports/ui-refresh.html), [PR #84](https://github.com/iamphduc/chess-web/pull/84)
