# Sprint: feel

_From plan: pod-docs/plans/ui-feel.md · Slug: feel · Status: active · Generated: 2026-10-21_
<!-- autopilot-run: started=2026-10-21T11:30:00Z sprints=0 waves=1 -->

## Status board

| Wave | Slice | Title | Branch | PR | Status | Confidence | Depends on |
|------|-------|-------|--------|----|--------|------------|------------|
| 1 | M1 | Game-board moves 200 ms ease-in-out; the review keeps its step | feel-M1 | — | pending | — | — |
| 1 | R1 | Square avatars, player row option C, the Two players button | feel-R1 | — | pending | — | — |

Plan branch `ui-feel`; wave head `feel-w1`; merge target `ui-feel-staging`. Port base 3200 (M1 uses 3201, R1 uses 3202 for `PORT`).

**Notes for every slice**

- **Browser:** use `agent-browser`, each agent with its own session (`--session pod-feel-m1`, `--session pod-feel-r1`), always run through the Bash tool as a plain command. Never pipe or capture its output (`| head`, `| tail`, `| grep`, `> file`, `$(…)`): that hangs on this machine (`pod-docs/known-issues/agent-browser-batch-hang.md`). If it hangs anyway, close the session and use `npx -y chrome-devtools-axi`.
- **Tests:** Vitest in the node environment with no jsdom (`pod-docs/codebase-structure.md` → Tests). Run them with `npx vitest run --maxWorkers=2`. Verification is `npm run build && npm test`.
- **No L1 slice:** the plan adds no tokens, fonts or colors. Both slices use only the existing tokens in `src/index.css` and follow the plan's `## Look` and the draft `pod-docs/design-drafts/ui-feel.html` (player row C, button 48 px).
- `pod-docs/features.md` is the orchestrator's. Neither slice edits it.
- **Board size (plan risk 2):** `squareSizeFor` (`src/features/board/boardSize.ts`) reads only the two width queries, never the height, so the taller cards don't shrink the board. They make the board column 8 px taller. Nothing in `boardSize.ts` changes. R1 checks the square size in the browser.

## Shared contract

**Piece transitions** (`src/features/board/pieceMotion.ts`, owned by M1). The ambiguous `PIECE_MOVE_TRANSITION` name goes away, and two named transitions replace it:

- `GAME_MOVE_TRANSITION = { type: "tween", ease: [0.42, 0, 0.58, 1], duration: 0.2 }`. This is the CSS `ease-in-out` cubic Bézier (Framer's `"easeInOut"`), written as control points so tests can sample it. Every game-board piece move uses it (`Piece.tsx`): a click, a tap, his move, castling's rook, en passant.
  - **First frame:** at 1/60 s (t = 0.0833) the progress is under 0.05, well under 20 %.
  - **No overshoot:** the progress stays between 0 and 1 for every t in [0, 1], and it never goes down.
  - **Interruption:** when a new position arrives mid-move (his reply within 200 ms of your click), the piece ends on the store's square. The DOM always follows the store; the motion is visual only.
- `REVIEW_STEP_TRANSITION = { type: "tween", ease: "easeOut", duration: 0.15 }`. This is today's value, unchanged. The review's one-ply slide uses it (`transitionFor("slide")`).
- `SNAP_TRANSITION = { duration: 0 }`, `reviewStepMotion`, `nextReviewStep` and `sameReviewStep` don't change. `transitionFor("snap")` still returns `SNAP_TRANSITION`.
- **No motion, unchanged:** the Flip and a drag drop land at once (`useInstantLayoutTransition` in `Button.tsx` and `Square.tsx`). With `prefers-reduced-motion` every piece jumps (`MotionConfig reducedMotion="user"` around both boards in `Board.tsx`). No slice edits those three files.

**`ReviewBoard` props** (M1, from the queue's "Fix next" entry of 2026-10-20). `gameId: number` and `ply: number` become required: there are no defaults and no `?`. `Board.tsx` already passes both.

**Player row, option C** (`src/features/board/components/Player.css`, owned by R1). Every player card, in both modes and in the review:

- `.player`: `gap: var(--space-4)` (16 px, from the name side to the clock) and `padding: var(--space-2) 0` (8 px above and below).
- `.player__info`: `gap: var(--space-3)` (12 px, from the avatar to the name).
- `.player__disc` and `.player__avatar` (♔, ♚, his ♞ and Liem's photo): 40 × 40 px with `border-radius: var(--radius)` (4 px). No `50%` is left on either.
- `.board > .player`: `height: 60px`, which is 8 + 44 + 8. `.player__text` stays 44 px. The name line, the material line, the clock pill (112 px) and the "+N" and detail rules don't change.
- **Narrow edge:** at 375 and 320 px, "+N" and his detail are never cut (the glyphs cut first), and `document.documentElement.scrollWidth` equals the viewport width.

**Two players button** (`src/features/home/`, owned by R1). The link `a.home__alt` becomes `<a class="button home__two-players" href="#/two-players">Two players on one board</a>`, with no arrow. It keeps the secondary `.button` look (the outline), and it is an `<a>` because it goes to a screen. `.home__two-players` sets `width: 100%`, `min-height: 48px` and `margin-top: var(--space-3)`. `.home__alt` is gone from the CSS and the markup.

**Docs** (in M1, because `decisions.md` and `codebase-structure.md` can have only one owner in the wave). M1 writes all four decision entries from the values above. These are the plan's values, so M1 doesn't wait for R1.

## Per-slice detail

### M1: Game-board moves 200 ms ease-in-out; the review keeps its step

- **Scope:**
  - Split the transition into `GAME_MOVE_TRANSITION` and `REVIEW_STEP_TRANSITION`, as the Shared contract describes. `Piece.tsx` uses the game one, and `transitionFor` uses the review one. Remove `PIECE_MOVE_TRANSITION`: no file under `src/` or `tests/` may name it.
  - Keep the flip, drop and reduced-motion paths as they are. Pin them with a source-reading test, because no test covers them today.
  - Make `ReviewBoard`'s `gameId` and `ply` required, and pass them in `review-card.test.tsx`. Then mark the queue entry "`ReviewBoard`'s `gameId` and `ply` props are optional only because…" as resolved in your summary. The orchestrator writes the resolution.
  - Not in scope: the review's motion values, the game-over entrance, any setting for speed, or springs.
  - **Docs:**
    - `pod-docs/decisions.md`: add four entries dated 2026-10-21, plan ui-feel, chosen by the human. They are "Game-board pieces move in 200 ms with an ease-in-out", "Avatars are squares with the 4 px corner", "The player row has more room (option C)" and "Two players is a full-width button". In the 2026-10-20 "Pieces move in 150 ms with an ease-out" heading, add "(the game-board part is superseded by …, 2026-10-21)". In the 2026-10-20 "A color disc in place of a photo" entry, add a superseded note for "circle".
    - `pod-docs/codebase-structure.md`: update every line that says 150 ms or `PIECE_MOVE_TRANSITION` for the game board, the 56 px card, the round disc, and "Two players on one board →" or "the Two players link". The Smoke recipe's "What you see" and "Runtime to smoke" lines change to the button text with no arrow, `a.button[href="#/two-players"]`, a game move of about 200 ms ease-in-out, and a review step that still takes about 150 ms.
    - `pod-docs/feature-details/reduced-motion.md` and `post-game-review.md`: the new names, and `gameId`/`ply` required.
- **Files owned:**
  - `src/features/board/pieceMotion.ts`
  - `src/features/board/components/Piece.tsx`
  - `src/features/review/components/ReviewBoard.tsx`
  - `src/features/board/__tests__/piece-motion.test.tsx`
  - `src/features/review/__tests__/review-board-motion.test.tsx`
  - `src/features/review/__tests__/review-card.test.tsx`
  - `tests/motion-wiring.test.ts` (new)
  - `pod-docs/decisions.md`
  - `pod-docs/codebase-structure.md`
  - `pod-docs/feature-details/reduced-motion.md`
  - `pod-docs/feature-details/post-game-review.md`
- **Success criteria:**
  - `[test]` `GAME_MOVE_TRANSITION` equals `{ type: "tween", ease: [0.42, 0, 0.58, 1], duration: 0.2 }` — `src/features/board/__tests__/piece-motion.test.tsx` › `game-board moves use a 200 ms ease-in-out tween`
  - `[test]` The game curve, sampled with a cubic-Bézier helper in the test, is under 0.05 at t = 1/60 ÷ 0.2, rises steadily, and stays within [0, 1] at 101 evenly spaced t values. It reaches 0.5 at t = 0.5 (± 0.01) — `piece-motion.test.tsx` › `the game curve starts gently and never overshoots`
  - `[test]` `Piece` passes `GAME_MOVE_TRANSITION` (a mocked `motion.div` records it), and `layoutId` is still `${gameId}-${pieceType}` — `piece-motion.test.tsx` › `the game board's pieces use it`
  - `[test]` `REVIEW_STEP_TRANSITION` equals `{ type: "tween", ease: "easeOut", duration: 0.15 }` and is not the game transition — `piece-motion.test.tsx` › `the review step keeps 150 ms ease-out`
  - `[test]` `ReviewBoard` pieces get `REVIEW_STEP_TRANSITION` on a one-ply step forward and back, `{ duration: 0 }` on a jump, on open and on a flip, and a re-render of the same step keeps `REVIEW_STEP_TRANSITION` — `src/features/review/__tests__/review-board-motion.test.tsx` › `a snap uses no transition time` and `a re-render keeps the step's motion`
  - `[test]` No file under `src/` or `tests/`, except this test, contains `PIECE_MOVE_TRANSITION` — `tests/motion-wiring.test.ts` › `the old shared name is gone`
  - `[test]` `Square.tsx`'s drop and `Button.tsx`'s flip still call `useInstantLayoutTransition`'s start function. `Board.tsx` has two `MotionConfig reducedMotion="user"` wrappers, one per board — `tests/motion-wiring.test.ts` › `flip, drop and reduced motion stay instant`
  - `[test]` `review-card.test.tsx` renders `ReviewBoard` with `gameId` and `ply` and still sees 64 squares, 32 pieces and the flip order — `src/features/review/__tests__/review-card.test.tsx` › `review board`. `npm run build` fails the type check if either prop is left out. That check is the build itself, not a separate test.
  - `[manual]` Game move: on `#/two-players` at desktop and at 375 px, play e2–e4 by click. Sample the piece's `getBoundingClientRect().top` each `requestAnimationFrame` in one `eval`. The move lasts about 200 ms, the first frame covers well under 20 % of the way, and there's no overshoot.
  - `[manual]` Review step: in a review, ▶ still lasts about 150 ms ease-out; First and Last snap.
  - `[manual]` Edges: Flip shows no motion. A drag drop lands at once, with the castling rook too. With reduced motion emulated, a click move jumps. vs Medium as White: click a move and, while his reply lands within 200 ms, every piece ends inside its `[data-square]` box (300 ms later the box tops match).
- **Depends on:** —
- **One-way door:** none
- **Model:** opus

### R1: Square avatars, player row option C, the Two players button

- **Scope:**
  - **Player row:** apply the Shared contract's option C in `Player.css`: the gaps, the padding, the 60 px card, and the square avatars for the disc and the photo. Don't touch `Player.tsx`, the material rules or the clock box. Update the comments that say 56 px or circle. Update the tests that pin the old values: `tests/player-css.test.ts` pins 56 px and the 4 px pad, and `tests/liem-theme.test.ts` pins the disc's `50%`.
  - **Two players button:** in `Home.tsx` and `Home.css`, as the Shared contract describes. The level and color picks, Play and the strip don't change. Don't change any other part of home.
  - Use only the tokens, and follow the Look and the draft.
  - **Docs:**
    - `pod-docs/feature-details/moves-card-and-material.md`: the 60 px card with 8 px pads, the square avatars and the 12/16 px gaps.
    - `pod-docs/feature-details/board-loads.md` and `stockfish-is-named.md`: 56 px becomes 60 px.
    - `pod-docs/feature-details/home-page.md`: the button.
- **Files owned:**
  - `src/features/board/components/Player.css`
  - `tests/player-css.test.ts`
  - `tests/liem-theme.test.ts`
  - `src/features/home/Home.tsx`
  - `src/features/home/Home.css`
  - `src/features/home/__tests__/home.test.tsx`
  - `tests/home-css.test.ts`
  - `pod-docs/feature-details/moves-card-and-material.md`
  - `pod-docs/feature-details/board-loads.md`
  - `pod-docs/feature-details/stockfish-is-named.md`
  - `pod-docs/feature-details/home-page.md`
- **Success criteria:**
  - `[test]` `.player` has `gap: var(--space-4)` and `padding: var(--space-2) 0`, and `.player__info` has `gap: var(--space-3)` — `tests/player-css.test.ts` › `the row follows option C`
  - `[test]` `.board > .player` is `height: 60px` with `border-box`, and 19.2 + 4 + 20 fits within 60 − 2 × 8 — `tests/player-css.test.ts` › `the second line sits 4 px under the name in a 60 px card` (renamed from the 56 px test)
  - `[test]` The existing material, clock and reduced-motion tests in `tests/player-css.test.ts` still pass unchanged. These are `the material line never cuts +N`, `clock keeps one width`, `clock styles use only the tokens` and `hand jumps crisply and stays still with reduced motion`.
  - `[test]` `.player__disc` and `.player__avatar` each have `border-radius: var(--radius)`, and no `50%` is left in `Player.css` — `tests/player-css.test.ts` › `avatars are 4 px squares`
  - `[test]` The disc is still 40 px on `--surface-2` with ink, its border-radius is `var(--radius)`, and the ♞ adds no look of its own — `tests/liem-theme.test.ts` › the existing test holding `Every disc (♔, ♚ and his ♞) is 40 px` (keep its name)
  - `[test]` Home renders `<a class="button home__two-players" href="#/two-players">Two players on one board</a>`, right after Play, with no `home__alt` and no "→" — `src/features/home/__tests__/home.test.tsx` › `home content`
  - `[test]` The existing home behavior still holds: the picks are remembered across a re-render, Play starts the game and goes to `#/play`, and the level picker and the color tiles work — `home.test.tsx` › `picks are remembered`, `play starts the game, then goes to play`, `level picker`, `color tiles read White, Black and Random` (unchanged)
  - `[test]` `.home__two-players` has `width: 100%`, `min-height: 48px` and `margin-top: var(--space-3)`. `Home.css` has no `.home__alt` rule. Home still follows the Look with no width over 343 px — `tests/home-css.test.ts` › `two players is a full-width 48 px button`
  - `[manual]` Player row at 1400, 992 and 375 px on `#/two-players`, vs Medium and in a review: the avatar to name gap is 12 px, the name side to clock gap 16 px, each card is 60 px tall with 8 px pads, and every disc and Liem's photo (vs ★ Liem) has 4 px corners. `.squares` width is still 8 × `squareSizeFor` (624, 416 and 312 px).
  - `[manual]` At 375 and 320 px: capture several pieces so the glyph line is long, vs Medium while "★ Book" or "Thinking…" shows. "+N" and his detail are never cut, and `document.documentElement.scrollWidth === innerWidth`.
  - `[manual]` Home at desktop and 375 px: Two players is an outlined full-width button, 48 px tall (`getBoundingClientRect().height`), 12 px under Play, and the same width as Play. Clicking it goes to `#/two-players`. Nothing scrolls sideways.
- **Depends on:** —
- **One-way door:** none
- **Model:** opus
