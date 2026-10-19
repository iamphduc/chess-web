# New game

## What it is
**New game** in the Moves card foot starts over.
- **vs Liem:** a new game at the same level and color pick, so Random draws a color again. Both clocks start at 10:00 and run. The top bar title doesn't change. ← Home is how you change the level or color.
- **Two players:** the old Reset under a new name. It clears the moves and stops the clocks, and **Play** starts them.
- **Review:** **Play again** in the top bar does the vs-Liem New game, then goes to `#/play`.

## How it works
- vs Liem: `replayLiemGame(random?)` (`src/features/liem/liemActions.ts`). It works only with a vs-Liem game started. It resets, starts at the same `strength` and `colorPick`, flips the board to the new color and clears any review. A new `gameId` drops his answer for the old game.
- Two players: the same reset action as the old Reset button (`Button.tsx` relabelled).
- Clocks: `Player` restarts the time when `gameId` changes. Only the clock effect writes the clock ref the timer reads.
- Each game gives its pieces new `data-layout-id`s (`<gameId>-<piece>`), so pieces appear in place instead of sliding.

## Why it's this way
- **Replay the same level and color** (a default): the setup card that used to sit behind New game is gone. Turned down: keeping the drawn color when the pick is Random. See `pod-docs/decisions.md` → "New game replays the level and color; Random draws again".
- **Changing the level goes through Home:** this keeps one picker, on the home page.

## Watch out
- **Never copy clock state back into the ref on render.** As Black, his first move lands right after New game and renders before the effect's `setClock` applies. A render-time copy put the old running clock back, so your clock kept the old game's time (review round 1, fixed in PR #85). `new-game-clock.test.tsx` checks the clock on screen.
- That test mounts `Player` on a small fake DOM written in the test, because vitest runs with `environment: "node"` and no jsdom (queue, Someday).
- A test that only checks `board.isPlaying` won't catch a clock bug. Read the clock shown.
- Pressing New game while his card says "Thinking…" must never play the stale move.
- `newLiemGame` is only used by tests now (queue, Someday).

## History
- 2026-10-19 · ui-refresh · Reset becomes New game; vs Liem New game replays the level and color; review fix: the clock restarts as Black · [report](../reports/ui-refresh.html), [PR #84](https://github.com/iamphduc/chess-web/pull/84), [PR #85](https://github.com/iamphduc/chess-web/pull/85)
