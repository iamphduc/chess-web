# Board loads

## What it is
What you see when a board screen opens, from home's **Play** or the **Two players on one board** button. A 56 px top bar holds "← Home" and the title: "vs Medium · you play White", "vs Liem · you play Black" or "Two players". Below it are the board column (a player card, 64 squares, a player card) and a sidebar: the book note (vs Liem only), then the Moves card. Both clocks read `10:00`. There are no mode tabs and no challenge card.

The cards: vs Liem, your card reads "You" with a ♔ or ♚ disc, and his card shows the level name with the ♞ disc. In Two players they read "White" and "Black", each with its disc. Body text is Quicksand 600; headings, buttons, names and clocks are 700.

## How it works
- `App.tsx` renders `<Home />` on home, or `.app[data-screen="play" | "two-players" | "review"]` holding `Board`.
- `topBarTitle` (`src/features/board/topBar.ts`) builds the title. `TopBar` takes an `action` prop, which the review uses for Play again.
- The Two players names come from `src/game/players.ts`.
- Size: `squareSizeFor` (`boardSize.ts`) gives 39, 52 or 78 px squares. From 992 px up, the board column and a 380 px sidebar sit side by side; below that they stack.
- No Stockfish worker, WASM or book is requested on home. `liemOpponent.ts` loads through a dynamic `import()` once a vs-Liem game starts.
- Only the Quicksand 600 and 700 woff2 files ship, self-hosted from `src/assets/fonts/`.

## Why it's this way
- **Home first, no tabs or challenge card** (the human's choice): see `pod-docs/decisions.md` → "The site opens on the home page" and "The board screen has a top bar and one Moves card".
- **Quicksand 600 for body text** (the human's choice, draft option B): 500 read "very thin like a paper". See "Body text is Quicksand 600".
- **White and Black in Two players** (an agent default): the board used to name the sides "Le Quang Liem" (with his photo) and "Me". See "Two players cards read White and Black".
- **Lazy engine:** see "The engine and books load when a vs-Liem game starts, not on page load". Home must not undo this.

## Watch out
- A test that builds a fresh store starts in the home state. A two-player test must call `switchMode("two-player")` first, and a vs-Liem test must start a game.
- `.board` must stay `8 × square size` wide, with the cards inside it, and every `.board > .player` 60 px tall so `.squares` doesn't move. `squareSizeFor` reads only the viewport width, so the taller cards make the board column taller, not the board smaller.
- No CSS under `src/` may set `font-weight` to 500, 400 or `normal`; `tests/theme.test.ts` checks it. There is no 500 font file.
- Below 992 px the book note sits above the Moves card, so anything that changes its height changes the page height. See [stockfish-is-named](stockfish-is-named.md).

## History
- 2026-10-18 · sparring-ladder · page opens on vs Liem with the setup card; his card shows the sparring bot at 2100 · [report](../reports/sparring-ladder.html), [PR #79](https://github.com/iamphduc/chess-web/pull/79)
- 2026-10-19 · ui-refresh · boards open from home; top bar with ← Home and the title; tabs and challenge card removed · [report](../reports/ui-refresh.html), [PR #84](https://github.com/iamphduc/chess-web/pull/84)
- 2026-10-20 · ui-polish · body text Quicksand 600; ♔/♚ discs; Two players reads White and Black; `TopBar` action prop replaces the `ReviewTopBar` copy · [report](../reports/ui-polish.html), [PR #91](https://github.com/iamphduc/chess-web/pull/91)
