# Driving touch in the browser smoke

_Found: 2026-10-06 · board-interaction (T1)_

`chrome-devtools-axi` has no raw touch input. Its `drag` uses the mouse, and `emulate --viewport "375x812x2,mobile,touch"` only sets up a touch viewport, so a touch drag can't be driven through it.

- **Taps:** with touch emulation on, a tap fires `touchend → mousedown → click`, so clicking pieces and squares from page JS (or with the tool's `click`) is a fair stand-in for tap-to-move.
- **Touch drag:** send real CDP `Input.dispatchTouchEvent` events from a small Node script to a separately launched headless Chrome. The full script and the steps are in `docs/research/touch-drag.md`. Touch events built in page JavaScript are not a valid test.
- **`chrome-devtools-axi run`** fails on Windows (`Received protocol 'c:'`). Pass multi-line scripts to `eval` as one line instead, for example `eval "$(tr '\n' ' ' < script.js)"`.
