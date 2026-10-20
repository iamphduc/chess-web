# Sprint: polish

_From plan: pod-docs/plans/ui-polish.md · Slug: polish · Status: active · Generated: 2026-10-20_
<!-- autopilot-run: started=2026-10-20T06:21:43Z sprints=0 waves=3 -->

## Status board

| Wave | Slice | Title | Branch | PR | Status | Confidence | Depends on |
|------|-------|-------|--------|----|--------|------------|------------|
| 1 | L1 | Look: body text 600, Quicksand 600 file, game-over scrim token | polish-L1 | #88 | merged | medium | — |
| 1 | S1 | Scroll jump: a move never scrolls the page | polish-S1 | #88 | merged | medium | — |
| 1 | E1 | Game end: resign action and how the game ended | polish-E1 | #88 | merged | medium | — |
| 2 | R1 | Resign button with a 3 s Confirm in the Moves card foot | polish-R1 | #89 | merged | medium | L1, E1 |
| 2 | G1 | Game-over card over a dimmed board | polish-G1 | #89 | merged | medium | L1, E1 |
| 3 | P1 | Calmer player cards: color discs, fixed clocks, no out-of-book note | polish-P1 | — | in-progress | — | L1 |
| 3 | V1 | Review sidebar: key moment, summary, Moves | polish-V1 | — | in-progress | — | L1 |

P1 sits in wave 3 only because it shares `board-modes.test.tsx` with R1. V1 sits in wave 3 because it shares `Board.tsx` with R1.

## Shared contract

**Type** (L1, `src/index.css`; plan `## Look`):
- Body text is Quicksand **600**: `body { font-weight: 600 }`. Headings, buttons, names, clocks and other bold text stay **700**. No CSS file under `src/` sets `font-weight` to 500, 400 or `normal`, or uses 500 in a `font` shorthand. Text that was 500 now inherits or says 600.
- `@font-face` rules exist for Quicksand 600 and 700 only. Both are self-hosted woff2 files in `src/assets/fonts/`, with `font-display: swap`. The 500 file and its rule are gone.
- The new token `--game-over-scrim: rgba(30, 27, 22, 0.4)` is the `--ink` value at 40 %. No other new colors.

**Game end** (E1; `src/features/board/BoardSlice.ts` and `src/features/board/gameEnd.ts` (new)):
- `canResign(board): boolean` is true when `board.isPlaying && board.gameOver === GameOverType.Continue`. So vs Liem can resign from the moment the game starts. Two players can resign only after **Play**. A game with no clocks running can't be resigned.
- `resign()` is a board action with no payload. It does nothing unless `canResign`. Otherwise:
  - **The loser** is `humanColor` when it isn't `null` (vs Liem, even on his turn). In Two players it's the side whose clock runs (`isWhiteClockTurn(history.length, pendingPromotion !== null)`), which is the mover while the promotion picker is open.
  - The game ends as a win for the other side, with reason `"resigned"`. `isPlaying` turns false, so both clocks stop and show the time they had left. The selection and move hints clear. No sound plays.
  - An open promotion picker stays open. The pick still completes the pawn, and the result doesn't change (as after a flag fall).
- `gameEnd(board): GameEnd | null`, where `GameEnd = { winner: PieceColor | null; reason: EndReason }`. `winner: null` means a draw. `EndReason = "checkmate" | "stalemate" | "time" | "resigned"`. The value is `null` while the game continues.
- **Once a game ends, its result never changes.** A later `stop()`, `resign()`, `promotePawn` or `playOpponentMove` leaves `winner` and `reason` as they were. `reset` and `newGame` set the value back to `null`.
- His late answer: once a game has ended (a resign included), `playOpponentMove` for that game is ignored and `liemTurn` returns `null`.
- `canOpenReview` is unchanged. It holds after a resign once you've made a move and no promotion pick is left.

**Game-over card** (G1; text from `gameOverView`):
- It shows only while `gameEnd` isn't `null` **and** no promotion pick is pending. Until the pick is made, the picker can still be clicked.
- `.game-over` is a scrim filling `.squares`, with background `var(--game-over-scrim)`. It takes no clicks, so the final position, the last-move tint and the check glow show through it. Inside it sits `.game-over__card` (clickable), holding:
  - `.game-over__title`: "White wins", "Black wins" or "Draw". These words are used in both modes.
  - `.game-over__reason`: "Checkmate", "Stalemate", "On time" or "Resigned".
  - `.game-over__actions`: **Review game** (`a.button.button--play[href="#/review"]`, only when `canOpenReview`, so only in vs Liem), then **New game** (`button.button`). New game runs `replayLiemGame()` in vs Liem and `reset()` in Two players.

**Moves card foot** (R1, `Board.tsx`). The labels below are the visible text or the `aria-label`:

| State | Foot |
|---|---|
| vs Liem, in progress | New game, Resign, Flip board, Sound |
| vs Liem, over | Review game (when `canOpenReview`), New game, Flip board, Sound |
| Two players, clocks not started, not over | Play, New game, Flip board, Sound |
| Two players, clocks running | New game, Resign, Flip board, Sound |
| Two players, over | New game, Flip board, Sound |

- In Two players, **Play** now hides once the clocks run or the game is over.
- **Resign** is `button.button.resign-button` with a fixed width (104 px, no wrap). The first press turns it into **Confirm** (`data-confirm="true"`, `aria-label="Confirm resign"`, red ink `--accent` text and border, same width) for 3000 ms:
  - A second press at under 3000 ms dispatches `resign()`, once.
  - At 3000 ms it turns back to Resign, and a press then counts as a first press again.
  - A new game (a new `gameId`) or the end of the game while confirming turns it back too. Flip and Sound don't.
- From 992 px up, every foot state fits on one row. At 375 px the foot may wrap, but pressing Resign never moves anything in it.

**Player cards** (P1):
- When `avatar` is `null` and there's no `glyph`, `Player` shows a disc in place of the image: `span.player__disc[aria-hidden="true"]` with ♔ for White or ♚ for Black. His ♞ disc uses the same class, plus `.liem-sparring-avatar`. Every disc is 40 × 40 px, with a `--surface-2` fill and an ink glyph.
- Your card is "You" with your color's disc. In Two players, the cards are "White" and "Black" (`src/game/players.ts`), each with its own disc, and with no photo and no GM tag.
- His card shows the level name with the ♞ disc. At the Liem step it shows his photo, the GM tag and "Le Quang Liem". Under the name there's only:
  - "★ Book · N" (`[data-book-games]`, just "★ Book" below 768 px) while he's in his book;
  - "Thinking…" while he loads or thinks;
  - otherwise nothing.
- The card never shows "Plays Liem's openings", "Liem's openings", "GM · 2732" or `[data-engine]`. Every `.board > .player` stays 56 px tall.
- The book note (`[data-book-state]`) shows `waiting`, `in-book` and `failed` (with Try again) as before. Out of book it isn't rendered at all: there's no `out` state in the DOM and no "Out of his book" text. A new game brings back `waiting`.
- `.player__time` has a fixed width and tabular figures, so 10:00, 09:59, 0:59 and the tenths all keep one box width.

**Review sidebar** (V1):
- From 768 px up, `.review .sidebar` holds exactly three cards, in this order:
  1. The key-moment card (`[data-moment-status]`, its content unchanged).
  2. The summary card: `section.card[data-review-graph]` with the 80 px graph and then the accuracy line `.review-summary__accuracy`. The line has `.review-accuracy` ("40 %", or "—" until ready), then `[data-count="inaccuracy"]` "?! N", `[data-count="mistake"]` "? N" and `[data-count="blunder"]` "?? N", each in its grade color. There's no book-move count.
  3. The Moves card. Its list starts with one line, `[data-left-book]`:
     - "Left his book at move N · he played X in G games" (his most-played move there);
     - "Left his book at move N" when he has no games there;
     - "Stayed in his book the whole game" (`data-left-book="stayed"`);
     - no line at all without his books.
- `AccuracyPanel` and the separate "Left his book" card are gone.
- Below 768 px the sheet holds the key-moment card and then the summary. `graphPlacement` still decides where the summary goes, so `[data-review-graph]` appears exactly once.

**Docs owners** (one per wave, written from this contract):
- Wave 1: L1 owns `pod-docs/decisions.md` and `pod-docs/codebase-structure.md`.
- Wave 2: R1 owns both, and writes G1's parts too.
- Wave 3: P1 owns `decisions.md` and writes V1's entry too. V1 owns `codebase-structure.md` and writes P1's parts too.

## Per-slice detail

### L1: Look: body text 600, Quicksand 600 file, game-over scrim token
- **Scope:** Apply the contract's **Type** rules and add `--game-over-scrim`. Add `quicksand-latin-600-normal.woff2`, taken from the `@fontsource/quicksand` npm package (the source of the 500 and 700 files). Use `npm pack` into the scratchpad, and add no dependency. Delete the 500 file and its `@font-face`. Change every `font-weight: 500` under `src/` to inherit the body's 600 or to say 600. Don't change sizes, colors or layout.
  - **Docs:** add a `decisions.md` entry "Body text is Quicksand 600 (chosen by the human, plan ui-polish ## Look)". In `codebase-structure.md`, change the font line ("Quicksand 600 and 700") and add `--game-over-scrim` to the token list.
- **Files owned:**
  - CSS: `src/index.css`, `src/styles/liem.css`, `src/styles/review.css`, `src/features/home/Home.css`, `src/features/liem/components/BookNote.css`, `src/features/review/components/MoveList.css`
  - Fonts: `src/assets/fonts/quicksand-latin-600-normal.woff2` (new), `src/assets/fonts/quicksand-latin-500-normal.woff2` (deleted)
  - Tests: `tests/theme.test.ts`, `tests/look.test.ts`, `tests/review-theme.test.ts`
  - Docs: `pod-docs/decisions.md`, `pod-docs/codebase-structure.md`
- **Success criteria:**
  - `[test]` Quicksand 600 and 700 faces exist, and no 500 face. Each is a relative woff2 file under `src/assets/fonts/` that exists, with `swap`. — `tests/theme.test.ts` › quicksand is served from the app
  - `[test]` `body` is weight 600. No CSS under `src/` sets 500, 400 or `normal` (shorthand included). Headings and buttons stay 700. — `tests/theme.test.ts` › body text is 600 and bold stays 700
  - `[test]` `--game-over-scrim` is `rgba(30, 27, 22, 0.4)`, and every other Look token keeps its value. — `tests/look.test.ts` › tokens have the Look values
  - `[test]` `--accent` on `--surface` (Confirm) and `--soft` on `--surface` (the game-over reason) reach 4.5:1. — `tests/look.test.ts` › text pairs meet 4.5:1
  - `[test]` The review card and moves read 600. — `tests/review-theme.test.ts` › type sizes follow the Look
  - `[manual]` In `npm run preview`, home, both board modes and the review read heavier, with the headings unchanged, at 1400 px and 375 px. The Network tab shows `quicksand-latin-600-normal-*.woff2` loading from `/chess-web/assets/`, and no 500 file.
- **Depends on:** —
- **One-way door:** none
- **Model:** opus

### S1: Scroll jump: a move never scrolls the page
- **Scope:** Find what scrolls the page on a move, fix it, and name the cause or causes in the engineer summary and a code comment. The first suspect is `Notation.tsx`'s `scrollIntoView`: from 1200 px it scrolls every scrollable ancestor, the page included. Also check for a focus move or a remount after his reply, after a Two players move, and in the review (stepping, a tried move).
  - **The rule:** after a move, only the move list's own box scrolls, so that its last row shows. That happens through a small pure helper, `listScrollTop`. The page's scroll position never changes.
  - **Out of scope:** layout and look changes.
- **Files owned:** `src/features/board/components/Notation.tsx`, `src/features/board/listScroll.ts` (new), `src/features/board/Board.tsx`, `src/features/review/components/MoveList.tsx`, `src/features/board/__tests__/notation-scroll.test.tsx` (new). Use the fake-DOM pattern from `new-game-clock.test.tsx`.
- **Success criteria:**
  - `[test]` `listScrollTop`: when the last row is below the view, it aligns the row to the box bottom. When the row is already in view, it leaves the box unchanged. An empty list gives 0. — `notation-scroll.test.tsx` › listScrollTop keeps the last row in view
  - `[test]` A mounted `Notation` with a spy on `scrollIntoView`, `window.scrollTo` and `window.scrollBy`: after a move, only the box's `scrollTop` changes, and no spy is called. — `notation-scroll.test.tsx` › a move scrolls only the move list
  - `[test]` His reply in the same tick as your move, and then New game (an empty list), call no page scroll either. — `notation-scroll.test.tsx` › his reply and a new game don't scroll the page
  - `[manual]` In `npm run preview`, scroll the page down, then play a move. `window.scrollY` is the same before and after, in vs Liem (including his reply), Two players and the review (a step and a tried move), at 1400 px and 375 px.
- **Depends on:** —
- **One-way door:** none
- **Model:** opus

### E1: Game end: resign action and how the game ended
- **Scope:** Add the contract's **Game end** API: `resign()`, `canResign` and `gameEnd`, with `EndReason` exported from `gameEnd.ts`. The current endings (mate, stalemate, flag fall) start reporting their reason. Keep `GameOverType`, and keep what `GameOver.tsx`, `liemTurn` and `canOpenReview` read working. Add no UI.
- **Files owned:** `src/features/board/BoardSlice.ts`, `src/features/board/gameEnd.ts` (new), `src/features/board/__tests__/resign.test.ts` (new), `src/features/board/__tests__/game-end.test.ts` (new)
- **Success criteria:**
  - `[test]` `gameEnd` reads checkmate (winner: the mating side), stalemate (a draw), time (the other side) and `null` mid-game. — `game-end.test.ts` › each ending has its winner and reason
  - `[test]` vs Liem as White on your turn: `resign()` makes Black the winner with `"resigned"`, `isPlaying` false and no hints. — `resign.test.ts` › you resign vs Liem
  - `[test]` vs Liem on his turn: you still lose. His answer for that game and ply is then ignored, and `liemTurn` is `null`. — `resign.test.ts` › his late move never lands after a resign
  - `[test]` Two players after 1.e4 with the clocks running: Black resigns, so White wins. — `resign.test.ts` › the side to move resigns in Two players
  - `[test]` With White's promotion picker open: White loses. The pick then completes, and the result stays resigned. — `resign.test.ts` › resign with the picker open
  - `[test]` No-ops: before Play (clocks stopped), after mate or a flag fall, and a second `resign()`. A `stop()` after a resign keeps `"resigned"`. — `resign.test.ts` › resign only once, only in a running game
  - `[test]` `reset` and `newGame` clear `gameEnd`, and `canResign` is true again in the new vs-Liem game. — `resign.test.ts` › a new game clears the result
  - `[test]` `canOpenReview` holds after a resign once you've made a move, and not before your first move. — `resign.test.ts` › review after a resign
- **Depends on:** —
- **One-way door:** none
- **Model:** opus

### R1: Resign button with a 3 s Confirm in the Moves card foot
- **Scope:** Build the contract's **Moves card foot** and the Resign button. The press logic is a pure `resignConfirm.ts` (time passed in) behind a thin `ResignButton`, which owns the timer. Make each foot fit one row from 992 px up. This fixes the queue's 2026-10-19 "Fix next (Look)" item, where the foot wrapped at 1400 px after a game.
  - Use only the Look tokens and the `.button` styles, and follow the plan's Look and the draft (section 2).
  - **Docs:** add `decisions.md` entries for "Resign" (foot, 3 s red Confirm, both modes, Two players only once the clocks run, Play hides then) and "The game-over card dims the board". The second one supersedes "The game-over notice is a cream card with no scrim" (2026-10-19) and covers the words, the reasons and the wait for a pick. Update the smoke recipe for the foot, Resign and the game-over card (`codebase-structure.md`).
- **Files owned:**
  - Code: `src/features/board/Board.tsx`, `src/features/board/resignConfirm.ts` (new), `src/features/board/components/ResignButton.tsx` (new), `src/features/board/components/ResignButton.css` (new), `src/features/board/components/BoardSidebar.css`
  - Tests: `src/features/board/__tests__/resign-confirm.test.ts` (new), `src/features/board/__tests__/resign-button.test.tsx` (new), `src/features/board/__tests__/board-modes.test.tsx`, `tests/resign-css.test.ts` (new)
  - Docs: `pod-docs/decisions.md`, `pod-docs/codebase-structure.md`
- **Success criteria:**
  - `[test]` A first press at t confirms. A second press at t+2999 resigns. — `resign-confirm.test.ts` › a second press within 3 s resigns
  - `[test]` At t+3000 it reads Resign, and a press then confirms again rather than resigning. — `resign-confirm.test.ts` › after 3 s it turns back
  - `[test]` A new `gameId` while confirming gives Resign. — `resign-confirm.test.ts` › a new game resets the confirm
  - `[test]` Three quick presses resign once. — `resign-confirm.test.ts` › repeats resign once
  - `[test]` Mounted on a fake DOM: one press shows "Confirm" (`data-confirm`, `aria-label`), and 3.1 s later it shows "Resign". Two presses end the game as `"resigned"`. — `resign-button.test.tsx` › turns back after 3 s and resigns on the second press
  - `[test]` `.resign-button` has `width: 104px` and `white-space: nowrap`. The confirm rule sets only `color` and `border-color`, to `var(--accent)`. Tokens only. — `tests/resign-css.test.ts` › resign keeps one width
  - `[test]` The vs-Liem foot in progress and over matches the contract table. After a resign, Review game shows. — `board-modes.test.tsx` › moves card foot
  - `[test]` The Two players foot before Play, while running, and over matches the table. — `board-modes.test.tsx` › two players foot
  - `[test]` Existing controls still work: New game replays the level and drops the stale answer, Flip and Sound toggle. — `board-modes.test.tsx` › new game replays the level (kept green), `sound-button.test.tsx` (kept green)
  - `[manual]` In `npm run preview` at 1400 px and 992 px, every foot state is one row. At 1400 px and 375 px the Resign width (`getBoundingClientRect().width`) is the same before and after the first press, Confirm is red ink, and nothing in the foot moves.
- **Depends on:** L1, E1
- **One-way door:** none
- **Model:** opus

### G1: Game-over card over a dimmed board
- **Scope:** Rebuild `GameOver` from the contract's **Game-over card**: the scrim, the title, the reason and the actions. The text and the visibility rule come from a pure `gameOverView(board, match)`. New game from the card is a pure `gameOverNewGame(mode)` that returns the action to dispatch.
  - Phone: the buttons sit in a row when they fit, and stack otherwise (the plan's value in use).
  - Use only the Look tokens and the `.button` styles, and follow the plan's Look and the draft (section 3).
- **Files owned:**
  - Code: `src/features/board/components/GameOver.tsx`, `src/features/board/components/GameOver.css`, `src/features/board/gameOverView.ts` (new)
  - Tests: `src/features/board/__tests__/game-over-view.test.ts` (new), `src/features/board/__tests__/game-over-card.test.tsx` (new), `src/features/board/__tests__/game-end-stop.test.tsx`, `src/features/board/__tests__/promotion-clock.test.tsx`, `tests/board-css.test.ts`
- **Success criteria:**
  - `[test]` The title and reason for mate ("Black wins" · "Checkmate"), stalemate ("Draw" · "Stalemate"), a flag fall ("On time") and a resign ("Resigned"). `null` mid-game. — `game-over-view.test.ts` › result and reason for each ending
  - `[test]` A flag fall or resign with the picker open gives `null`. After the pick the card shows, with the result unchanged. — `game-over-view.test.ts` › waits for a promotion pick
  - `[test]` Review game shows only in a finished vs-Liem game with a move of yours, never in Two players. — `game-over-view.test.ts` › review game only after a vs-Liem game
  - `[test]` The markup is scrim, then card, then title, reason and actions, in order. Nothing renders mid-game. — `game-over-card.test.tsx` › card markup
  - `[test]` `gameOverNewGame("liem")` replays the level and color (new `gameId`, clocks running). `"two-player"` resets (clocks stopped). — `game-over-card.test.tsx` › new game from the card
  - `[test]` The existing endings tests read the new words. — `game-end-stop.test.tsx` (all), `promotion-clock.test.tsx` › a flag fall with the picker open is the mover's loss, before and after the pick
  - `[test]` CSS:
    - `.game-over` has `background-color: var(--game-over-scrim)` and `pointer-events: none`.
    - `.game-over__card` has `pointer-events: auto`, `--surface`, a `--line` border and a 24 px pad.
    - The title is `--text-title` in ink. The reason is `--text-body` in `--soft`.
    - The actions are a wrapping row with an 8 px gap.
    - Tokens only.
    - — `tests/board-css.test.ts` › game-over card dims the board
  - `[manual]` In `npm run preview`, at mate (1.f3 e5 2.g4 Qh4#), on time and after a resign, at 1400 px and 375 px: the board is dimmed, the last-move tint and the check glow still show, and the card reads its result and reason. Review game and New game work from it.
- **Depends on:** L1, E1
- **One-way door:** none
- **Model:** opus

### P1: Calmer player cards: color discs, fixed clocks, no out-of-book note
- **Scope:** Build the contract's **Player cards** rules: the color disc, the Two players names, his card text, no out-of-book note and the fixed-width clock.
  - Remove what becomes unused: the `engine` badge and its CSS, the `outText`/`detail*` fields if nothing reads them, the narrow-card hide rules, and `chess-player.png` if nothing imports it.
  - Use only the Look tokens, and follow the plan's Look and the draft (section 1).
  - **Docs** (`decisions.md`): add entries for the avatar disc, his card text (superseding the 2026-10-18 card text, the Stockfish pill and the card parts of "Phone lines after the refresh"), "No out-of-book note", "Two players cards read White and Black" (superseding the 2026-10-19 Two players entry; "Thinking…" stays as his status) and V1's "The review sidebar is three cards".
- **Files owned:**
  - Board code: `src/features/board/components/Player.tsx`, `src/features/board/components/Player.css`, `src/features/board/components/avatar.ts`, `src/game/players.ts`
  - Liem code: `src/features/liem/components/LiemCardDetail.tsx`, `src/features/liem/components/BookNote.tsx`, `src/features/liem/bookNote.ts`, `src/features/liem/levelView.ts`, `src/styles/liem.css`
  - Tests: `src/features/board/__tests__/board-modes.test.tsx`, `src/features/board/__tests__/player.test.tsx`, `src/features/board/__tests__/avatar.test.ts`, `src/features/liem/__tests__/book-note-render.test.tsx`, `src/features/liem/__tests__/book-note.test.ts`, `src/features/liem/__tests__/level-view.test.ts`, `tests/player-css.test.ts`, `tests/liem-theme.test.ts`
  - Docs: `pod-docs/decisions.md`
- **Success criteria:**
  - `[test]` A `Player` with no avatar or glyph shows `.player__disc` ♔ (white) or ♚ (black), `aria-hidden`, with no `<img>`. With an avatar it still shows the image. — `player.test.tsx` › color disc when no avatar
  - `[test]` Your card as White has ♔ and as Black has ♚, with no `<img>`, and it follows the flip. — `board-modes.test.tsx` › vs-Liem cards around the board
  - `[test]` Two players cards read "White" and "Black", each with its disc, with no photo or GM tag. — `board-modes.test.tsx` › two players cards
  - `[test]` His card:
    - A sparring card has the ♞ disc and the level name, with no "openings".
    - The Liem card has the photo, GM and "Le Quang Liem", with no "2732".
    - No card has `[data-engine]`.
    - — `board-modes.test.tsx` › sparring and Liem cards
  - `[test]` The detail shows the badge in book, "Thinking…" while loading or thinking, and nothing out of book, while waiting or after a failure. — `book-note-render.test.tsx` › his card detail by state
  - `[test]` `liemBadge` gives `null` out of book. — `book-note.test.ts` › badge follows the note
  - `[test]` The note renders nothing out of book. Waiting, in-book and failed stay, and Try again calls `onRetry`. — `book-note-render.test.tsx` › no note out of book
  - `[test]` A new game after leaving his book shows the waiting note again. — `book-note-render.test.tsx` › a new game brings the note back
  - `[test]` No sparring text or `aria-label` has a rating. — `level-view.test.ts` › no ratings on sparring levels (kept green)
  - `[test]` `.player__time` has a fixed `width`, `flex: none` and tabular digits. — `tests/player-css.test.ts` › clock keeps one width
  - `[test]` The disc is 40 px with `--surface-2` and `--ink`, and there's no `.liem-badge--engine`. — `tests/liem-theme.test.ts` › player cards and book note follow the Look
  - `[manual]` In `npm run preview` at 1400 px and 375 px:
    - Every card is 56 px tall, in book, thinking and out of book.
    - A running clock's `getBoundingClientRect().width` stays the same across 20 ticks, and from 10:00 to 09:59.
    - The discs match his ♞.
- **Depends on:** L1
- **One-way door:** none
- **Model:** opus

### V1: Review sidebar: key moment, summary, Moves
- **Scope:** Build the contract's **Review sidebar**: the wide order, the summary card with its accuracy line, the left-book line in the Moves list, and the sheet order. Remove `AccuracyPanel` and the card form of `LeftBookNote`. That also settles the queue's "Someday (Look)" 12-row left-book list.
  - Fold in the queue's "Someday (Look)" item: at 375 px "Review · vs Master" fits whole between ← Home and Play again.
  - Give `TopBar` an `action` prop, so the review uses it in place of the `ReviewTopBar` copy (queue "Someday" leftovers).
  - Use only the Look tokens, and follow the plan's Look and the draft (section 4).
  - **Docs** (`codebase-structure.md`): update the review layout and its smoke steps, plus P1's parts (cards, discs, his card, book note, the Two players names).
- **Files owned:**
  - Board code: `src/features/board/Board.tsx`, `src/features/board/Board.css`, `src/features/board/components/TopBar.tsx`, `src/features/board/components/TopBar.css`
  - Review components: `src/features/review/components/ReviewGraph.tsx`, `src/features/review/components/ReviewGraph.css`, `src/features/review/components/AccuracyPanel.tsx` (deleted), `src/features/review/components/LeftBookNote.tsx`, `src/features/review/components/MoveList.tsx`, `src/features/review/components/MoveList.css`
  - Styles: `src/styles/review.css`
  - Tests: `src/features/review/__tests__/board-review.test.tsx`, `src/features/review/__tests__/review-panels.test.tsx`, `tests/review-theme.test.ts`
  - Docs: `pod-docs/codebase-structure.md`
- **Success criteria:**
  - `[test]` The wide sidebar has exactly three `.card`s, in the order key moment, summary (`[data-review-graph]`) and Moves. There's no accuracy panel and no left-book card. — `board-review.test.tsx` › review sidebar order
  - `[test]` The accuracy line reads "40 % · ?! 1 · ? 0 · ?? 1", with grade classes, zeros shown and "—" until ready. — `review-panels.test.tsx` › accuracy line
  - `[test]` The left-book line covers left with his moves, left with none, stayed and no books, and it's the first item in the list. — `review-panels.test.tsx` › left his book line
  - `[test]` At 375 px the open sheet holds the key moment and then the summary. With the sheet closed or low, the summary is at the top of the sidebar. `[data-review-graph]` shows once. — `board-review.test.tsx` › phone sheet starts with the key moment
  - `[test]` The top bar comes from `TopBar` with Play again, and Play again still replays the level. The play screen's top bar is unchanged. — `board-review.test.tsx` › play again replays the level
  - `[test]` The review styles are tokens only, and red is never text. — `tests/review-theme.test.ts` › review follows the Look
  - `[manual]` In `npm run preview` at 1400, 992 and 375 px: the three cards look like the draft, "Review · vs Master" isn't cut at 375 px, and nothing scrolls sideways.
- **Depends on:** L1
- **One-way door:** none
- **Model:** opus
