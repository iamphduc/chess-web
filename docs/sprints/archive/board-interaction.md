# Sprint: Board interaction

_From plan: docs/plans/board-feel.md · Slug: board-interaction · Status: archived · Generated: 2026-10-06_

<!-- autopilot-run: started=2026-10-06T11:36:12Z sprints=0 waves=2 -->

## Status board

| Wave | Slice | Title | Branch | PR | Status | Confidence | Depends on |
|------|-------|-------|--------|----|--------|------------|------------|
| 1 | L1 | Look: `--board-*` tokens, focus ring and icon-button style | board-interaction-L1 | https://github.com/iamphduc/chess-web/pull/52 | done | high | — |
| 1 | R1 | Rules: click-to-move reducer, flip state and orientation math | board-interaction-R1 | https://github.com/iamphduc/chess-web/pull/52 | done | medium | — |
| 1 | T1 | Touch-drag check: HTML5 backend and `react-dnd-multi-backend` at 375 px | board-interaction-T1 | https://github.com/iamphduc/chess-web/pull/52 | done | medium | — |
| 2 | H1 | Highlights (Look A), click and drag wiring, tap-to-move | board-interaction-H1 | https://github.com/iamphduc/chess-web/pull/53 | done | high | L1, R1 |
| 2 | F1 | Flip board UI, player swap, promotion picker, reduced motion | board-interaction-F1 | https://github.com/iamphduc/chess-web/pull/53 | done | medium | L1, R1 |

Why this split: wave 1 is three independent pieces (theme, pure logic, a throwaway touch check) that run side by side. Wave 2 has two UI slices that both need the tokens and the rules. They split on file lines: H1 owns the square and the piece, and F1 owns the board layout and the buttons. Sound and touch drag are the next sprint (`sound-and-touch-drag`), which plans touch drag from T1's finding.

## Shared contract

**Board coordinates stay White's view everywhere.** Redux, the engine, `possibleMoves`, `lastMoves`, `selectedPiece`, `promotionPosition`, and every `[y, x]` that a component dispatches are board coordinates (`y = 0` is rank 8, `x = 0` is the a-file). Flipping changes only where squares render and which squares carry labels. A `Square` always receives and dispatches its board `y, x`, so clicks and drops land on the right square whether or not the board is flipped.

**Flip state** (R1, `src/features/board/viewSlice.ts`, registered in `src/app/store.ts` as `view`):
- `state.view.flipped: boolean`, starts `false`. The action `toggleFlip()` inverts it, so two toggles return to `false`.
- The board `reset` action doesn't change it. It isn't saved, so a reload brings back `false`.

**Orientation helpers** (R1, `src/features/board/orientation.ts`, pure):
- `toDisplay([y, x], flipped) → [row, col]`: the identity when not flipped, and `[7 - y, 7 - x]` when flipped. It's its own inverse, so the same function maps display back to board.
- `displayOrder(flipped) → [y, x][]`: 64 board coordinates in render order (display row 0 to 7, column 0 to 7 within each row).
- `squareLabels(y, x, flipped) → { rank: string | null; file: string | null }`: the rank label sits on display column 0 and the file label on display row 7. Rank text is `8 - y` and file text is `a` to `h` for `x`. Unflipped, a8 has rank `"8"`, h1 has file `"h"`, and a1 has both. Flipped, h8 has rank `"8"` and file `"h"`, h1 (display top-left) has rank `"1"` only, a1 (display top-right) has neither, and e4 has neither.
- `promotionPlacement(y, x, flipped, squareSize) → { left, right, top, bottom }`: today's `Promotion.tsx` formula applied to the display `[row, col]` instead of `[y, x]`. `left = col <= 3 ? size*col - size/2 : "unset"`, `right = col > 3 ? size*(7-col) - size/2 : "unset"`, `top = row === 0 ? size : "unset"`, and `bottom = row === 7 ? size : "unset"`.

**Click-to-move rules** (R1, `src/features/board/BoardSlice.ts`). There are two new actions. `movePiece`, `promotePawn`, `stop` and `reset` keep their behavior, and `selectPiece` stays for the existing tests. The UI stops calling `selectPiece` after H1.
- `clickSquare({ y, x })` checks these rules in order:
  1. If `gameOver !== Continue` or `pendingPromotion` is set, nothing changes. The state stays deep-equal.
  2. If a piece is selected and `[y, x]` is in `possibleMoves`, the move is played exactly as `movePiece({ to: [y, x] })` plays it, promotion step included.
  3. If the square holds a piece of the side to move (the current engine `turn`): clicking the selected square deselects it. Any other piece of the side to move becomes the selection in one click, with `possibleMoves` taken from the engine. A piece with no legal moves is still selected, with `possibleMoves = []`.
  4. Anything else (an empty square, an opponent piece that isn't a legal capture, an off-turn piece) clears `selectedPiece` and `possibleMoves`. If nothing was selected, nothing changes.
- Repeated clicks on the same own piece alternate: select, deselect, select.
- `pickUp({ y, x })` runs at drag start:
  - Game over or a pending promotion: nothing changes.
  - A piece of the side to move becomes the selection. It never toggles: picking up the piece that's already selected keeps it selected.
  - Anything else clears the selection, so dropping cannot move some other piece that was selected before.
- A drag that ends without a legal drop leaves the selection as it is.

**Look tokens** (L1 owns them in `src/index.css` `:root`; each value is the plan's `## Look` palette):
- `--board-highlight`: last-move and selected-square tint.
- `--board-hint`: legal-move dot and capture ring.
- `--board-check`: the radial gradient on the checked king's square.
- `--board-drop-edge`: the inset edge on a legal drag-over square.
- `--board-light` and `--board-dark`: the Wheat squares.
- `--board-sound-on`: used next sprint.
- `--board-focus`: the focus ring.

Board, square, overlay and piece CSS use only these tokens for color.

**Button classes** (L1 styles them in `Button.css`, and F1 and the next sprint use them): `button button--icon` is a square icon-only button with the `.button` look. Every `.button` shows a `3px` `--board-focus` outline at a `2px` offset on `:focus-visible`.

**Square markup** (H1): each `.square` element has `data-square="<file><rank>"` (for example `data-square="e2"`), so smoke runs can click squares by selector.

## Per-slice detail

### L1: Look: `--board-*` tokens, focus ring and icon-button style
- **Scope:**
  - Add the contract's `--board-*` tokens to `src/index.css` `:root`, each declared once, with the plan's `## Look` values.
  - In `Button.css`, add the `:focus-visible` ring and the `.button--icon` style. An icon button is square, keeps the dark surface, the `6px` radius and the `0.8` brightness hover, and sizes its inline SVG icon to the text size.
  - Don't change `--clock-*`, the Quicksand `@import`, or the Play and Reset colors.
  - Fonts stay on the Google Fonts `@import`. Self-hosting is out, because the plan keeps the fonts unchanged and the `ticking-clock` sprint cut it for the same reason. `tests/theme.test.ts` already pins the import.
  - No other slice edits `src/index.css` or `Button.css`.
- **Files owned:**
  - `src/index.css`
  - `src/features/board/components/Button.css`
  - `tests/board-theme.test.ts` (new)
- **Success criteria:**
  - `[test]` Each of the 8 `--board-*` tokens is declared once in `:root` with its Look value (the check gradient compared as an exact string) — `tests/board-theme.test.ts` › `board tokens have the Look values`
  - `[test]` White button text on `--dark-surface` over the `#333333` page meets 4.5:1 — `tests/board-theme.test.ts` › `button text meets 4.5:1`
  - `[test]` The `--board-focus` ring against the page, and a white icon on `--board-sound-on`, each meet 3:1 — `tests/board-theme.test.ts` › `focus ring and sound-on icon meet 3:1`
  - `[test]` `Button.css` has a `.button:focus-visible` rule using `var(--board-focus)` with a `3px` width and a `2px` offset, and a `.button--icon` rule — `tests/board-theme.test.ts` › `buttons have the focus ring and icon style`
  - `[manual]` Tab to Play and Reset at desktop and at 375 px. A white ring shows, and both buttons look the same as before otherwise.
- **Depends on:** —
- **One-way door:** none

### R1: Rules: click-to-move reducer, flip state and orientation math
- **Scope:**
  - Build the contract's **Click-to-move rules** (`clickSquare`, `pickUp`), **Flip state** (`viewSlice.ts` plus its `store.ts` registration) and **Orientation helpers** (`orientation.ts`), as pure, node-tested code.
  - No component changes. Keep the existing `console.log` calls.
  - Don't change `selectPiece` or `movePiece` behavior, because the existing tests pin them.
- **Files owned:**
  - `src/features/board/BoardSlice.ts`
  - `src/features/board/viewSlice.ts` (new)
  - `src/features/board/orientation.ts` (new)
  - `src/app/store.ts`
  - `src/features/board/__tests__/click-to-move.test.ts` (new)
  - `src/features/board/__tests__/orientation.test.ts` (new)
  - `src/features/board/__tests__/view-slice.test.ts` (new)
- **Success criteria:**
  - `[test]` Clicking an own piece selects it and fills `possibleMoves` (b1 → a3, c3) — `click-to-move.test.ts` › `click own piece selects it`
  - `[test]` Clicking the selected piece again deselects it, and a third click selects it again — `click-to-move.test.ts` › `repeat click toggles selection`
  - `[test]` With a piece selected, clicking an empty non-legal square, or an opponent piece that isn't a legal capture, clears the selection — `click-to-move.test.ts` › `click elsewhere deselects`
  - `[test]` With a piece selected, clicking another own piece selects that piece in one click — `click-to-move.test.ts` › `click another own piece reselects`
  - `[test]` Clicking a legal empty square or a legal capture plays the move: notation, `history` and turn match `movePiece` — `click-to-move.test.ts` › `click legal square moves`
  - `[test]` Clicking a promotion square sets `pendingPromotion`, and further clicks change nothing until the piece is picked — `click-to-move.test.ts` › `click into promotion waits for the picker`
  - `[test]` Clicking an off-turn piece with nothing selected leaves the state deep-equal — `click-to-move.test.ts` › `off-turn piece is ignored`
  - `[test]` Clicking an own piece with no legal moves selects it with `possibleMoves = []` — `click-to-move.test.ts` › `piece with no moves still selects`
  - `[test]` After checkmate or a flag fall, `clickSquare` and `pickUp` leave the state deep-equal — `click-to-move.test.ts` › `no clicks after game over`
  - `[test]` `pickUp` selects an own piece, keeps an already selected piece selected (no toggle), and clears the selection for an off-turn piece — `click-to-move.test.ts` › `pickUp never toggles`
  - `[test]` `toggleFlip` inverts `flipped` and two toggles return to `false`. The board `reset` leaves `view.flipped` unchanged, and the store's initial `view.flipped` is `false` — `view-slice.test.ts` › `flip toggles and survives reset`
  - `[test]` `toDisplay` maps a8 to `[0,0]` unflipped and to `[7,7]` flipped, and applying it twice returns the input for all 64 squares — `orientation.test.ts` › `toDisplay maps and inverts`
  - `[test]` `displayOrder` lists 64 distinct squares and starts with a8 unflipped and h1 flipped — `orientation.test.ts` › `displayOrder covers the board`
  - `[test]` `squareLabels` returns the contract's examples (a1, a8, h1, h8, e4, both orientations; flipped h1 has rank "1" only and flipped a1 has neither), and exactly 8 rank and 8 file labels in each orientation — `orientation.test.ts` › `labels sit on left and bottom edges`
  - `[test]` `promotionPlacement` for e8 with size 60 gives `right: 150` and `top: 60` unflipped, and `left: 150` and `bottom: 60` flipped. e1 gives the mirror of both — `orientation.test.ts` › `promotion picker follows the flip`
- **Depends on:** —
- **One-way door:** none

### T1: Touch-drag check: HTML5 backend and `react-dnd-multi-backend` at 375 px
- **Scope:**
  - Answer the plan's open touch question so the next sprint can plan touch drag. Run the check in Chrome with 375 px touch emulation (chrome-devtools-axi) on the current board.
  - Check whether a touch drag with today's `HTML5Backend` moves a piece, and whether taps still reach `onClick` and are not swallowed by the drag source.
  - Run `npm view` on `react-dnd-multi-backend` and `rdndmb-html5-to-touch` (latest versions, `peerDependencies`) and compare them with react-dnd 16 and React 18.
  - In this worktree only, install the preset, swap the `DndProvider` backend in `src/index.tsx`, and try a touch drag at 375 px. Note what had to change:
    - the drag preview (`DragPreviewImage` doesn't show under the touch backend),
    - any `touch-action`, kept narrow, never `none` on the page,
    - page scroll while dragging,
    - whether mouse drag still works on desktop.
  - Then **revert** `package.json`, `package-lock.json` and `src/index.tsx`. Only the research note is committed.
  - Verdict: **fits** (the files and changes the next sprint needs, with no board rewrite) or **doesn't fit** (why, so the next sprint logs a `PENDING`). Report the verdict as a NOTE in the engineer summary, so the orchestrator copies it into this doc's Sprint summary.
- **Files owned:** `docs/research/touch-drag.md` (new)
- **Success criteria:**
  - `[manual]` `docs/research/touch-drag.md` records the HTML5-backend touch result, both packages' versions and peer ranges, the multi-backend trial result, the verdict, and the steps to repeat it.
  - `[manual]` `git diff` against the wave base shows only `docs/research/touch-drag.md`, with no dependency added.
- **Depends on:** —
- **One-way door:** none

### H1: Highlights (Look A), click and drag wiring, tap-to-move
- **Scope:**
  - Restyle the square marks to Look A, as the plan's Scope "Highlights restyled" describes.
    - The selected square gets the same tint as the last move. The two don't stack into a darker tint.
    - The dot is 33% of the square, and the ring's border is 9% of the square. The drop edge is 6%.
    - The check glow sits on the king's square, and the piece `drop-shadow` is removed.
    - An illegal drag-over shows nothing.
  - Use only the `--board-*` tokens (the Wheat squares too) and follow the Look.
  - Put the mark choice in a pure `squareMarks(input) → { highlight: boolean; hint: "dot" | "ring" | null; check: boolean; dropEdge: boolean }`. `input` is `{ isLastMove, isSelected, isPossibleMove, hasPiece, isCheckedKing, isOver, canDrop }`. `Square` only renders what it returns.
  - Wire input:
    - A click anywhere on a `Square` dispatches `clickSquare` with its board `y, x`.
    - The piece's `onMouseDown` select is removed, and overlays have no click handlers of their own.
    - A drag starts only for a piece of the side to move, and drag start dispatches `pickUp`, so the dots show while dragging.
    - A drop still dispatches `movePiece`.
  - `Square` reads its own `isSelected` and `view.flipped` from the store, renders labels from `squareLabels`, and adds `data-square`. Its props from `Board` stay the same.
  - Tap-to-move must work at 375 px touch emulation. Don't add `touch-action: none`.
  - Update `docs/known-issues/browser-smoke-drag.md`: moves can now be played by clicking `[data-square=…]` twice.
- **Files owned:**
  - `src/features/board/components/Square.tsx`
  - `src/features/board/components/Square.css`
  - `src/features/board/components/Overlay.tsx`
  - `src/features/board/components/Overlay.css`
  - `src/features/board/components/Piece.tsx`
  - `src/features/board/components/Piece.css`
  - `src/features/board/squareMarks.ts` (new)
  - `src/features/board/__tests__/square-marks.test.ts` (new)
  - `src/features/board/__tests__/square.test.tsx` (new)
  - `tests/board-css.test.ts` (new)
  - `docs/known-issues/browser-smoke-drag.md`
- **Success criteria:**
  - `[test]` A last-move square, a selected square, or a square that is both gives `highlight: true` (one tint) — `square-marks.test.ts` › `one yellow tint for last move and selection`
  - `[test]` A legal empty square gives `dot`, a legal occupied square gives `ring`, and a non-legal square gives `null` — `square-marks.test.ts` › `dot on empty, ring on capture`
  - `[test]` `isOver && canDrop` gives `dropEdge: true`, and `isOver && !canDrop` gives no `dropEdge` and no other new mark — `square-marks.test.ts` › `drop edge only on legal drag-over`
  - `[test]` `check` is true only for the checked king's square — `square-marks.test.ts` › `check glow on king square`
  - `[test]` The rendered `Square` for e2 has `data-square="e2"`. Unflipped, a1 shows `1` and `a`. With `view.flipped` set, h8 shows `8` and `h`, h1 shows only `1`, and a1 shows no label — `square.test.tsx` › `labels and data-square follow the flip`
  - `[test]` `Square.css`, `Overlay.css` and `Piece.css` contain no color literals (hex, `rgb(`, `rgba(`) and no `drop-shadow`, and they use `var(--board-highlight)`, `var(--board-hint)`, `var(--board-check)` and `var(--board-drop-edge)` — `tests/board-css.test.ts` › `board styles use only board tokens`
  - `[manual]` Desktop and 375 px:
    - After a move, both squares are tinted yellow.
    - Clicking a piece tints its square and shows grey dots and rings.
    - Clicking an empty square deselects, and clicking another own piece reselects in one click.
    - A check shows the red glow on the king's square, with no glow around the piece.
    - Dragging shows dots, and a legal square shows the white inner edge while an illegal one shows nothing.
    - Compare against `docs/design-drafts/board-feel-look.html` (direction A).
  - `[manual]` At 375 px touch emulation, a full game is played by tapping only: castling, en passant, promotion (tap the picker) and checkmate. There are no console errors.
- **Depends on:** L1, R1
- **One-way door:** none

### F1: Flip board UI, player swap, promotion picker, reduced motion
- **Scope:**
  - Add a Flip icon button (`ButtonType.Flip`, inline SVG, `aria-label="Flip board"`, `aria-pressed` = `flipped`, classes `button button--icon`) to the sidebar button row next to Play and Reset. Clicking it dispatches `toggleFlip`.
  - The row wraps on phones.
  - `Board` renders squares in `displayOrder(flipped)`, keeping each square's React key as its board index.
  - The player cards swap: the white card is on top when flipped. Each card is keyed by color, so a running clock stays with its player across a flip.
  - `Promotion` takes its position from `promotionPlacement`.
  - The flip itself doesn't slide pieces across the board; pieces jump to their flipped squares. Normal moves still animate. Do this in `Board.tsx`. If it can't be done without editing `Piece.tsx` (owned by H1), report a NOTE.
  - Wrap the board in framer-motion `MotionConfig reducedMotion="user"`, so piece moves jump under `prefers-reduced-motion: reduce`.
  - Use only the tokens and follow the Look.
  - Update `docs/codebase-structure.md`:
    - Add Layout lines for `orientation.ts`, `viewSlice.ts` and `squareMarks.ts`.
    - In the smoke recipe, add the steps for playing by clicking `[data-square=…]`, flipping and moving on the flipped board, and tapping a game at 375 px.
- **Files owned:**
  - `src/features/board/Board.tsx`
  - `src/features/board/Board.css`
  - `src/features/board/components/Button.tsx`
  - `src/features/board/components/Promotion.tsx`
  - `src/features/board/__tests__/board-flip.test.tsx` (new)
  - `docs/codebase-structure.md`
- **Success criteria:**
  - `[test]` The unflipped `Board` markup lists the a8 rook's piece first and the black player's name before the white one. After `toggleFlip`, the h1 rook's piece comes first and the white name comes first — `board-flip.test.tsx` › `flip reverses squares and player cards`
  - `[test]` The button row holds a `button--icon` with `aria-label="Flip board"`, whose `aria-pressed` is `false`, then `true` after `toggleFlip` — `board-flip.test.tsx` › `flip button reflects state`
  - `[test]` With a pending promotion on e8 and the board flipped, the picker's inline style has `left` and `bottom` set and `right` and `top` unset — `board-flip.test.tsx` › `promotion picker placed for flipped board`
  - `[manual]` Desktop and 375 px:
    - Flip turns the board, and the labels stay on the left and bottom edges.
    - The cards swap, and the button row wraps on the phone.
    - The pieces jump without sliding on flip.
    - A move by click and a move by drag on the flipped board land on the right squares.
    - Promotion (picker beside the pawn) and checkmate (GameOver overlay) work while flipped.
    - After Play, flipping mid-game keeps each clock's time with its own player.
  - `[manual]` With reduced motion emulated in DevTools, piece moves jump without sliding, and highlights still show.
- **Depends on:** L1, R1
- **One-way door:** none

## Sprint summary

- **Synced with merge-target:** up to date (first sprint of the plan; `main` has no new commits since `board-feel` was cut)
- **Slices shipped:** L1, R1, T1, H1, F1
- **Queue entries:** resolved 1 (R1's flipped-label contract error, fixed in this doc before wave 2), deferred 1: [promotion picker overhangs the edge file](../../handoff-queue.md) (`2026-10-06 · PENDING · orchestrator → human`, Someday)
- **Slice log:**
  - L1: high · test-first yes · runtime focus ring and icon button at desktop and 375 px · 3 NOTEs · time lost none
  - R1: medium · test-first yes · runtime restructured `movePiece` by drag (new actions had no UI yet) · 3 NOTEs + 1 PENDING (solved) · time lost none
  - T1: medium · test-first n/a (research slice) · runtime HTML5 vs `rdndmb-html5-to-touch` under CDP touch at 375 px · 4 NOTEs · time lost none. **Verdict: touch drag fits** — the next sprint needs `react-dnd-multi-backend` + `rdndmb-html5-to-touch` 9.0.0, the `DndProvider options={HTML5toTouch}` swap in `src/index.tsx`, a touch drag preview (`Preview` from `react-dnd-multi-backend`), and select-on-drag-start (`pickUp`, now shipped). Details and the CDP touch script: `docs/research/touch-drag.md`.
  - H1: high · test-first yes · runtime click, drag (page-JS `DataTransfer` and real mouse), full game by taps at 375 px · 5 NOTEs · time lost none
  - F1: medium · test-first yes · runtime flip, moves/promotion/mate flipped, clocks mid-game, 375 px, reduced motion · 5 NOTEs · time lost none
  - Wave fix: none (the picker overhang is the older formula, deferred as PENDING)
  - Stalls: none. Machine: the wave 2 check's dev server was stopped once by Claude Code's low-memory guard and restarted at the human's go-ahead.
- **Agent context at hand-back:** 513,784 tokens across the five engineers (L1 76,840 · R1 95,082 · T1 98,689 · H1 116,962 · F1 126,211) — each agent's final context size, not tokens billed
