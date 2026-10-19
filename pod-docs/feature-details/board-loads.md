# Board loads

## What it is
What you see when a board screen opens, from home's **Play** or "Two players on one board →". A 56 px top bar holds "← Home" and the title: "vs Medium · you play White", "vs Liem · you play Black" or "Two players". Below it are the board column (a player card, 64 squares, a player card) and a sidebar: the book note (vs Liem only), then the Moves card. Both clocks read `10:00`. There are no mode tabs and no challenge card.

## How it works
- `App.tsx` renders `<Home />` on home, or `.app[data-screen="play" | "two-players" | "review"]` holding `Board`.
- `topBarTitle` (`src/features/board/topBar.ts`) builds the title from the mode, the level's `opponentName` and your color. Before a game a Random pick shows White.
- Size: `squareSizeFor` (`boardSize.ts`) gives 39, 52 or 78 px squares, and the board is 8 × that. From 992 px up, the board column and a 380 px sidebar sit side by side; below that they stack.
- No Stockfish worker, WASM or book is requested on home. `liemOpponent.ts` loads through a dynamic `import()` once a vs-Liem game starts.
- A fresh store is the home state (`mode: "liem"`, `setupOpen: true`). `#/two-players` switches the mode and gives a fresh board.

## Why it's this way
- **Home first, no tabs or challenge card** (the human's choice). Turned down: opening on vs Liem with the card over a dimmed board. See `pod-docs/decisions.md` → "The site opens on the home page" and "The board screen has a top bar and one Moves card".
- **Same square sizes as before:** the 380 px sidebar could shrink the board on mid-size screens, so the size rules were kept and checked at 992 px.
- **Lazy engine:** see `pod-docs/decisions.md` → "The engine and books load when a vs-Liem game starts, not on page load". Home must not undo this.

## Watch out
- A test that builds a fresh store starts in the home state. A two-player test must call `switchMode("two-player")` first, and a vs-Liem test must start a game.
- `.board` must stay `8 × square size` wide, with the cards inside it. His two-line card is held to 56 px so `.squares` doesn't move.
- `ReviewTopBar` in `Board.tsx` copies `TopBar`'s markup. Change both, or give `TopBar` an `action` prop (queue, Someday).
- Two players still names its players "Le Quang Liem" (with his photo) and "Me", from `src/game/players.ts`. That's an open question for the human: `pod-docs/decisions.md` → "Two players keeps "Le Quang Liem" and "Me" on the cards".

## History
- 2026-10-18 · sparring-ladder · page opens on vs Liem with the setup card; his card shows the sparring bot at 2100 · [report](../reports/sparring-ladder.html), [PR #79](https://github.com/iamphduc/chess-web/pull/79)
- 2026-10-19 · ui-refresh · boards open from home; top bar with ← Home and the title; tabs and challenge card removed · [report](../reports/ui-refresh.html), [PR #84](https://github.com/iamphduc/chess-web/pull/84)
