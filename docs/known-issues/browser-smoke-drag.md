# Driving moves in the browser smoke

_Found: 2026-10-04 · vite-switch_

Pieces are `div.piece` elements with CSS background images inside `div.square` (64, row-major, white at the bottom); they are not in the accessibility tree, so the browser tool has no refs for them.

- Give the source piece and target square `role="img"` + an `aria-label` with `eval`, take a `snapshot`, then `drag @<src> @<dst>`. Hand-built `DragEvent`s dispatched from page JS did not move a piece.
- After **Play**, the clock re-renders every second and makes refs stale before `drag` runs. Do drag checks before pressing Play, or after **Reset**.
- To move a piece **during** play anyway: either hold the page's `setTimeout` calls in a queue around the drag and release them after the drop (the clock uses `setTimeout`; the reducers and game-over effect don't), or send the move straight to the app's Redux store. Both were used on 2026-10-05 for the stalemate fix (PR #44).
