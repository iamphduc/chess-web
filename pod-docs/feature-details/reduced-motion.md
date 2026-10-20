# Reduced motion

## What it is
When the system asks for less motion (`prefers-reduced-motion: reduce`, the OS "reduce motion" setting), the app keeps every mark and every state change but drops the motion:
- pieces jump to their square, on the game board and in the review's playback;
- the game-over scrim and card show at once, with no pause (`data-entrance="instant"`);
- the clock icon's hand doesn't turn, and the review's progress bar doesn't ease.

The last-move tint, the check glow, the dots and the card's content are the same as with motion.

## How it works
- **Pieces:** both board screens in `src/features/board/Board.tsx` (play and review) are wrapped in Framer Motion's `MotionConfig reducedMotion="user"`, which turns off transform and layout animation when the media query matches. The piece transitions themselves (`PIECE_MOVE_TRANSITION`, the review's slide or snap, in `src/features/board/pieceMotion.ts`) don't need to know.
- **Game over:** `GameOver.tsx` asks `prefersReducedMotion()` (`gameOverEntrance.ts`, a `matchMedia` read, `false` where there's no window) and passes it to `gameOverEntrance`, which then always returns `instant`. As a second guard, `GameOver.css` has an `@media (prefers-reduced-motion: reduce)` rule that sets `animation: none` on the `animate` card and scrim.
- **CSS-only bits:** the clock hand (`Player.css`) and the review progress bar (`src/styles/review.css`) each have their own `@media (prefers-reduced-motion: reduce)` rule.
- The Flip and a drag drop are instant for everyone, not only under reduced motion (`useInstantLayoutTransition` in `Button.tsx` and `Square.tsx`).

## Why it's this way
- **Follow the system, no in-app switch** (plan board-feel asked for `MotionConfig reducedMotion="user"`; no `decisions.md` entry): one setting the user already has, and nothing to store.
- **The game-over card reads the media query itself:** `MotionConfig reducedMotion="user"` keeps opacity fades, so the card would still fade. Turned down: relying on `MotionConfig` alone, as the sprint contract notes. See `pod-docs/decisions.md` → "The game-over card eases in after a short pause".
- **Instant, not shorter:** the plan's `## Look` rules out "motion when the system asks for reduced motion", so there's no 50 ms version.

## Watch out
- **Fake-DOM tests can't see motion.** The rules are tested as values: `gameOverEntrance(true, …)` is `instant` (`game-over-entrance.test.ts`), a stubbed `matchMedia` renders `data-entrance="instant"` (`game-over-card.test.tsx`), and `tests/board-css.test.ts` reads the media block. For pieces, check in the browser.
- **Browser check:** start Chrome with `--force-prefers-reduced-motion`, or use CDP `Emulation.setEmulatedMedia`. Then sample `getComputedStyle(piece).transform` every frame: every sample should be `none`.
- A new animation anywhere needs its own reduced-motion rule. `MotionConfig` only covers Framer Motion elements inside `Board.tsx`'s two screens; CSS animations and anything outside them are on their own.

## History
- 2026-10-06 · board-feel (sprint board-interaction, F1) · `MotionConfig reducedMotion="user"` on the board; pieces jump under reduced motion · [report](../reports/board-feel.html)
- 2026-10-20 · ui-motion · the game-over entrance is `instant` under reduced motion; the row now checks it · [report](../reports/ui-motion.html), [PR #98](https://github.com/iamphduc/chess-web/pull/98)
