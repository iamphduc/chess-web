# Driving touch in the browser smoke

_Found: 2026-10-06 · board-interaction (T1) · updated 2026-10-06 · sound-and-touch-drag (T1)_

`chrome-devtools-axi` has no raw touch input. Its `drag` uses the mouse, and `emulate --viewport "375x812x2,mobile,touch"` only sets up a touch viewport, so a touch drag can't be driven through it.

- **Taps:** with touch emulation on, a tap fires `touchend → mousedown → click`, so clicking pieces and squares from page JS (or with the tool's `click`) is a fair stand-in for tap-to-move.
- **Touch drag:** send real CDP `Input.dispatchTouchEvent` events from a small Node script to a separately launched headless Chrome. The full script and the steps are in `docs/research/touch-drag.md` section 4. Touch events built in page JavaScript are not a valid test.
- **`chrome-devtools-axi run`** fails on Windows (`Received protocol 'c:'`). Pass multi-line scripts to `eval` as one line instead, for example `eval "$(tr '\n' ' ' < script.js)"`.

## Touch-drag smoke run

The app uses `react-dnd-multi-backend` with the `HTML5toTouch` preset. The mouse uses the HTML5 backend. The first `touchstart` switches to the touch backend, and a touch-only preview (`PieceDragPreview`) draws the dragged piece under the finger.

Set up as in `docs/research/touch-drag.md` section 4: one dev server, one headless Chrome with `--remote-debugging-port`, and `touch.mjs` saved outside the repo. Change `URL_` and the `9333` port in the script to your own ports. The script finds squares by DOM order, which only matches the unflipped board. For the flipped check, find squares with `document.querySelector('[data-square="d2"]')` instead.

Run these scenarios. Each one must end with `console none`.

| Scenario | What it should show |
|----------|---------------------|
| `drag` (e2 to e4) | `after e2 null \| e4 piece__WHITE_PAWN_E`, and `1. e4` in the notation. Mid-drag, the overlays list `overlay--dot` (e3 and e4) and `overlay--highlight`, and the screenshot shows the plain pawn at square size (39 px at 375 px wide) under the finger, with the source pawn faded on its yellow square. |
| `drag` with g1 to f3 (edit `from` and `to`) | The knight lands on f3, and the notation shows `1. Nf3`. |
| `tap` | Tapping e2 and then e4 plays `1. e4`. The events show `touchend mousedown click` for each tap. |
| `scrolldrag` with `H=500` | The knight lands on f3, and `scrollY` stays at 150 mid-drag and `maxScroll` stays 150. A drag that starts on a piece doesn't scroll the page. |
| `swipe` with `H=500` | No move, and the page scrolls (`maxScroll` above 150). A swipe that starts on an empty square still scrolls. |
| `drag` on a flipped board | Click **Flip board** first. A drag from d2 to d4 lands on d4 and plays `1. d4`. |
| `mousedrag` (1280 px, no touch) | The pawn lands on e4. The events show `dragstart` and `drop` (the HTML5 backend), and no touch preview element exists mid-drag. |

To find the preview mid-drag, look for a `div` in `#root` with `style.pointerEvents === "none"` and a `backgroundImage`. It has no box shadow, no filter and opacity 1, and its center matches the finger. After the drop, no such element is left.

Not covered: a real phone. Emulated touch is close, but iOS Safari scroll and long-press behavior may differ. If a real phone scrolls the page during a piece drag, add `touch-action: none` on `.piece` only (see `docs/research/touch-drag.md`).
