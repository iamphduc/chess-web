# Plan: UI polish — calmer cards, resign, a clear game end, a compact review

_Generated: 2026-10-20 · Status: archived · Grilled-with: grilling (fast)_
Port base: 3200

## Goal
Polish the screens the `ui-refresh` plan shipped, from the human's first look at them. The page stops jumping (scroll and clocks), the board cards say less, you can resign, the end of a game is clear, and the review sidebar drops from five cards to three.

## Why
The human's words, after trying `ui-refresh`: "every time I make a move the scroll bar automatically scrolls to the top"; the user avatar "is not match our design"; the running clock should have "a fixed width so it's not … jump in out"; "Plays Liem's openings or Stockfish … looks busy"; the out-of-book note isn't needed ("once we are out of the opening move we will know that the bot is playing"); "I need a resign button"; "dim the board to make the endgame more prominent"; switch the graph and key-moment cards; and "too much review cards on the right side … more simple and compact". They also said "The UI looks very clean, I like it", so the Look stays, except the text weight: Quicksand at 500 "looks very thin like a paper which is not fit for a game website", so body text moves to 600.

Success:
- Playing a move never scrolls the page, at desktop or 375 px.
- A running clock never changes width.
- You can resign, and a resigned game ends like any other, with a review in vs Liem.
- The game-over notice stands out over a dimmed board and says how the game ended.
- The review sidebar is three cards, the key moment first.

Constraints: the `ui-refresh` Look and its tokens (`pod-docs/plans/ui-refresh.md` ## Look), static GitHub Pages site under `/chess-web/`, our own rules engine, Stockfish in a Web Worker, self-hosted fonts.

## Scope
**In scope:**
- **Scroll jump (bug):** a move must never scroll the page. Find the cause (for example a focus move, a remount or a scroll call) and fix it, with a test where possible. Check at desktop and 375 px, in vs Liem, Two players and the review.
- **Clocks:** a running clock keeps one width. Use tabular figures and a fixed minimum width, so the digits and the clock box never shift.
- **Your avatar:** the cartoon picture goes. Your card shows a round disc with your piece, ♔ when you play White and ♚ when you play Black, styled like his ♞ disc. In Two players, each card gets its own color's disc.
- **His card:** shows only the level name (or his name, photo and GM tag at the Liem step), the "+N" material line and the clock. "Plays Liem's openings" and the "Stockfish" pill go. "★ Book" stays only while he's in his book.
- **Book note:** the "In his book" card stays while he's in his book. When he leaves it, the card is gone: no "Out of his book" message, at any level.
- **Resign:**
  - A **Resign** button in the Moves card foot, next to New game, shown only while a game is in progress.
  - The first press turns it into a red **Confirm** for 3 seconds; a second press within that time resigns. Otherwise it turns back. The button keeps one width and never wraps, so the foot doesn't move.
  - In vs Liem, you lose, the clocks stop, and **Review game** shows as after any finished game.
  - In Two players, the side to move resigns.
- **Game over:** the board dims (a scrim of about 40 %) under a larger notice card. The card shows:
  - the result, such as "Black wins" or "Draw";
  - how the game ended: Checkmate, Stalemate, Time or Resigned;
  - **Review game** (vs Liem only) and **New game** buttons.
  - The final position stays visible under the scrim.
- **Review sidebar: three cards, in this order:**
  1. **Key moment** (unchanged content), now above the graph.
  2. **Summary:** the win-% graph with one accuracy line under it, for example "40 % · ?! 1 · ? 0 · ?? 1". This replaces the separate accuracy card.
  3. **Moves:** the scoresheet. The "Left his book at move N" note becomes one line at the top of the list, and the separate card goes.
  - On phones the sheet follows the same order, with the key moment first, then the summary.
- **Heavier text:** body text moves from Quicksand 500 to 600 everywhere; headings, buttons and other bold text stay at 700. Add the self-hosted Quicksand 600 file next to 500 and 700, and drop 500 if nothing uses it.
- **Docs:**
  - `pod-docs/decisions.md` entries for the changes: the avatar disc, the card text, no out-of-book note, resign, the game-over card, and the review order and cards.
  - `pod-docs/features.md` rows, and the smoke recipe.

**Out of scope:**
- **Changes to play,** such as strength, his book or grading.
- **A draw offer, or a takeback.**
- **Saving games.**
- **Dark mode,** which is parked in `pod-docs/ideas/dark-mode.md`.
- **New key-moment content,** such as marking his mistakes, parked in `pod-docs/ideas/mark-bot-mistakes.md`.

## Sprint sequence

| Sprint | Goal | Status | Depends on |
|--------|------|--------|------------|
| polish | Fix the scroll jump and clock width; heavier body text (600); calmer player cards and book note; resign; the dimmed game-over card; the three-card review | done | — |

Status values: `planned` / `active` / `done`. The orchestrator only flips its row's Status — it does not rewrite Goal/Depends-on retroactively.

The `Depends on` column is the **only** cross-sprint dependency signal. Wave ordering and per-slice deps live inside the sprint doc and are opaque from here.

## Look
The `ui-refresh` Look, with one change the human picked (draft section 0, option **B**: "Let's do B"): body text is Quicksand **600** instead of 500, and bold stays 700. Otherwise unchanged: the light scorebook palette, Quicksand only (self-hosted 600 and 700), and the 4/8/12/16/24/32 spacing scale with one card style (`pod-docs/plans/ui-refresh.md` ## Look). The new parts follow [the draft](../design-drafts/ui-polish.html):
- **Your disc:** the same size and style as his ♞ disc (`--surface-2` fill, ink glyph).
- **Game-over card:** a `--surface` card with a 20 px title, a 16 px soft reason line, and buttons in a row: Review game in the ink primary style, New game in the secondary style. The scrim is `--ink` at about 40 %.
- **Resign:** the secondary button style, at a fixed width (about 104 px, no wrap). **Confirm** uses red ink (`--accent`) text and border at the same width.
- **Summary card:** the 80 px graph, then the accuracy line in 16 px ink with the grade marks in their grade colors.
- **Rules out:** new colors or fonts, photos for you, gradients or glows, and pills on his card after his book.
- **Draft:** `pod-docs/design-drafts/ui-polish.html`

## Key decisions
- **The scroll jump is a bug, fixed first,** with its cause found. (human)
- **Clocks keep a fixed width.** (human)
- **Body text is Quicksand 600, bold stays 700** (human, option B in the draft). This changes the `ui-refresh` Look's type.
- **Resign keeps one width; its confirm label is a short red "Confirm".** (human: the longer "Confirm resign" made the button grow onto two lines)
- **Your avatar is a ♔/♚ disc that matches his ♞ disc.** (default, recommended and accepted)
- **His card drops "Plays Liem's openings" and the Stockfish pill; "★ Book" stays while in book.** (default, recommended and accepted). This supersedes the 2026-10-18 card text and the "Stockfish is named" pill.
- **No out-of-book note; the book card disappears when he leaves his book.** (default, recommended and accepted)
- **Resign sits in the Moves card foot, needs a second press within 3 s, and works in both modes.** (default, recommended and accepted)
- **The game-over card dims the board and shows the result, the reason, Review game and New game.** (human: dim the board; the card content is a default). This supersedes the 2026-10-19 "cream card with no scrim" default.
- **The review sidebar is three cards: key moment, then summary (graph plus accuracy line), then Moves (with the left-book line).** (human: key moment above the graph and fewer cards; the merge is a default)

## Known risks
- **The scroll cause may be more than one thing,** such as focus after a click and a remount after a move. Mitigation: measure `scrollY` before and after a move in each mode, at both widths.
- **Removing the out-of-book note hides that Stockfish is playing.** The human accepted this. Mitigation: the home page's engine line still says so.
- **Resign racing his move:** pressing Resign while he's thinking must not let his late move land after the game ends. Mitigation: a test, like the stale-answer test for New game.
- **The dim scrim may block the board's last-move and check marks.** Mitigation: they stay visible under a 40 % scrim; check it in the Look check.

## Open questions
- **The phone layout of the game-over card's two buttons.** Value in use: in a row when they fit, stacked otherwise.

## Verification
- `npm run build && npm test` pass.
- **No scroll jump:** in `npm run preview`, `window.scrollY` is the same before and after a move: scroll down, then play a move, in vs Liem and Two players, at 1400 px and 375 px.
- **Fixed clocks:** a running clock's `getBoundingClientRect().width` stays the same across 20 ticks.
- **Cards:** your card shows ♔ or ♚ and no image. His card has no "Plays Liem's openings" text and no `[data-engine="stockfish"]`. Out of book, there's no book card and no "Out of his book" text.
- **Resign:** the button's width is the same before and after the first press, at 1400 and 375 px. In vs Liem, Resign then Confirm ends the game as a loss, with Review game; one press alone turns back after 3 s. In Two players, the side to move loses. His late move never lands after a resign.
- **Game over:** at mate, time and resign, the board is dimmed and the card shows the result, the reason and its buttons; New game and Review game work from it.
- **Review:** the sidebar has exactly three cards in the order key moment, summary, Moves; the accuracy line and the left-book line show; the phone sheet follows the same order.
- **Feature rows:** every `pod-docs/features.md` browser row passes, updated where this plan changed it on purpose.
- **Heavier text:** body text computes to `font-weight: 600`, and Quicksand 600 loads from `/chess-web/assets/`.
- **Look:** home, both board modes, game over and the review match the Look at 1400, 992 and 375 px, with no horizontal scroll.
