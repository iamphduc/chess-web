# Sprint: motion

_From plan: pod-docs/plans/ui-motion.md · Slug: motion · Status: active · Generated: 2026-10-20_
<!-- autopilot-run: started=2026-10-20T18:20:00Z sprints=0 waves=1 -->

## Status board

| Wave | Slice | Title | Branch | PR | Status | Confidence | Depends on |
|------|-------|-------|--------|----|--------|------------|------------|
| 1 | M1 | Material line under the name, pieces then "+N" | motion-M1 | — | pending | — | — |
| 1 | G1 | Game-over entrance: pause, scrim fade, card rise | motion-G1 | — | pending | — | — |
| 1 | P1 | 150 ms pieces, one-step review playback, Play again in the review foot | motion-P1 | — | pending | — | — |

No `L1`: the Look's tokens, fonts and base controls shipped in `ui-refresh` and `ui-polish`, and this plan adds no token, font or control style. The motion values live in two small modules, each owned by the one slice that uses it. Every slice uses only the existing tokens and follows the plan's `## Look`.

Browser checks use `npx -y chrome-devtools-axi`, one session per agent (`pod-docs/decisions.md` → "browser: chrome-devtools-axi"). `emulate --viewport` reloads the page, which goes home, so set 375 px before you play. Ports from the plan's base: M1 3201, G1 3202, P1 3203. Run the suite with `npx vitest run --maxWorkers=2` (`pod-docs/known-issues/timing-tests-under-load.md`); timing tests use vi fake timers or time passed in.

## Shared contract

**Material line** (M1, `src/features/board/components/Player.tsx`):
- On every player card, in both modes and in the review, `.player__material[data-material="N"]` sits on its own line under the name line, in the same column as the name, with 4 px (`--space-1`) between the two lines.
- Inside it, in DOM order: `.player__captured` (the glyphs) first, then `.player__advantage` ("+N", only when N > 0), for example `♛♜♝♞♞♟ +4`. When it shows, the glyph colors, and `materialLine` are unchanged: no element before any capture, an equal trade lists glyphs with no "+0".
- **His card with a detail** (agent default, flagged for the human): "★ Book · N" or "Thinking…" shares the second line. The material comes first, and the detail sits at the line's end. Neither one moves when the other appears or goes.
- **What gives way:** "+N" and the detail are never cut. The glyphs cut first (ellipsis). The name line cuts on its own.
- Every `.board > .player` stays 56 px tall, and nothing in it is clipped top or bottom. The name line doesn't move when the material line appears.

**Game-over entrance** (G1, `src/features/board/components/GameOver.tsx`):
- The card's markup and content are unchanged and present from the first render. Only its visibility animates. `.game-over` gets `data-entrance="animate"` or `data-entrance="instant"`.
- `animate`: a 300 ms pause, during which the scrim and the card are fully transparent. Then the scrim fades in over 200 ms, and the card fades in, rises 8 px and scales from 0.96 to 1 over 250 ms. Both use ease-out with no overshoot. The card is fully shown at about 550 ms and its transform ends at `none` or identity.
- `instant`: everything shows at once with no pause. This happens under `prefers-reduced-motion: reduce`, and on any later mount of the card for the same ended game, such as coming back from the review. `MotionConfig reducedMotion="user"` alone isn't enough, because it keeps opacity fades.
- **Once per game end:** a re-render or a resize never replays the entrance. React StrictMode's double render must still animate. The pause starts when the card becomes due, so after a pending promotion pick.
- **New game during the pause** (or any time) removes the card. Nothing shows later for the old game, and the next game end gets its own entrance.

**Piece motion** (P1, `src/features/board/pieceMotion.ts` (new)):
- `PIECE_MOVE_TRANSITION = { type: "tween", ease: "easeOut", duration: 0.15 }` is the transition for every piece move on the game board (click, tap, his move, castling's rook, en passant) and for a one-step move on the review board. The Flip stays instant. Reduced motion stays off through `MotionConfig reducedMotion="user"`.
- **Review step rule:** `reviewStepMotion(prev, next): "slide" | "snap"`, where each side is `{ gameId, ply, flipped, size }` and `prev` may be `null`. It returns `"slide"` only when `prev` isn't `null`, the `gameId`, `flipped` and `size` are equal, and `|next.ply - prev.ply| === 1`. That covers ◀, ▶, the arrow keys, and any other one-ply change, such as an adjacent move in the list. Every other case is `"snap"`: opening the review, a jump of 2 or more plies (a far move in the list, First, Last, a key moment), a flip, a resize to another square size, or another game. A snap uses `{ duration: 0 }`.
- Review pieces use `layoutId` `review-${gameId}-${pieceType}`, so they never share a box with the game board's `${gameId}-${pieceType}`. On ◀ a captured piece is back on its square. On a promotion step the pawn goes and the new piece appears on its square, because they have different ids.

**Review foot and top bar** (P1, `src/features/board/Board.tsx`):
- The review's Moves card foot is **Play again** (`button.button.button--play`, dispatching `playAgain()` from `src/features/review/reviewLayout.ts`), then Flip board and Sound. The review has no `a[href="#/play"]`.
- The review's top bar holds only ← Home and the title, with no `.top-bar__action`. `TopBar`'s `action` prop and `.top-bar__action` CSS stay, unused (`tests/review-theme.test.ts` still reads them).
- The browser's Back from the review still goes to `#/play` with the finished board. The routes don't change.

**Docs owners** (one owner per file, written from this contract):
- M1: `pod-docs/feature-details/moves-card-and-material.md`. This includes the Review foot row ("Play again, Flip, Sound").
- G1: `pod-docs/feature-details/game-over.md`.
- P1: `pod-docs/decisions.md` (all five plan entries, M1's and G1's included), `pod-docs/codebase-structure.md` (the Layout and Smoke recipe lines for all three slices) and `pod-docs/feature-details/post-game-review.md`.
- `pod-docs/features.md` is the orchestrator's.

## Per-slice detail

### M1: Material line under the name, pieces then "+N"
- **Scope:**
  - Build the contract's **Material line** in `Player` (markup) and `Player.css` (layout), on both cards, in both modes, with the Look's existing material style (soft ink "+N", the glyph row).
  - Fit the two lines in the 56 px card. You may change the card's padding inside the token scale. Don't shrink the glyphs below their current size unless nothing else fits; if you do, say so in your report.
  - Don't change `material.ts`, the glyph colors, the clock, the disc or the GM tag.
  - Update the existing tests that pin the old name markup (`board-modes.test.tsx`, `book-note-render.test.tsx`) to the new structure. Keep what they check: the name line is the title then the name, and his detail text.
  - Queue fold-in (2026-10-20, Player tick timer): add a fake-timer test that the first tick after New game lands when the digits change, so dropping `gameId` from the timer's deps fails it.
  - Update `moves-card-and-material.md`: the line's order and place, the his-card default, and the Review foot row.
- **Files owned:** `src/features/board/components/Player.tsx`, `src/features/board/components/Player.css`, `src/features/board/__tests__/player.test.tsx`, `tests/player-css.test.ts`, `src/features/board/__tests__/board-modes.test.tsx`, `src/features/liem/__tests__/book-note-render.test.tsx`, `src/features/board/__tests__/new-game-clock.test.tsx`, `pod-docs/feature-details/moves-card-and-material.md`
- **Success criteria:**
  - `[test]` The glyphs come before "+N" inside `.player__material` (after Qxg4, White's card reads `♞` then `+3`). Test: `src/features/board/__tests__/player.test.tsx` › `the material line lists the pieces, then +N`.
  - `[test]` `.player__material` comes after the name line, in the block that holds the name, not beside the clock. Test: `player.test.tsx` › `the material line sits under the name`.
  - `[test]` With a `detail`, the second line holds the material first, then the detail. With no material, the detail shows alone. Test: `player.test.tsx` › `with a detail, the material comes first on the second line`.
  - `[test]` No material element at the start. An equal trade shows glyphs and no "+0". A new game clears the line. Test: `player.test.tsx` › `no material element at the start`, `an equal trade lists the captures with no +N` and `a new game clears the material line`.
  - `[test]` Existing card fields still render: the title-then-name line, the disc or photo, the clock, and his "★ Book · N" and "Thinking…" text. Test: `player.test.tsx` › `the name line is the title then the name, with nothing between`, plus `board-modes.test.tsx` and `book-note-render.test.tsx` as updated.
  - `[test]` "+N" and the detail never shrink or wrap, and the glyphs cut with an ellipsis. Test: `tests/player-css.test.ts` › `the material line never cuts +N`.
  - `[test]` The second line sits `var(--space-1)` under the name, and `.board > .player` stays 56 px. Test: `tests/player-css.test.ts` › `the second line sits 4 px under the name in a 56 px card`.
  - `[test]` The first tick after New game lands when the digits change. Test: `src/features/board/__tests__/new-game-clock.test.tsx` › `the first tick after New game lands when the digits change`.
  - `[manual]` Look at both cards, vs Liem (in book, Thinking…, out of book, Liem step with the GM tag) and Two players, after captures on both sides. Check at 1400 px and 375 px: the material sits under the name with the glyphs first, "+N" and the detail are never cut, nothing is clipped, every card is 56 px, the name line doesn't move at the first capture, and nothing scrolls sideways.
- **Depends on:** —
- **One-way door:** none
- **Model:** sonnet

### G1: Game-over entrance: pause, scrim fade, card rise
- **Scope:**
  - Build the contract's **Game-over entrance**. Put the values and the rule in a pure module, `src/features/board/gameOverEntrance.ts`. It exports the timings (`pauseMs` 300, `scrimMs` 200, `cardMs` 250, `risePx` 8, `scaleFrom` 0.96, ease-out) and a function that takes the reduced-motion flag, when this game's card was first shown, and now (time passed in, like `resignConfirm.ts`), and returns `"animate"` or `"instant"`.
  - `GameOver.tsx` wires it up and sets `data-entrance`. The motion itself may be CSS or framer-motion, in tokens only, with no bounce, spring or overshoot.
  - Don't change the card's text, buttons, `gameOverView` or the scrim color.
  - Queue fold-in (2026-10-20, Fix next): add a test that imports `gameEnd.ts` (then `liemTurn.ts` and `Piece.tsx`) first, in a fresh module registry, and still reads `GameOverType.Continue`.
  - Update `game-over.md`: drop the "Import cycle" Watch-out line (fixed by PR #96), and add the entrance.
- **Files owned:** `src/features/board/gameOverEntrance.ts` (new), `src/features/board/__tests__/game-over-entrance.test.ts` (new), `src/features/board/components/GameOver.tsx`, `src/features/board/components/GameOver.css`, `src/features/board/__tests__/game-over-card.test.tsx`, `tests/board-css.test.ts`, `src/features/board/__tests__/no-gameover-cycle.test.ts`, `pod-docs/feature-details/game-over.md`
- **Success criteria:**
  - `[test]` The timings are 300, 200 and 250 ms, 8 px, 0.96 and ease-out. Test: `src/features/board/__tests__/game-over-entrance.test.ts` › `entrance timings`.
  - `[test]` A fresh end returns `animate`. A second call for the same end within 550 ms (StrictMode) still returns `animate`. At 550 ms or later (a remount after the review) it returns `instant`. Test: `game-over-entrance.test.ts` › `plays once per game end`.
  - `[test]` Reduced motion returns `instant` at any time. Test: `game-over-entrance.test.ts` › `reduced motion shows it at once`.
  - `[test]` The card markup keeps its title, reason and buttons in order, with `data-entrance="animate"` at a fresh end, in both modes. Test: `src/features/board/__tests__/game-over-card.test.tsx` › `card markup`.
  - `[test]` With `matchMedia("(prefers-reduced-motion: reduce)")` stubbed to match, the card renders `data-entrance="instant"`. Test: `game-over-card.test.tsx` › `reduced motion renders the card at once`.
  - `[test]` New game 100 ms after the end leaves no card. The next game's end renders `animate` again. Test: `game-over-card.test.tsx` › `new game during the pause cancels the entrance`.
  - `[test]` New game from the card still works in both modes. Test: `game-over-card.test.tsx` › `new game from the card`.
  - `[test]` The entrance CSS uses ease-out (no `cubic-bezier` above 1, no spring), its delays and durations match the module, and a reduced-motion rule (or `instant`) has no animation. The old card rules still pass. Test: `tests/board-css.test.ts` › `game-over entrance follows the Look` and `game-over card dims the board`.
  - `[test]` Importing `gameEnd.ts` first doesn't crash. Test: `src/features/board/__tests__/no-gameover-cycle.test.ts` › `gameEnd.ts imports first without a crash`.
  - `[manual]` Check at 1400 px and 375 px, at mate (as White 1.f3, 2.g4), on time and on resign. The last move lands, then the scrim and the card ease in. Sample `getComputedStyle` every animation frame: opacity is 0 until about 300 ms, full at about 550 ms, and the transform ends at `none` or identity. Then check that a resize after the end doesn't replay it, that going to the review and back shows the card at once, and that with reduced motion forced (`--force-prefers-reduced-motion`, or CDP `Emulation.setEmulatedMedia`) it shows at once.
- **Depends on:** —
- **One-way door:** none
- **Model:** opus

### P1: 150 ms pieces, one-step review playback, Play again in the review foot
- **Scope:**
  - **Piece speed:** build the contract's **Piece motion** in `pieceMotion.ts` and `Piece.tsx`. Keep the game board's layout ids and the Flip's instant transition.
  - **Drag drop:** in the browser, check whether a drag drop slides a second time from the source square. If it does, make the drop land at once (for example `useInstantLayoutTransition` on the drop, as the Flip does), and say what happens to castling's rook on a drop.
  - **Review playback:** `ReviewBoard` draws its pieces as motion elements with the review layout ids and picks `PIECE_MOVE_TRANSITION` or the snap by `reviewStepMotion`. `Board.tsx` passes what it needs (for example the cursor and the `gameId`). `StepButtons` and the key handling don't change.
  - **Review foot:** build the contract's **Review foot and top bar** in `Board.tsx` (remove `BackToGameLink`) and fix the doc comment in `reviewLayout.ts`.
  - **Docs:** write the five `decisions.md` entries in the plan's Docs list, from this contract, including the his-card default as an "agent default — override anytime". Mark the 2026-10-19 "The review's top bar has Play again; Back to game stays in the review" entry as superseded, and the 2026-10-19 "+N" order and place. Update the `codebase-structure.md` Layout and Smoke recipe lines (material under the name, `data-entrance`, `pieceMotion.ts`, `gameOverEntrance.ts`, the review's foot and top bar) and `post-game-review.md`.
- **Files owned:** `src/features/board/pieceMotion.ts` (new), `src/features/board/__tests__/piece-motion.test.tsx` (new), `src/features/board/components/Piece.tsx`, `src/features/board/components/Square.tsx`, `src/features/board/__tests__/board-new-position.test.tsx`, `src/features/review/components/ReviewBoard.tsx`, `src/features/review/__tests__/review-board-motion.test.tsx` (new), `src/features/board/Board.tsx`, `src/features/review/reviewLayout.ts`, `src/features/review/__tests__/board-review.test.tsx`, `pod-docs/decisions.md`, `pod-docs/codebase-structure.md`, `pod-docs/feature-details/post-game-review.md`
- **Success criteria:**
  - `[test]` `PIECE_MOVE_TRANSITION` is a 0.15 s ease-out tween. Test: `src/features/board/__tests__/piece-motion.test.tsx` › `piece moves use a 150 ms ease-out tween`.
  - `[test]` `Piece` passes `PIECE_MOVE_TRANSITION` as its transition (a mocked `motion.div` records its props), with `layoutId` still `${gameId}-${pieceType}`. Test: `piece-motion.test.tsx` › `the game board's pieces use it`.
  - `[test]` New positions still appear in place, a move keeps a piece's layout id, and each game gets new ids. Test: `src/features/board/__tests__/board-new-position.test.tsx`, existing tests.
  - `[test]` `reviewStepMotion` slides for 3→4 and 4→3. Test: `src/features/review/__tests__/review-board-motion.test.tsx` › `one step slides, forward and back`.
  - `[test]` It snaps for `prev` `null`, 3→5, 5→0, 0→last, a `flipped` change, a `size` change and another `gameId`. Test: `review-board-motion.test.tsx` › `a jump snaps`.
  - `[test]` The review pieces carry `review-<gameId>-<piece>` ids. After ◀ from a capture, the captured piece is back on its square. Test: `review-board-motion.test.tsx` › `review pieces carry their own layout ids`.
  - `[test]` `ReviewBoard` gives its pieces `PIECE_MOVE_TRANSITION` on a slide and `{ duration: 0 }` on a snap. Test: `review-board-motion.test.tsx` › `a snap uses no transition time`.
  - `[test]` The review foot is Play again, Flip board and Sound, with no `href="#/play"` in the review. Test: `src/features/review/__tests__/board-review.test.tsx` › `moves card foot in the review`.
  - `[test]` The review's top bar has ← Home and the title only. The foot's Play again starts a new game at the same level and color and closes the review, and the play screen's foot is unchanged. Test: `board-review.test.tsx` › `play again replays the level`.
  - `[test]` The review layout's other parts are unchanged, and closing the review (Back) restores the game layout. Test: `board-review.test.tsx` › `renders the graph, review board, card, accuracy line, move list and left-book line` and `Back to game restores the game layout`.
  - `[manual]` Check at 1400 px and 375 px. A click move, his reply, castling and en passant take about 150 ms (sample the piece's transform every frame) with no overshoot, and a fast click right before his reply still ends on the last position. The Flip jumps. A drop lands without a second slide. With reduced motion forced, pieces jump.
  - `[manual]` In the review, check at 1400 px and 375 px. ▶, ◀ and the arrow keys slide the one move, and a capture's piece comes back on ◀. Clicking a far move, First, Last or a key moment shows the new position with no motion. The foot's Play again goes to `#/play` at the same level and color. The top bar reads ← Home and "Review · vs <level>" only, not cut at 375 px.
- **Depends on:** —
- **One-way door:** none
- **Model:** opus
