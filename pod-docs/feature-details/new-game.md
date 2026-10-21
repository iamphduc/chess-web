# New game

## What it is
**New game** starts over. It sits in the Moves card foot and, once a game ends, on the game-over card too.
- **vs Liem:** a new game at the same level and color pick, so Random draws a color again. Both clocks start at 10:00 and run. The top bar title doesn't change. ← Home is how you change the level or color.
- **Two players:** the old Reset under a new name. It clears the moves and stops the clocks, and **Play** starts them.
- **Review:** **Play again** in the top bar does the vs-Liem New game, then goes to `#/play`.

A new game also clears the game's result, turns a pending Resign Confirm back, and brings back the book note's waiting state.

## How it works
- vs Liem: `replayLiemGame(random?)` (`src/features/liem/liemActions.ts`). It resets, starts at the same `strength` and `colorPick`, flips the board to the new color and clears any review. A new `gameId` drops his answer for the old game.
- Two players: the board slice's `reset`.
- From the game-over card: `gameOverNewGame(mode)` (`src/features/board/gameOverView.ts`) picks between the two.
- `reset` and `newGame` set `result` back to `null`. `ResignConfirm` and the book note's kept height belong to a `gameId`, so a new `gameId` clears both.
- Clocks: `Player` restarts the time when `gameId` changes. Only the clock effect writes the clock ref the timer reads.
- Each game gives its pieces new `data-layout-id`s (`<gameId>-<piece>`), so pieces appear in place instead of sliding.

## Why it's this way
- **Replay the same level and color** (a default): turned down: keeping the drawn color when the pick is Random. See `pod-docs/decisions.md` → "New game replays the level and color; Random draws again".
- **Changing the level goes through Home:** this keeps one picker, on the home page.
- **State tied to `gameId`:** resign confirm and the note slot reset on their own, with no extra clear action to forget.

## Watch out
- **Never copy clock state back into the ref on render.** As Black, his first move lands right after New game and renders before the effect's `setClock` applies (review round 1 of `ui-refresh`, fixed in PR #85). `new-game-clock.test.tsx` checks the clock on screen.
- That test reads the wall clock and fails when the machine is busy; it passes alone and with `--maxWorkers=2`. Moving it to fake timers is queued as Fix next. See [timing-tests-under-load](../known-issues/timing-tests-under-load.md).
- It mounts `Player` on a small fake DOM written in the test (no jsdom). Its helper skips the disc glyph.
- Pressing New game while his card says "Thinking…" must never play the stale move.
- `newLiemGame` is only used by tests now (queue, Someday).

## History
- 2026-10-19 · ui-refresh · Reset becomes New game; vs Liem New game replays the level and color; review fix: the clock restarts as Black · [report](../reports/ui-refresh.html), [PR #84](https://github.com/iamphduc/chess-web/pull/84), [PR #85](https://github.com/iamphduc/chess-web/pull/85)
- 2026-10-20 · ui-polish · New game on the game-over card; a new game clears the result, the resign confirm and the note slot · [report](../reports/ui-polish.html), [PR #91](https://github.com/iamphduc/chess-web/pull/91)
