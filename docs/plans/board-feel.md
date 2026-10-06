# Plan: Better board feel

_Generated: 2026-10-06 · Status: active · Grilled-with: grilling (fast)_

## Goal
Make the board feel like chess.com: restyled move highlights, click-to-move that behaves as players expect, a flip-board button, move sounds with a mute toggle, play that works on a phone, and less motion when the OS asks for it. The board stays custom; only its feel changes.

## Why
The board already has legal-move dots, capture rings, a last-move overlay, a check glow and basic click-to-move, but they look dated (flat 50% yellow, green/red drag overlays, a glow around the king piece). Click-to-move can't deselect by clicking elsewhere. There are no sounds and no way to flip the board, and the react-dnd HTML5 backend is built for a mouse. This is the "Better board feel" item on `docs/roadmap.md`. It comes before online play, which will need the flip and a phone-ready board. Research: `docs/research/board-feel.md`.

**Success criteria for the whole plan:**
- The highlights match Look direction A on both light and dark squares.
- Click-to-move and drag both work and agree with each other.
- The flip button turns the board, the coordinates, and the player cards and clocks.
- Every kind of move plays its own sound, and the mute setting survives a reload.
- A full game can be played by tapping on a phone-size touch screen.
- With reduced motion on, pieces jump instead of sliding.
- `npm run build && npm test` passes, and the smoke playthrough in `docs/codebase-structure.md` still passes.

**Constraints:**
- Keep the Wheat board colors, the piece SVGs, Quicksand, and the dark page.
- No board library (chessground, react-chessboard).
- The only allowed new runtime dependency is `react-dnd-multi-backend` (or its `rdndmb-html5-to-touch` preset), and only for touch drag.

## Scope
**In scope:**
- **Highlights restyled (Look A).**
  - Last move: both squares get a yellow tint.
  - Selected piece: its square gets the same yellow tint.
  - Legal moves: a soft grey dot on empty squares and a grey ring on capture squares.
  - Check: a red radial glow on the king's square. This replaces the `drop-shadow` filter on the piece.
  - Drag-over a legal square: a white inner edge. This replaces the green and red overlays; an illegal drag-over shows nothing.
  - All colors become `--board-*` tokens in `src/index.css` `:root`.
- **Click-to-move polish.**
  - Clicking the selected piece again, an empty square, or an illegal square deselects.
  - Clicking another of your own pieces selects it in one click.
  - Starting a drag selects the piece, so the dots show while dragging.
- **Flip board.**
  - A Flip button turns the board 180°.
  - Rank and file labels follow the board, so they always sit on the left and bottom edges.
  - The player cards and clocks swap places with the board.
  - Drop targets, click targets, the promotion picker and the GameOver overlay all work when the board is flipped.
- **Move sounds.**
  - One sound per move, picked by priority: game end > check > promotion > castle > capture > move.
  - The sounds come from a CC0 pack, with the source and licence recorded in the repo.
  - Audio is preloaded and plays through Web Audio. The `AudioContext` is resumed on the first user gesture.
  - A Sound toggle button sits next to Flip. Its on or off state is saved in `localStorage`, and every read and write is wrapped in try/catch.
- **Touch.**
  - Tap-to-move works on touch screens (tap a piece, tap a dot).
  - Touch drag is added through the multi-backend switcher, as long as it doesn't need a board rewrite. If it does, it's dropped and logged as `PENDING`.
- **Reduced motion.** With `prefers-reduced-motion: reduce`, piece moves don't animate. Use framer-motion's `MotionConfig reducedMotion="user"` or similar. Highlights and sounds stay.
- **Docs.**
  - Update `docs/features.md` with how to prove each new feature.
  - Update the smoke recipe in `docs/codebase-structure.md` with the flip, sound and tap steps.
  - Update `docs/roadmap.md`: move Vite migration and Better board feel to a Done section.

**Out of scope:**
- Keyboard play, screen-reader move input and announcements.
- Premove (later, with online play).
- Board color themes, piece sets, and a sound-set or volume picker.
- Auto-flip each turn.
- Changing the board size or layout.
- The `{ kind, color }` piece identity redesign (`docs/decisions.md`).

## Sprint sequence

| Sprint | Goal | Status | Depends on |
|--------|------|--------|------------|
| board-interaction | Look A highlights, click-to-move polish, flip board, reduced motion, and tap-to-move on touch, plus a phone touch-drag check that decides the next sprint's touch work | planned | — |
| sound-and-touch-drag | Move sounds with the mute toggle, and touch drag through the multi-backend if the first sprint's check says it fits | planned | board-interaction |

Status values: `planned` / `active` / `done`. The orchestrator only flips its row's Status — it does not rewrite Goal/Depends-on retroactively.

The `Depends on` column is the **only** cross-sprint dependency signal. Wave ordering and per-slice deps live inside the sprint doc and are opaque from here.

## Look
The human's pick: **"I will pick A"** (chess.com classic).

- **Thesis:** chess.com-style highlights on the existing Wheat board. One warm yellow tint means "this moved" or "this is in your hand", and soft grey marks show where a piece can go.
- **Palette** (each color is a `--board-*` token in `src/index.css`):
  - Last move and selected square: `rgba(255, 255, 51, 0.5)`, the same tint for both.
  - Legal dot and capture ring: `rgba(0, 0, 0, 0.14)`. The dot is 33% of the square, centered. The ring is a circle as big as the square, with a border 9% of the square.
  - Check: a radial gradient on the king's square, `radial-gradient(circle, #ff0000 0%, rgba(231, 0, 0, 0.9) 25%, rgba(169, 0, 0, 0) 89%)`.
  - Drag-over a legal square: an inset white edge, `rgba(255, 255, 255, 0.65)`, 6% of the square.
  - Sound-on button: `#059862`, the app's Play green.
  - Focus ring: `#FFFFFF`, 3 px with a 2 px offset.
  - Unchanged: board light `rgb(234, 240, 206)`, board dark `rgb(187, 190, 100)`, page `#333333`.
- **Type:** Quicksand 700 for the coordinates, Quicksand 500 at 16 px for text. Both fonts are unchanged.
- **Layout:** Flip and Sound are icon buttons. They share the existing `.button` style: dark surface, 6 px radius, 0.8 brightness on hover. They sit in the sidebar button row next to Play and Reset, and wrap on phones.
- **Signature detail:** a single yellow signal. The move just played and the piece in your hand use the same tint, so there's only one color to learn.
- **Rules out:**
  - Green and red drag overlays.
  - The glow around the king piece.
  - Bouncy or springy piece motion.
  - Colored dots.
  - New board colors.
- **Draft:** `docs/design-drafts/board-feel-look.html` (direction A picked).

## Key decisions
- **Keep the custom board, with no chessground or react-chessboard.** Most of the features already exist, and a switch means a rewrite. Chessground is GPL-3.0, and the repo has no licence yet (research: `docs/research/board-feel.md` → What exists, Gaps).
- **Sounds come from a CC0 pack, not lichess's sounds.** The lichess sets are AGPL or CC BY-NC-SA, the standard set's terms weren't found, and that set has no check sound (research → Gaps).
- **Resume the `AudioContext` on the first gesture, and add a mute toggle** (research → Best practices: Chrome autoplay policy).
- **Dots on empty squares and rings on capture squares** (research → Best practices: chessground). The colors follow Look A.
- **Flip is a manual button only.** Auto-flip annoys players sitting side by side, and online play will set each player's side.
- **Touch: tap-to-move first, then touch drag only if the multi-backend fits.** Research couldn't confirm how react-dnd's HTML5 backend behaves on touch screens, so sprint 1 tests it on a phone-size touch screen first.
- **Accept the chess.com dot contrast.** The `rgba(0,0,0,0.14)` dots are below the WCAG 1.4.11 3:1 ratio. We keep them to match chess.com; the Look draft shows they're visible on Wheat. (default)
- **One sound per move, with the priority game end > check > promotion > castle > capture > move.** (default)
- **The flip state lasts until the page reloads.** Reset doesn't undo it, and it isn't saved. (default)
- **Sound is on by default.** (default)
- **Each move animates normally when the board flips, but the flip itself doesn't animate pieces across the board.** Pieces jump straight to their flipped squares. (default)
- **The board's `console.log` calls for select and deselect stay.** Cleaning them up isn't part of this plan. (default)

## Known risks
- **Flipping a board that already holds a lot of y/x logic.** Mitigation: flip only at render time. The engine, Redux squares and moves keep White's view, and the UI maps display positions to board positions. Add tests for that mapping.
- **framer-motion `layoutId` can animate every piece across the board when it flips.** Mitigation: turn off layout animation for the flip render, and check it in the browser smoke.
- **`react-dnd-multi-backend` may not fit react-dnd 16 or React 18.** Mitigation: sprint 1's phone check and a version check decide. If it doesn't fit, ship tap-to-move only and log a `PENDING` entry.
- **Audio tests need a browser.** The Vitest setup is node-only. Mitigation: keep sound picking (move to sound) as a pure function with unit tests, and check playback in the browser smoke.
- **Browser smoke drags are awkward** (`docs/known-issues/browser-smoke-drag.md`). Mitigation: click-to-move gives the smoke a reliable way to play moves.

## Open questions
- Which CC0 pack to use. The engineer picks a small one with move, capture, check, castle, promote and game-end sounds, and records the source. If there's no check sound, use a distinct short tone for check.

## Verification
- `npm run build && npm test` passes. New unit tests cover the flip coordinate mapping, the click-to-move select and deselect rules, and the move-to-sound priority.
- **Browser, desktop:**
  - After a move, both last-move squares show the yellow tint.
  - Clicking a piece tints its square and shows grey dots and rings.
  - Clicking an empty square deselects, and clicking another own piece reselects in one click.
  - In check, the king's square shows the red glow.
  - The tokens match Look A.
- **Flip:**
  - The board, the coordinates and the player cards turn.
  - A move made by click and by drag on the flipped board lands on the right square.
  - Promotion and checkmate work when flipped.
- **Sound:**
  - A move, a capture, castling, a check, a promotion and a checkmate each play the right sound.
  - With mute on, there's no sound, and mute is still on after a reload.
  - There are no console errors, including before the first click.
- **Phone** (375 px touch emulation): a full game, including castling, en passant, promotion and checkmate, can be played by tapping. Touch drag works if it shipped; if not, a `PENDING` entry says why.
- **Reduced motion emulated:** pieces jump without sliding.
- `docs/features.md`, the smoke recipe in `docs/codebase-structure.md`, and `docs/roadmap.md` are updated.
