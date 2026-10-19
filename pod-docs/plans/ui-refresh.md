# Plan: UI refresh — home page, scorebook look, review sidebar

_Generated: 2026-10-19 · Status: active · Grilled-with: grilling_
Port base: 3200

## Goal
Give the app a front door and one consistent look before calling it finished. A new home page is where you pick a level and color and press Play. The board screen only plays, the review's win-% graph moves into the sidebar, and every screen moves to one light "scorebook" look with one spacing scale and one card style.

## Why
The human's words: the review graph is "kinda far away from the analysis sideboard"; they want "a home page to start first, not just straight to the board"; and there is "some inconsistency in the gap, for example the gap between the tab and the chessboard". The early UI and the newer vs Liem and review UI feel like two apps, so "review everything again… remove or update every UI".

They also don't want ratings on the sparring levels: a 1000-rated player who beats "1400" easily would think the app is wrong. Levels get plain names instead.

Success:
- The site opens on a home page. Play goes to the board, the review opens after a game, and the browser's back button moves between them.
- No sparring level shows a rating anywhere a person reads it. Only Liem shows "GM · 2732".
- In the review, the graph sits in the sidebar next to the key-moment card, at desktop and in the phone sheet.
- Every screen uses the Look's tokens and the spacing scale, with no leftover dark panels, at desktop and 375 px.
- Nothing about play changes: his book, the levels' strength, the clocks, Two players, the review's grading.

Constraints: static GitHub Pages site under `/chess-web/`, so no server routes; our own rules engine; Stockfish in a Web Worker; self-hosted fonts; GPL-3.0-or-later.

## Scope
**In scope:**
- **Home page** (new, the first screen):
  - The app mark (♞) and name "Sparring".
  - A headline about practising a grandmaster's openings, and one short paragraph: bots play GM Le Quang Liem's opening lines from his real games, then Stockfish takes over at the level you pick, and every game ends with a review.
  - No photo, and no "beat him" message.
  - A level picker with the seven steps, your color (White, Black, Random), a **Play** button, and a "Two players on one board" link.
  - A three-part strip: his openings · then Stockfish · review.
  - It remembers the last level and color you picked, as today.
- **Screens by hash link:** `#/` home, `#/play` the vs Liem board, `#/two-players` the two-player board, `#/review` the review of the game that just ended.
  - Back and forward work.
  - A reload of `#/play` with no game in progress goes home.
  - A reload of `#/review` with no finished game goes home.
  - An unknown hash goes home.
- **Board screen:**
  - The vs Liem / Two players tabs and the challenge card are removed.
  - A top bar shows **← Home** and what's being played (for example "vs Medium · you play White").
  - Player cards above and below the board show a "+N" material line with the captured pieces. The Fallen Pieces panel goes.
  - The sidebar has the book note (vs Liem only), then one Moves card with New game, Flip and Sound in a row at its foot. The separate buttons box goes.
  - **New game** in vs Liem starts a new game at the same level and color. **← Home** is how you change them.
- **Two players:** the same board screen, from the home page link. **Reset** becomes **New game**, and **Play** stays.
- **Level names:** the seven steps read Easy, Medium, Hard, Harder, Expert, Master and ★ Liem, where today they read 1400 … 2500 and Liem.
  - A bot's card reads its name (for example "Medium") with "Plays Liem's openings".
  - The out-of-book note and the home page's engine line name the level, not a rating.
  - The numbers stay in code, `npm run calibrate` and the docs.
- **Review layout:**
  - On desktop, the win-% graph leaves the full-width strip above the board for the top of the review sidebar, at about 80 px tall. The key-moment card, accuracy and move list follow below it.
  - The "White / You" switch goes: the graph always shows your side.
  - Clicking a point still jumps to that move.
  - On phones, the graph is at the top of the bottom sheet.
  - **← Home** and **Play again** sit in the top bar.
- **One look everywhere:** the Look below replaces today's dark tokens on every screen.
  - Every screen means: home, both board modes, the review, the promotion picker, the game-over notice and the clocks.
  - It sets one spacing scale (4, 8, 12, 16, 24, 32 px) and one card style.
  - Every component is updated to match, and leftover styles and tokens nobody uses any more are removed.
- **Docs:**
  - `pod-docs/decisions.md`: entries replacing "The page opens on vs Liem" (now the home page), the sparring labels, the Liem look tokens, and the phone name and rating defaults this layout changes.
  - `pod-docs/features.md` rows, the smoke recipe and the README.

**Out of scope:**
- **A dark mode** (the Look is light only), or a theme switch.
- **Changes to play:** how the bots play, their strength, his book, the review's grading or the key moments.
- **New features:** saved games, accounts, online play, a clock choice, new piece images.
- **Marking his mistakes in the review's move list:** the review still marks only your moves.

## Sprint sequence

| Sprint | Goal | Status | Depends on |
|--------|------|--------|------------|
| refresh | The scorebook look as tokens, hash screens with the home page, the reworked board screen and review sidebar, level names, and every old style removed | done | — |

Status values: `planned` / `active` / `done`. The orchestrator only flips its row's Status — it does not rewrite Goal/Depends-on retroactively.

The `Depends on` column is the **only** cross-sprint dependency signal. Wave ordering and per-slice deps live inside the sprint doc and are opaque from here.

## Look
The human's pick: **"I like the classic look of the B score book but I don't like the serif font so can we change it to something like the A font."** So the look is B's palette, board, cards and buttons, set in A's Quicksand, from [the draft](../design-drafts/ui-refresh-look.html).
- **Thesis:** a light, paper-like study room: a wooden board, cream cards, ink-black buttons, and red ink for the moves that matter.
- **Palette:**
  - **Page:** `--bg` #F4EFE4
  - **Card:** `--surface` #FBF8F1
  - **Raised and alternate rows:** `--surface-2` #EFE8D8
  - **Lines:** `--line` #DCD2BD
  - **Text:** `--ink` #1E1B16
  - **Soft text:** `--soft` #6B6457
  - **Red ink**, for marks, the GM tag and low time: `--accent` #A8322B
  - **Ochre**, for level bars and the ★: `--gold` #B8860B
  - **Play button:** `--go` #1E1B16 with `--go-ink` #FBF8F1
  - **Board:** light #F0E3C8, dark #B98B5E
  - **Text rule:** ochre fails 4.5:1 on cream, so it's only for bars, the ★ and borders, never for text. "★ Liem" is ink text with an ochre star.
  - **Review grades:** keep their meaning (inaccuracy, mistake, blunder, found) but are retuned so each reads at 4.5:1 or better on `--surface` (default).
- **Type:**
  - **Font:** Quicksand only, self-hosted (500 and 700 are already in `src/assets/fonts/`), for headings, body, moves and clocks.
  - **Sizes:** hero 30 px, title 20 px, body 16 px. Small labels such as move numbers, counts and the "Plays Liem's openings" line are 14 px (default), and nothing is smaller.
  - **Clocks:** tabular figures.
- **Layout:**
  - **Home:** one column at most 480 px wide, centred, that stacks the same at 375 px.
  - **Board screen:** a 56 px top bar, then the board column (cards above and below) and a 380 px sidebar side by side from 992 px up. Below that, everything stacks: board, then sidebar.
  - **Review on a phone:** a bottom sheet with the graph first.
  - **Spacing:** 4, 8, 12, 16, 24 and 32 px only. Every card has a 16 px padding, a 1 px `--line` border and a 4 px radius, and there's a 12 px gap between cards.
- **Signature detail:** the move list reads like a scoresheet, with alternate rows in `--surface-2`, the current move in an ink chip, and marks in red ink.
- **Rules out:**
  - the serif font (Fraunces)
  - the old dark panels and their tokens (`--dark-*`, `--liem-*`), and browser-default controls
  - the green Play and Sound colors
  - photos or "beat him" copy on the home page
  - ratings on sparring levels
  - gradients and glows (look C)
- **Draft:** `pod-docs/design-drafts/ui-refresh-look.html` (direction B, with A's font)

## Key decisions
- **Home page first; no tabs or challenge card on the board screen.** This supersedes "The page opens on vs Liem" (2026-10-18). (human)
- **The home page has no photo and no "beat him" message.** It's about practising his openings. (human)
- **No ratings on sparring levels; they get plain names.** People would judge the app by a number. (human)
- **Level names are Easy, Medium, Hard, Harder, Expert, Master, ★ Liem.** (default — the human didn't pick; change in one place)
- **A bot's card reads "Medium" with "Plays Liem's openings".** (default)
- **Hash links** (`#/`, `#/play`, `#/two-players`, `#/review`), plus a Home button. They work on GitHub Pages with no server. (human)
- **The review graph moves into the sidebar** at about 80 px, without the "White / You" switch. On phones it goes in the sheet. (human)
- **Fallen Pieces becomes a "+N" line on the player cards; the buttons join the Moves card; Reset becomes New game; Play stays in Two players.** (human)
- **Look B with Quicksand, light only.** (human; "light only" is a default)
- **New game in vs Liem replays the same level and color.** Changing them goes through Home. (default)

## Known risks
- **A light theme changes every color.** Some may fail contrast on cream: the grade colors, the Stockfish pill, the check glow. Mitigation: token tests for 4.5:1 text contrast, and the Look check at both widths on every screen.
- **Removing old styles breaks something unseen,** such as the promotion picker, the game-over notice or drag highlights. Mitigation: drive every `pod-docs/features.md` browser row at the end, not only the touched ones.
- **Hash screens and the game state disagree,** for example back from the review mid-analysis, or a reload mid-game. Mitigation: the rules in Scope, each with a test.
- **The board gets smaller next to a 380 px sidebar on mid-size screens.** Mitigation: the board column keeps today's size rules, and the Look check covers 992 px as well as desktop and 375 px.

## Open questions
- **Grade colors on cream:** the value in use keeps today's hues, darkened only as much as 4.5:1 needs.
- **Low-time clock:** the value in use is red ink (`--accent`) with cream text.

## Verification
- `npm run build && npm test` pass.
- **Screens:** in `npm run preview` at `/chess-web/`:
  - The site opens on the home page.
  - Play at Medium as White reaches `#/play` with his book first.
  - Finishing a game and pressing Review reaches `#/review`, with the graph in the sidebar above the key-moment card.
  - Back returns to the board, then home.
  - Reloading `#/review` with no game goes home.
- **No ratings:** no sparring level shows "1400"–"2500" or "about" on any screen. The Liem step shows "GM · 2732".
- **Two players:** it opens from the home page link, and its New game and Play work as before.
- **Feature rows:** every `pod-docs/features.md` browser row passes, updated where the plan changed it on purpose.
- **Look:** home, both board modes and the review match the Look's tokens at 1400 px, 992 px and 375 px.
  - No horizontal scroll.
  - No `--dark-*` or `--liem-*` tokens left.
  - Quicksand served from the app.
  - Text contrast 4.5:1 or better, checked by token tests.
