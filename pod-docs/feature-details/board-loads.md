# Board loads

## What it is
What a person sees on opening `/chess-web/`: the vs Liem tab is selected, and the "Challenge Le Quang Liem" setup card sits over the dimmed board in the start position. His card above the board shows the level picked so far (2100 at first, a sparring bot, so it reads "♞ · Sparring · 2100 · Plays Liem's openings"). Your card, "You", is below, and both clocks read `10:00`. Two players is one tab click away.

## How it works
- The store's `match` slice (`src/features/liem/matchSlice.ts`) starts as `mode: "liem"` with `setupOpen: true`, playing White at 2100. Nothing saves the mode, so every load opens here.
- With the card open, the squares are dimmed (`.squares__grid.liem-dimmed`) and take no clicks. His card follows the strength step picked on the card, and its words come from `levelView` (see [stockfish-is-named](stockfish-is-named.md)).
- No Stockfish worker, WASM or book is requested before **Start game**. `liemOpponent.ts` loads through a dynamic `import()` once a game starts.
- Clicking **Two players** gives the old layout: Play, Reset, Flip and Sound. Clicking the vs Liem tab while it's already open changes nothing.

## Why it's this way
- **vs Liem first, not Two players** (the human's choice): the app is practice for beating Liem, so his ladder is the main screen. Turned down: keeping Two players as the default, as the 2026-10-10 decision had it. See `pod-docs/decisions.md` → "The page opens on vs Liem".
- **The mode isn't saved:** this keeps the first screen the same on every load. The trade-off is that someone who mostly plays Two players needs a click each time. To remember the mode, save it the way the Sound setting is saved.
- **Lazy engine:** see `pod-docs/decisions.md` → "The engine and books load when a vs-Liem game starts, not on page load". Opening on vs Liem must not undo this.

## Watch out
- A test that builds a fresh store starts in vs Liem with the card open. A two-player test must call `switchMode("two-player")` first. Don't weaken the test to get around this.
- A smoke run must click **Two players** before the two-player steps in the brief's smoke recipe.
- With the card open, the board's Play button and Start game share `.button--play`. Use `[role=dialog] .button--play` for Start game.
- `.squares` must stay at the same height in both tabs, whether the card is open or a game is on. His two-line card is held to 56 px for this.

## History
- 2026-10-18 · sparring-ladder · page opens on vs Liem with the setup card; his card shows the sparring bot at 2100 · [report](../reports/sparring-ladder.html), [PR #79](https://github.com/iamphduc/chess-web/pull/79)
