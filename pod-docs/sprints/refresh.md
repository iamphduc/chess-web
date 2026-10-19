# Sprint: refresh

_From plan: pod-docs/plans/ui-refresh.md · Slug: refresh · Status: active · Generated: 2026-10-19_
<!-- autopilot-run: started=2026-10-19T09:41:08Z sprints=0 waves=2 -->

## Status board

| Wave | Slice | Title | Branch | PR | Status | Confidence | Depends on |
|------|-------|-------|--------|----|--------|------------|------------|
| 1 | L1 | Look: scorebook tokens, Quicksand, base controls and cards | refresh-L1 | #80 | merged | medium | — |
| 1 | N1 | Level names instead of ratings | refresh-N1 | #80 | merged | medium | — |
| 1 | R1 | Hash screens: route rules, Home and New game actions | refresh-R1 | #80 | merged | medium | — |
| 2 | H1 | Home page and the screen switch | refresh-H1 | — | in-progress | — | L1, N1, R1 |
| 2 | B1 | Board screen: top bar, Moves card, no tabs or setup card | refresh-B1 | — | in-progress | — | L1, N1, R1 |
| 2 | P1 | Player cards with "+N", clocks, book note and badges in the Look | refresh-P1 | — | in-progress | — | L1, N1 |
| 2 | G1 | Board pieces in the Look: squares, promotion picker, game-over notice | refresh-G1 | — | in-progress | — | L1 |
| 3 | V1 | Review: graph in the sidebar and phone sheet, top bar, Look | refresh-V1 | — | pending | — | B1, P1, R1 |
| 4 | C1 | Remove old tokens and styles; decisions, docs and README | refresh-C1 | — | pending | — | H1, B1, P1, G1, V1 |

## Shared contract

**Look tokens** (L1 sets them in `src/index.css` `:root`; every other slice uses only these for color, size and space):
- Palette as the plan's `## Look` lists it: `--bg`, `--surface`, `--surface-2`, `--line`, `--ink`, `--soft`, `--accent`, `--gold`, `--go`, `--go-ink`. Board: `--board-light` #F0E3C8, `--board-dark` #B98B5E. `--board-highlight`, `--board-hint`, `--board-drop-edge`, `--board-check` stay as names. `--board-check` becomes a flat red-ink tint with no gradient. `--board-focus` becomes the focus ring for every control, set to the `--ink` value.
- Space `--space-1`…`--space-6` = 4, 8, 12, 16, 24, 32 px. Radius `--radius` 4px. Type `--text-hero` 30px, `--text-title` 20px, `--text-body` 16px, `--text-small` 14px. `--font` is `"Quicksand", sans-serif`, at weights 500 and 700 only.
- Grades `--grade-inaccuracy`, `--grade-mistake`, `--grade-blunder`, `--grade-best`, `--grade-book` keep their hue within 10° of today's value and are darkened just enough to reach 4.5:1 on both `--surface` and `--surface-2` (under 5.5:1 on `--surface-2`). `--grade-ink` is the `--surface` value, for text on a grade chip. `--review-scrim` stays.
- Clocks: `--clock-waiting-bg/ink` = `--surface-2`/`--soft`, `--clock-running-bg/ink` = `--ink`/`--bg`, `--clock-low-bg/ink` = `--accent`/`--surface`. All three pairs reach 4.5:1.
- **Text rule:** `--gold` is never a text color, only bars, borders and the ★. Red ink (`--accent`) is allowed as text (marks, the GM tag background, low time).
- The old tokens (`--dark-*`, `--liem-*`, `--book-bar`, `--review-page`, `--board-sound-on`, `--background`, `--text`) stay defined until C1 removes them. No slice adds a new use of them.
- **Literal colors:** no CSS file outside `src/index.css` names a hex, `rgb()` or `hsl()` color or a `gradient(`. `transparent`, `currentColor` and `inherit` are allowed. No `font-size` is under 14px.

**Base classes** (L1 owns `src/styles/look.css` and `src/features/board/components/Button.css`; no other slice edits them):
- `.card`: `--surface` background, 16px padding, a 1px `--line` border and a 4px radius. `.card--flush` has no padding (the move lists). `.card__head` is the card's title row. `.card__foot` is a row of controls with an 8px gap and a top `--line` border. `.stack` is a column with a 12px gap between cards.
- `.button` is the secondary style: transparent, `--ink` text, `--line` border. `.button--play` is the primary style (`--go` / `--go-ink`). `.button--icon` is 40×40 on `--surface-2`. `.button--sound-on` uses `--go` / `--go-ink`. An `<a class="button">` looks the same as a button. Disabled controls are at 0.4 opacity. Every button, link and `[role=radio]` shows a 3px `--board-focus` ring on `:focus-visible`.
- `.scoresheet` (the signature detail) has rows (`.scoresheet__row`) on alternate `--surface-2`, a move number in `--soft`, the current move in an ink chip (`.scoresheet__current`: `--ink` background, `--bg` text), and marks in red ink (`.scoresheet__mark`).
- `tests/look-helpers.ts` (L1) exports `rootTokens`, `token`, `contrast`, `rules`, `declarations`, `cssFiles` and `lookViolations(css)`. `lookViolations` lists literal colors, gradients and font sizes under 14px. Each slice's CSS test calls it on the files that slice owns.

**Level names** (N1, in `src/features/liem/levelView.ts`, the one place to change them):
- `LEVEL_NAMES`: 1400 Easy, 1700 Medium, 1900 Hard, 2100 Harder, 2300 Expert, 2500 Master, `"full"` Liem.
- `LevelView` keeps `sparring`, `title`, `glyph`, `avatar`, `detail`, `shortDetail`, `detailLead`, `engineLine` and `outText`. It drops `value`, `valueLead` and `valueMain`, and adds:
  - `stepName`: "Medium", or "Liem".
  - `starred`: true only at Liem, and drawn as an ochre ★ before the name.
  - `opponentName`: "Medium", or "Liem".
  - `rating`: `null` for sparring, "GM · 2732" at Liem.
- Sparring: `name` "Medium", `detail` "Plays Liem's openings", `stepLabel` "Medium". `engineLine` reads "A sparring bot plays his openings, then Stockfish at the Medium level." `outText` reads "Stockfish at the Medium level plays from here. It isn't trained on his games." The Liem texts don't change.
- No sparring level puts a rating or "about" in any text or `aria-label`. The default level stays 2100, now "Harder" (decision 2026-10-10).

**Screens** (R1, `src/app/route.ts`):
- `type Screen = "home" | "play" | "two-players" | "review"`.
- `parseHash(hash)`: `""`, `"#"` and `"#/"` give `home`. `"#/play"`, `"#/two-players"` and `"#/review"` give their screen, matched exactly (so `#/play/` and `#/PLAY` don't match). Anything else gives `null`.
- `hashFor(screen)` is the inverse, with `"#/"` for home.
- `goTo(screen)` sets `location.hash`, which adds a history entry. It does nothing when there's no `window`.
- `arriveAt(requested: Screen | null)` is a thunk that brings the store in line and returns the screen to show:
  - `null` → home.
  - **home:** in two-player mode, `switchMode("liem")`. Else, with a game started or the review open, `goHome()`. Already home, it changes nothing (same `gameId`). Level and color picks are kept.
  - **play:** with a vs-Liem game started (mode `liem`, `setupOpen` false, running or over), close the review if it's open (it keeps its evals and status) and return play. Else go home.
  - **two-players:** if the mode isn't two-player, `switchMode("two-player")`, which gives a fresh board. Already two-player, the game in progress is kept.
  - **review:** `canOpenReview` → `openReview()` and return review. A reopen of the same game resumes the pass. Else, with a vs-Liem game started → play. Else → home.
  - Whenever it returns home, the store is in the home state: mode `liem`, `setupOpen` true, review closed.
- `useHashRoute()` (`src/app/useHashRoute.ts`) runs `arriveAt` on mount and on every `hashchange`. When the shown screen's hash differs from `location.hash`, it calls `history.replaceState` with the shown hash. That adds no history entry and fires no `hashchange`.
- A reload loses the store, so a reload of `#/play` or `#/review` goes home. Going home (← Home, Back or an edited hash) ends the game in progress. Board unmounts on home, so the next game loads his engine again, from the browser cache.
- `liemActions.ts` (R1):
  - `goHome()`: reset plus `openSetup`.
  - `replayLiemGame(random?)`: only with a vs-Liem game started. It resets, then starts at the same `strength` and `colorPick` (Random draws again) and flips the board to the new color. It clears any review.
  - `startLiemGame` stays: home's Play calls it, then `goTo("play")`.

**Screen markup** (for tests and the smoke recipe):
- `App.tsx` renders `<Home />` on home, or `<div className="app" data-screen="…"><Board /></div>` on every other screen.
- Home's root is `.home`. It holds a radiogroup `aria-label="Level"` with 7 `role="radio"` steps (`aria-label` = `stepLabel`), a radiogroup `aria-label="You play"`, Play (`.button--play`) and `a[href="#/two-players"]`.
- The board screen's top bar is `header.top-bar` (56px): `a.top-bar__home[href="#/"]` "← Home", then `.top-bar__title`. B1's pure `topBarTitle(input)` (`src/features/board/topBar.ts`) gives the title:
  - "vs Medium · you play White"
  - "vs Liem · you play Black"
  - "Two players"
  - "Review · vs Medium"
- The board column stays `.board` with `width = 8 × square size`, holding the top card, `.squares` and the bottom card. Square sizes and breakpoints don't change: `squareSizeFor(wide768, wide1200)` gives 39, 52 or 78 px. From 992px up, the board column and a 380px sidebar sit side by side with a 24px gap. Below 992px, they stack.
- Moves card: `.card.moves-card` holds the `.notation` list and a `.card__foot`.
  - **vs Liem foot:** **Review game** (`a.button.button--play[href="#/review"]`, only when `canOpenReview`), then **New game** (`replayLiemGame`), Flip and Sound.
  - **Two players foot:** Play, New game (the old Reset, same action), Flip and Sound.
- Player card: the existing classes stay (`.player`, `.player__info`, `.player__name`, `.player__detail`, `.liem-sparring-avatar`). `.player__material[data-material="N"]` sits beside `.player__name`, and is left out when that side has captured nothing and isn't ahead.

**Material** (P1, `src/features/board/material.ts`):
- `materialLine(state: GameState, color)` returns `{ captured, advantage }`, both read from the board.
- `captured` lists the opponent's pieces missing from their starting count, highest value first. A promoted piece counts as its new kind.
- `advantage` is the side's piece value (P 1, N 3, B 3, R 5, Q 9) minus the other side's, or 0 when the side isn't ahead. So promotions count.

## Per-slice detail

### L1: Look: scorebook tokens, Quicksand, base controls and cards
- **Scope:**
  - Set every token in the contract and point `body` at `--bg`, `--ink`, `--font` and `--text-body`. Keep the old tokens.
  - Write `look.css` (imported from `src/index.tsx`) and `Button.css` as the base classes in the contract. The Play and Sound greens go, and controls lose their browser defaults.
  - Keep Quicksand 500 and 700 self-hosted.
  - Add `tests/look-helpers.ts`. Move today's theme tests onto it and onto the new values: the clock, board, review and liem token tests that assert old values or old pairs. Delete `tests/ladder-look.test.ts`, whose "no new tokens" and dark-card checks are obsolete. Don't restyle any component.
- **Files owned:**
  - `src/index.css`, `src/index.tsx`, `src/styles/look.css` (new), `src/features/board/components/Button.css`
  - `tests/look-helpers.ts` (new), `tests/look.test.ts` (new), `tests/theme.test.ts`, `tests/board-theme.test.ts`, `tests/review-theme.test.ts`, `tests/liem-theme.test.ts`, `tests/ladder-look.test.ts` (delete), `src/features/board/__tests__/sound-button.test.tsx`
- **Success criteria:**
  - `[test]` Each palette, board, space, type and radius token has its contract value, declared once — `tests/look.test.ts › tokens have the Look values`
  - `[test]` `--ink` and `--soft` reach 4.5:1 on `--bg`, `--surface` and `--surface-2`, and `--go-ink` reaches 4.5:1 on `--go` — `tests/look.test.ts › text pairs meet 4.5:1`
  - `[test]` Each grade reaches 4.5:1 on `--surface` and `--surface-2`, stays under 5.5:1 on `--surface-2`, and keeps its hue within 10° of today's. `--grade-ink` on each grade reaches 4.5:1 — `tests/look.test.ts › grades are retuned for cream`
  - `[test]` The three clock pairs reach 4.5:1 — `tests/theme.test.ts › clock pairs meet 4.5:1`
  - `[test]` `--gold` is never a `color` in any CSS file under `src/` — `tests/look.test.ts › ochre is never text`
  - `[test]` Quicksand 500 and 700 `@font-face` rules name files in `src/assets/fonts/`, and no CSS under `src/` loads http(s) — `tests/theme.test.ts › quicksand is served from the app`
  - `[test]` The card rule has a 16px pad, a 1px `--line` border and a 4px radius. The `.stack` gap is 12px — `tests/look.test.ts › card style`
  - `[test]` `.button`, `.button--play`, `.button--icon` and `.button--sound-on` use only their contract tokens. Each has `appearance: none` and a `:focus-visible` ring — `tests/board-theme.test.ts › buttons follow the Look`
  - `[test]` `lookViolations` flags a hex, `rgba()`, a gradient and `font-size: 13px`, and passes a token-only rule. `look.css` and `Button.css` have none — `tests/look.test.ts › look helper finds violations`
  - `[test]` `--board-check` has no gradient — `tests/board-theme.test.ts › board tokens have the Look values`
  - `[manual]` The page background is cream and the board is wood, at 1400 and 375px — `npm run dev`, open `/chess-web/` with `npx -y chrome-devtools-axi`
- **Depends on:** —
- **One-way door:** none
- **Model:** opus

### N1: Level names instead of ratings
- **Scope:**
  - Change `levelView` to the contract's level names and fields, and update `SetupCard.tsx` to read `stepName`, `starred` and `rating` until B1 deletes it.
  - Update tests that assert "Sparring · N" or "about N".
  - In `pod-docs/codebase-structure.md`, update only the Smoke recipe lines that quote level texts, and the Sound button's color (now ink when on).
  - The numbers stay in `STRENGTH_STEPS`, `strengthLabel` and `npm run calibrate`.
- **Files owned:** `src/features/liem/levelView.ts`, `src/features/liem/__tests__/level-view.test.ts`, `src/features/liem/components/SetupCard.tsx`, `src/features/liem/__tests__/setup-card.test.tsx`, `src/features/liem/__tests__/book-note-render.test.tsx`, `src/features/board/__tests__/board-modes.test.tsx`, `pod-docs/codebase-structure.md`
- **Success criteria:**
  - `[test]` The 7 steps map to Easy, Medium, Hard, Harder, Expert, Master and Liem, in order — `src/features/liem/__tests__/level-view.test.ts › level names`
  - `[test]` A sparring view reads `name` "Medium", `detail` "Plays Liem's openings", `rating` null and `starred` false, with the contract's engine and out-of-book lines — `level-view.test.ts › sparring view`
  - `[test]` The Liem view has `rating` "GM · 2732", `starred` true and `stepLabel` "Liem (2732)", and its other texts are unchanged — `level-view.test.ts › liem view`
  - `[test]` No string field of any sparring view contains a 4-digit number or "about" — `level-view.test.ts › no ratings on sparring levels`
  - `[test]` The out-of-book note at 1400 reads "Stockfish at the Easy level plays from here. …" — `src/features/liem/__tests__/book-note-render.test.tsx › out of book names the level`
  - `[test]` His card at 2100 reads "Harder", and its clock is labelled "Clock for Harder" — `src/features/board/__tests__/board-modes.test.tsx › sparring and Liem cards`
- **Depends on:** —
- **One-way door:** none
- **Model:** opus

### R1: Hash screens: route rules, Home and New game actions
- **Scope:**
  - `route.ts` (`parseHash`, `hashFor`, `goTo`, `arriveAt`), `useHashRoute.ts` (glue only: no rules) and `goHome` and `replayLiemGame` in `liemActions.ts`, all as the contract says.
  - Keep `newLiemGame` and `switchMode` working. No UI.
- **Files owned:** `src/app/route.ts` (new), `src/app/useHashRoute.ts` (new), `src/app/__tests__/route.test.ts` (new), `src/features/liem/liemActions.ts`, `src/features/liem/__tests__/liem-actions.test.ts`
- **Success criteria:**
  - `[test]` `""`, `"#"` and `"#/"` give home. The three screen hashes give their screens. `"#/play/"`, `"#/PLAY"`, `"#play"` and `"#/x"` give `null`. `hashFor` round-trips — `src/app/__tests__/route.test.ts › parses hashes exactly`
  - `[test]` An unknown hash shows home on a fresh store — `route.test.ts › unknown hash goes home`
  - `[test]` A fresh store at `#/play` shows home (a reload with no game) — `route.test.ts › play with no game goes home`
  - `[test]` A fresh store at `#/review` shows home. A game in progress at `#/review` shows play. A finished game with a move of yours shows review, with the review open — `route.test.ts › review needs a finished game`
  - `[test]` Back from review to play mid-analysis closes the review and keeps its evals. Forward again reopens it with status `analysing` — `route.test.ts › back and forward between review and play`
  - `[test]` Home from a vs-Liem game, running or over, ends it: `gameId` + 1, `setupOpen` true, review closed. Strength 1900 and Black stay picked — `route.test.ts › home ends the game and keeps the picks`
  - `[test]` Home while already home changes nothing (same `gameId`) — `route.test.ts › home is idempotent`
  - `[test]` From home, `#/two-players` gives a fresh two-player board. A second arrival keeps the moves played. Home from there returns mode `liem` with the card state — `route.test.ts › two players and back`
  - `[test]` `#/play` in two-player mode shows home and puts the store in the home state — `route.test.ts › play is vs Liem only`
  - `[test]` `replayLiemGame` keeps strength and color pick and gives a new `gameId` with the clocks running. Random draws again through the injected `random`. As Black the board is flipped. The review is cleared. It does nothing on home or in two-player mode — `src/features/liem/__tests__/liem-actions.test.ts › replay keeps level and color`
  - `[test]` His answer for the old game is dropped after `replayLiemGame` — `liem-actions.test.ts › replay drops a stale answer`
  - `[test]` `goTo` does nothing without `window` — `route.test.ts › goTo without window`
- **Depends on:** —
- **One-way door:** none
- **Model:** opus

### H1: Home page and the screen switch
- **Scope:**
  - The home page from the plan's Scope and Look:
    - The ♞ mark and "Sparring".
    - Hero "Practice a grandmaster's openings."
    - The draft's paragraph. His name and title come from `LIEM.entry`, never typed in.
    - The Level picker: 7 named steps, ochre bars lit up to the pick, "★ Liem" in ink with an ochre ★, the picked `stepName` beside the label, and `rating` beside it only at Liem.
    - `engineLine` under the picker.
    - You play: White, Black or Random.
    - **Play**: `startLiemGame()` then `goTo("play")`.
    - "Two players on one board →" (`#/two-players`).
    - The strip: His openings · From his real games, Then Stockfish · At your level, Review · Find your better moves.
  - No photo, no "beat" text. One column, at most 480px wide and centred.
  - The picker writes `setStrength` and `setColorPick`, so the picks last until a reload. A small `RadioGroup` with `radioKeyIndex` moves into `src/features/home/`.
  - `App.tsx` mounts `useHashRoute` and renders the contract's markup.
  - Update the Smoke recipe for the home page, the hash screens, the top bar, the Moves card, "+N" and Two players from home, using contract selectors. Add no new Layout paths.
  - Use only the tokens, and follow the Look.
- **Files owned:** `src/App.tsx`, `src/features/home/Home.tsx` (new), `src/features/home/Home.css` (new), `src/features/home/RadioGroup.tsx` (new), `src/features/home/__tests__/home.test.tsx` (new), `src/features/home/__tests__/radio-group.test.ts` (new), `tests/home-css.test.ts` (new), `pod-docs/codebase-structure.md`
- **Success criteria:**
  - `[test]` Home renders the mark, the name, the hero, the paragraph with "GM Le Quang Liem", the strip, Play and the two-players link — `src/features/home/__tests__/home.test.tsx › home content`
  - `[test]` Home has no `<img>` and no "beat" — `home.test.tsx › no photo or beat him`
  - `[test]` The level group has 7 radios in order, with the pick checked and the steps up to it lit. At a sparring pick the markup has no 1400–2500 and no "about". At Liem it shows "GM · 2732" — `home.test.tsx › level picker`
  - `[test]` The picks save and reload: a store at Hard and Black renders those checked. A fresh store renders Harder and White — `home.test.tsx › picks are remembered`
  - `[test]` The engine line follows the pick — `home.test.tsx › engine line names the level`
  - `[test]` Arrow keys, Home and End move and wrap — `src/features/home/__tests__/radio-group.test.ts › arrow keys move and wrap`
  - `[test]` `Home.css` has no `lookViolations`, and its column is `max-width: 480px` — `tests/home-css.test.ts › home follows the Look`
  - `[manual]` Look at home at 1400 and 375px: one centred column, no horizontal scroll, matches the draft's direction B in Quicksand. Press Play at Medium as White: the URL is `#/play`. Back returns home — `npm run dev`, `npx -y chrome-devtools-axi`
- **Depends on:** L1, N1, R1
- **One-way door:** none
- **Model:** opus

### B1: Board screen: top bar, Moves card, no tabs or setup card
- **Scope:**
  - Rework `Board.tsx`'s game layout (not the review branch) to the contract:
    - The top bar with `topBarTitle`, and the board column.
    - The sidebar: the book note (vs Liem only, from `BookNote`), then the Moves card. `Notation` becomes the scoresheet with its `.notation` class kept. The Fallen Pieces panel and the buttons box go.
  - Delete `ModeTabs`, `SetupCard` (and their CSS and tests) and `FallenPieces`/`FallenPiece`.
  - In `Button.tsx`, Reset's label becomes "New game".
  - Extract `squareSizeFor`, which the review uses too.
  - Restyle `App.css` (keep the review's grid rules working until V1), `Notation.css`, `BoardSidebar.css` and the top bar.
  - Don't edit `Board.css`. Stop using `.squares__overlay`, `.liem-dimmed`, `.liem-side` and `.buttons`.
  - In the review branch, swap only the New game button for `replayLiemGame`.
  - Use only the tokens, and follow the Look.
- **Files owned:**
  - `src/features/board/Board.tsx`, `src/App.css`, `src/features/board/topBar.ts` (new), `src/features/board/boardSize.ts` (new), `src/features/board/components/TopBar.tsx` (new), `src/features/board/components/TopBar.css` (new), `src/features/board/components/Notation.tsx`, `src/features/board/components/Notation.css`, `src/features/board/components/BoardSidebar.tsx`, `src/features/board/components/BoardSidebar.css`, `src/features/board/components/Button.tsx`
  - Deleted: `src/features/board/components/FallenPieces.tsx`, `src/features/board/components/FallenPieces.css`, `src/features/board/components/FallenPiece.tsx`, `src/features/board/components/FallenPiece.css`, `src/features/liem/components/ModeTabs.tsx`, `src/features/liem/components/SetupCard.tsx`, `src/features/liem/components/SetupCard.css`, `src/features/liem/__tests__/setup-card.test.tsx`, `tests/setup-card-css.test.ts`
  - Tests: `src/features/board/__tests__/board-modes.test.tsx`, `src/features/board/__tests__/board-new-position.test.tsx`, `src/features/board/__tests__/board-flip.test.tsx`, `src/features/review/__tests__/board-review.test.tsx`, `src/features/board/__tests__/top-bar.test.ts` (new), `src/features/board/__tests__/board-size.test.ts` (new), `tests/board-screen-css.test.ts` (new)
- **Success criteria:**
  - `[test]` `topBarTitle` gives the contract's four titles, with the resolved color when the pick was Random — `src/features/board/__tests__/top-bar.test.ts › titles`
  - `[test]` `squareSizeFor` gives 39, 52 and 78, and the `.board` width is 8 × that — `src/features/board/__tests__/board-size.test.ts › square sizes keep their rules`
  - `[test]` A vs-Liem game renders the top bar with `a[href="#/"]`, no tablist, no setup dialog, no Fallen Pieces, and a sidebar of book note then Moves card — `board-modes.test.tsx › vs Liem board screen`
  - `[test]` The vs-Liem foot reads New game, Flip and Sound. Review game (`href="#/review"`) shows only after a finished game with a move of yours, never mid-game or in Two players — `board-modes.test.tsx › moves card foot` and `src/features/review/__tests__/board-review.test.tsx › the Review game link`
  - `[test]` New game mid-game keeps the level and color and restarts the clocks (new `gameId`). A stale answer isn't played — `board-modes.test.tsx › new game replays the level`
  - `[test]` The Two players foot reads Play, New game, Flip and Sound. New game clears the moves and stops the clocks, like Reset did. Play starts them — `board-modes.test.tsx › two players foot`
  - `[test]` The Moves card lists `1. e4 e5` as scoresheet rows, with the last move as `.scoresheet__current` — `board-modes.test.tsx › moves card scoresheet`
  - `[test]` The flip button keeps `aria-pressed`, and the cards follow the flip — `board-flip.test.tsx › flip button reflects state`
  - `[test]` The squares stay mounted across a move and a flip. Two-player New game, `startLiemGame` and `replayLiemGame` each give new layout ids — `board-new-position.test.tsx › each game has its own piece layout ids`
  - `[test]` `App.css`, `TopBar.css`, `Notation.css` and `BoardSidebar.css` have no `lookViolations`. The top bar is 56px. The sidebar is 380px from 992px up — `tests/board-screen-css.test.ts › board screen follows the Look`
  - `[manual]` At 1400, 992 and 375px, in both modes: one spacing scale, cream cards, no dark panels, no horizontal scroll. The board is the same size as before at each width — `npm run dev`, `npx -y chrome-devtools-axi`
- **Depends on:** L1, N1, R1
- **One-way door:** none
- **Model:** opus

### P1: Player cards with "+N", clocks, book note and badges in the Look
- **Scope:**
  - `materialLine` as the contract says, shown by `Player` (read from the store) as "+N" with the captured glyphs. "+N" is never cut. The glyphs and the name may end in an ellipsis.
  - Restyle in the Look:
    - The player card (56px kept) and the clock pill, with tabular figures.
    - The ♞ avatar on `--surface-2`.
    - The GM tag: `--accent` with `--surface` text.
    - "★ Book · N": ink text, `--gold` border and ★.
    - The Stockfish pill: `--soft` text, `--line` border.
    - "Thinking…".
    - The book note: a `.card` with a 3px left edge in `--gold` in book and `--accent` out of book, and `--gold` bars.
  - Move every `.board > .player …` rule from `Board.css` into `Player.css`, and delete the dead `.liem-star` rule (queue 2026-10-18). Keep the phone rules: the line drops "Plays "/"GM · ", and the badge drops its count.
  - Delete the dead tab, setup card, tile, step and dimmed rules from `liem.css`.
  - Keep the class names in the contract. Use only the tokens, and follow the Look.
- **Files owned:**
  - `src/features/board/material.ts` (new), `src/features/board/__tests__/material.test.ts` (new)
  - `src/features/board/components/Player.tsx`, `src/features/board/components/Player.css`, `src/features/board/components/PlayerClock.tsx`, `src/features/board/Board.css`
  - `src/features/liem/components/LiemCardDetail.tsx`, `src/features/liem/components/BookNote.tsx`, `src/features/liem/components/BookNote.css`, `src/styles/liem.css`
  - `src/features/board/__tests__/player.test.tsx`, `src/features/board/__tests__/player-clock.test.tsx`, `tests/player-css.test.ts`, `tests/liem-theme.test.ts`
- **Success criteria:**
  - `[test]` At the start, `captured` is empty and `advantage` is 0 for both sides — `src/features/board/__tests__/material.test.ts › start position`
  - `[test]` After White takes a knight, White has `captured` [knight] and `advantage` 3, and Black has 0 — `material.test.ts › a capture`
  - `[test]` After an equal trade, both sides list their captures, with `advantage` 0 — `material.test.ts › an equal trade`
  - `[test]` A promotion to a queen counts: the advantage includes +8, and the pawn shows as captured only if it was really taken — `material.test.ts › promotions count`
  - `[test]` The card renders `.player__material[data-material="3"]` with "+3" after a knight capture, and no material element at the start — `src/features/board/__tests__/player.test.tsx › material line`
  - `[test]` Existing card markup is unchanged at the start: the avatar, the glyph and the title-then-name order — `player.test.tsx › Player avatar`
  - `[test]` The clock uses only the `--clock-*` tokens, with `font-variant-numeric: tabular-nums`, and the hand still has its reduced-motion rule — `tests/player-css.test.ts › clock styles use only the tokens`
  - `[test]` `Player.css`, `Board.css`, `liem.css` and `BookNote.css` have no `lookViolations`. No `--liem-*` is used. `--gold` is never `color`. No `.liem-tab`, `.liem-tile`, `.liem-step`, `.setup-card` or `.liem-dimmed` rule remains. The phone-hiding rules still apply below 768px — `tests/liem-theme.test.ts › player cards and book note follow the Look`
  - `[test]` The GM tag and badge text reach 4.5:1 on their backgrounds — `liem-theme.test.ts › badge and GM tag contrast`
  - `[manual]` His card, your card and the book note at 1400 and 375px: in book, out of book, "Thinking…", after captures, and at Liem. "+N" is readable and nothing overlaps the clock — `npm run dev`, `npx -y chrome-devtools-axi`
- **Depends on:** L1, N1
- **One-way door:** none
- **Model:** opus

### G1: Board pieces in the Look: squares, promotion picker, game-over notice
- **Scope:**
  - Restyle the square labels (ink, at least 14px), the overlay, the promotion picker (a `.card`-like box with `--surface-2` hover) and the game-over notice (a card over the board, title 20px, words unchanged).
  - Clamp `promotionPlacement` so the picker never passes the board's edge, flipped or not (queue 2026-10-06). The review board picks this up through the same function.
  - Use only the tokens, and follow the Look.
- **Files owned:** `src/features/board/components/Square.css`, `src/features/board/components/Piece.css`, `src/features/board/components/Overlay.tsx`, `src/features/board/components/Overlay.css`, `src/features/board/components/Promotion.tsx`, `src/features/board/components/Promotion.css`, `src/features/board/components/GameOver.tsx`, `src/features/board/components/GameOver.css`, `src/features/board/orientation.ts`, `src/features/board/__tests__/orientation.test.ts`, `src/features/board/__tests__/game-end-stop.test.tsx`, `tests/board-css.test.ts`
- **Success criteria:**
  - `[test]` On a8, h8, a1 and h1, flipped and not, the picker's edge is at 0 or inside the board. The e8 and e1 placements don't change — `src/features/board/__tests__/orientation.test.ts › picker stays inside the board`
  - `[test]` The board CSS files have no `lookViolations`, use the `--board-*` tokens, and the label color reaches 4.5:1 on both square colors — `tests/board-css.test.ts › board styles follow the Look`
  - `[test]` The game-over notice still reads "White Win!", "Black Win!" or "Draw!" — `src/features/board/__tests__/game-end-stop.test.tsx` (unchanged, must pass)
  - `[manual]` At 1400 and 375px: the check mark, last-move tint, hints, drag drop edge, the picker on an edge file both ways, and the game-over notice — `npm run dev`, `npx -y chrome-devtools-axi`
- **Depends on:** L1
- **One-way door:** none
- **Model:** opus

### V1: Review: graph in the sidebar and phone sheet, top bar, Look
- **Scope:**
  - The review branch of `Board.tsx`:
    - The top bar: `topBarTitle` "Review · vs Medium", ← Home, and **Play again** (`replayLiemGame` then `goTo("play")`).
    - The board column with `squareSizeFor` and the step buttons.
    - The sidebar in this order: the graph card (plot 80px), the key-moment card, accuracy, the move list (`.card--flush` scoresheet, with a foot of Back to game `a[href="#/play"]`, Flip and Sound), then "Left his book".
  - Remove the White/You switch: drop `graphSide` and `setGraphSide`. The graph always shows your side, and a click still jumps to the move.
  - Phones (below 768px): the pure `graphPlacement({ wide, sheetOpen, low })` returns `"sheet"` only when not wide, the sheet is open and the sheet isn't low. Otherwise it returns `"sidebar"`, so the graph shows exactly once.
  - Restyle `review.css` and every review component's CSS. Remove the `Board.css` and `App.css` rules nothing uses.
  - In `codebase-structure.md`, update the Smoke recipe's Game review step.
  - Use only the tokens, and follow the Look.
- **Files owned:**
  - `src/features/board/Board.tsx`, `src/features/board/Board.css`, `src/App.css`, `src/styles/review.css`
  - `src/features/review/reviewSlice.ts`, `src/features/review/graphGeometry.ts`, `src/features/review/reviewLayout.ts` (new)
  - `src/features/review/components/ReviewGraph.tsx`, `src/features/review/components/ReviewGraph.css`, `src/features/review/components/BottomSheet.tsx`, `src/features/review/components/BottomSheet.css`, `src/features/review/components/KeyMomentCard.tsx`, `src/features/review/components/KeyMomentCard.css`, `src/features/review/components/MoveList.tsx`, `src/features/review/components/MoveList.css`, `src/features/review/components/AccuracyPanel.tsx`, `src/features/review/components/LeftBookNote.tsx`, `src/features/review/components/StepButtons.tsx`, `src/features/review/components/ReviewBoard.css`
  - Tests: `src/features/review/__tests__/review-panels.test.tsx`, `src/features/review/__tests__/review-card.test.tsx`, `src/features/review/__tests__/review-slice.test.ts`, `src/features/review/__tests__/graph-geometry.test.ts`, `src/features/review/__tests__/board-review.test.tsx`, `src/features/review/__tests__/review-layout.test.ts` (new), `tests/review-theme.test.ts`
  - Docs: `pod-docs/codebase-structure.md`
- **Success criteria:**
  - `[test]` On desktop, the sidebar order is graph, key-moment card, accuracy, move list, book note, and there's no full-width graph strip — `src/features/review/__tests__/board-review.test.tsx › review sidebar order`
  - `[test]` The top bar has ← Home and Play again. Play again gives a new game at the same level and color, and clears the review — `board-review.test.tsx › play again replays the level`
  - `[test]` Back to game links `#/play`, and the foot has Flip and Sound — `board-review.test.tsx › moves card foot in the review`
  - `[test]` The graph has no side switch and plots your side as Black and as White. Clicking still calls `onSelect` with the nearest position — `src/features/review/__tests__/review-panels.test.tsx › graph shows your side`
  - `[test]` `graphPlacement` returns sidebar when wide, sheet when narrow and open, and sidebar when narrow and closed or low — `src/features/review/__tests__/review-layout.test.ts › graph shows once`
  - `[test]` On phones, the open sheet has the graph above the key-moment card — `board-review.test.tsx › phone sheet starts with the graph`
  - `[test]` The review slice has no `graphSide`, and the other reducers behave as before — `src/features/review/__tests__/review-slice.test.ts › no graph side`
  - `[test]` The review CSS files, `Board.css` and `App.css` have no `lookViolations`. The graph plot is 80px tall. No rule for `.review-top`, `.review-graph__sides`, `.squares__overlay`, `.liem-side` or `.buttons` remains — `tests/review-theme.test.ts › review follows the Look`
  - `[manual]` Finish a game (1.f3 e5 2.g4) and press Review game. At 1400, 992 and 375px: the graph sits in the sidebar above the key-moment card, and on a phone it's in the sheet first. Back goes to `#/play`, then home. Grades are readable on cream — `npm run dev`, `npx -y chrome-devtools-axi`
- **Depends on:** B1, P1, R1
- **One-way door:** none
- **Model:** opus

### C1: Remove old tokens and styles; decisions, docs and README
- **Scope:**
  - Delete the old tokens in the contract from `index.css`, and the exports no code calls any more (`newLiemGame`, if unused).
  - Add a guard test over all of `src/`.
  - `pod-docs/decisions.md`:
    - Entries replacing "The page opens on vs Liem", "Sparring and Liem labels", the vs-Liem look tokens, "App green darkened to #047A4F", and the phone defaults this layout changes ("~2100", "2732 on phones", the setup card's 14px line).
    - This sprint's defaults: going home ends the game; New game redraws Random; the graph shows once by `graphPlacement`; Back to game stays in the review; Review game sits in the Moves card; "+N" counts promotions; the engine reloads after home; the default level stays Harder; the grade and low-time values used.
  - `pod-docs/codebase-structure.md`: Layout and Stack & conventions (tokens, `look.css`, routes, home, no tabs) and a final Smoke recipe pass.
  - `README.md`: the home page and the hash links.
- **Files owned:** `src/index.css`, `src/features/liem/liemActions.ts`, `tests/leftover-styles.test.ts` (new), `tests/docs.test.ts`, `pod-docs/decisions.md`, `pod-docs/codebase-structure.md`, `README.md`
- **Success criteria:**
  - `[test]` No file under `src/` names a `--dark-*`, `--liem-*`, `--book-bar`, `--review-page` or `--board-sound-on` token, or the bare `--background` or `--text` token (`--text-body` and the other type tokens are fine) — `tests/leftover-styles.test.ts › no old tokens`
  - `[test]` Every `var(--x)` in `src/` CSS and TSX is declared in `index.css` — `leftover-styles.test.ts › every token used is defined`
  - `[test]` No CSS file under `src/` has a `lookViolations` entry — `leftover-styles.test.ts › every stylesheet follows the Look`
  - `[test]` Docs still pass: Layout paths exist and the smoke recipe names real scripts — `tests/docs.test.ts` (unchanged, must pass)
  - `[manual]` Drive every `pod-docs/features.md` browser row on `npm run preview` at `/chess-web/`, and the plan's Verification list at 1400, 992 and 375px — `npx -y chrome-devtools-axi`
- **Depends on:** H1, B1, P1, G1, V1
- **One-way door:** none
- **Model:** opus
