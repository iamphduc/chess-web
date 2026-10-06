# Driving moves in the browser smoke

_Found: 2026-10-04 · vite-switch · updated 2026-10-06 · board-interaction (H1)_

**Easiest path: click two squares.** Each square is a `div.square` with `data-square="<file><rank>"` (for example `data-square="e2"`), and a click anywhere on it dispatches `clickSquare`. Click the piece's square, then the target square, to play a move, with `eval`: `document.querySelector('[data-square=e2]').click(); document.querySelector('[data-square=e4]').click()`. This works while the clock runs, at any viewport, and on a flipped board (the attribute is always the real square). For promotion, click the picker's piece after the second click.

Use drag only when the drag itself is under test. Pieces are `div.piece` elements with CSS background images inside `div.square`; they are not in the accessibility tree, so the browser tool has no refs for them.

- Give the source piece and target square `role="img"` + an `aria-label` with `eval`, take a `snapshot`, then `drag @<src> @<dst>`. Hand-built `DragEvent`s dispatched from page JS did not move a piece.
- After **Play**, the clock re-renders every second and makes refs stale before `drag` runs. Do drag checks before pressing Play, or after **Reset**.
- To drag a piece **during** play anyway: either hold the page's `setTimeout` calls in a queue around the drag and release them after the drop (the clock uses `setTimeout`; the reducers and game-over effect don't), or send the move straight to the app's Redux store. Both were used on 2026-10-05 for the stalemate fix (PR #44).
