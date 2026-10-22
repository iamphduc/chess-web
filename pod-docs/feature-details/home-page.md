# Home page

## What it is
The first screen at `#/`. It shows the ♞ mark and "Sparring", the hero "Practice a grandmaster's openings.", and one paragraph about his openings, then Stockfish, then a review. Below that are the Level picker (Easy, Medium, Hard, Harder, Expert, Master, ★ Liem), the engine line, You play (White, Black, Random), **Play**, the **Two players on one board** button and a three-part strip. It has no photo and no "beat him" copy.

## How it works
- `src/features/home/` holds `Home` and a small `RadioGroup` (arrow keys, Home and End move the pick and wrap).
- The picker writes `setStrength` and `setColorPick` on the `match` slice. Every word comes from `levelView` (see [stockfish-is-named](stockfish-is-named.md)). The rating shows beside the label only at Liem ("GM · 2732").
- **Play** dispatches `startLiemGame()`, then `goTo("play")`. The engine and books load only then.
- **Two players** is `a.button.home__two-players[href="#/two-players"]`: the secondary `.button` (an outline, no arrow), full width, at least 48 px tall and 12 px (`--space-3`) under Play. It's a link because it goes to a screen.
- Home is a store state, not just a hash: `mode: "liem"`, `setupOpen: true` and the review closed. `arriveAt("home")` puts the store there (see [screens-by-hash-link](screens-by-hash-link.md)).
- Layout: one column, at most 480 px wide and centred. At 375 px the level steps wrap 4 then 3.

## Why it's this way
- **A front door before the board** (the human's choice). Turned down: opening straight on vs Liem. See `pod-docs/decisions.md` → "The site opens on the home page".
- **No photo, no "beat him"** (the human's choice): the page is about practising his openings, not about one match.
- **Picks last until a reload, not saved.** They live in the store, as the old setup card's did. Saving them would need storage the way the Sound setting is saved.
- **Two players is a full-width button** (the human's choice, the 48 px option in `pod-docs/design-drafts/ui-feel.html`): the small grey link was easy to miss. See `pod-docs/decisions.md` → "Two players is a full-width button".
- **The default stays Harder (2100) and White.** See `pod-docs/decisions.md` → "The default level stays Harder".

## Watch out
- His name and title in the paragraph come from `LIEM.entry`. Don't type them in.
- "★ Liem" is ink text with an ochre ★ (`Star.tsx`). Ochre (`--gold`) is never a text color, because it fails 4.5:1 on cream.
- No sparring text or `aria-label` may contain 1400–2500 or "about". `home.test.tsx` checks the markup.
- chrome-devtools-axi's `emulate` reloads the page, which drops the picks. agent-browser's `set viewport 375 812` doesn't reload.
- `Home.tsx` doesn't import `Button.css`. The Two players outline works because the app ships as one bundle with no lazy routes. If home is ever split out, import it there.
- Two players must stay the same width as Play (448 px at desktop, 343 px at 375 px). Don't give it its own `max-width`.

## History
- 2026-10-19 · ui-refresh · new home page with the level picker, color and Play; replaces the challenge card · [report](../reports/ui-refresh.html), [PR #84](https://github.com/iamphduc/liem-sparring/pull/84)
- 2026-10-21 · ui-feel · Two players becomes a full-width 48 px outlined button (`a.button.home__two-players`), with no arrow · [report](../reports/ui-feel.html), [PR #101](https://github.com/iamphduc/liem-sparring/pull/101)
