# Resign

## What it is
**Resign** sits in the Moves card foot, after New game, while a game can be resigned. The first press turns it into a red **Confirm** for 3 s. A second press inside that time ends the game; otherwise it turns back to Resign.
- **vs Liem:** shown from the start, on his turn too. You always lose. **Review game** shows afterwards if you had made a move.
- **Two players:** shown only once **Play** starts the clocks (Play then hides). The side whose clock runs loses.

The game then ends like any other: the clocks stop and show their time, and the game-over card reads "<Color> wins" · "Resigned". See [game-over](game-over.md).

## How it works
- **Rule:** `canResign(board)` (`src/features/board/gameEnd.ts`) is `isPlaying && gameOver === Continue`. A game with no running clocks can't be resigned.
- **Action:** `resign()` in the board slice picks the loser (`humanColor`, or the side whose clock runs via `isWhiteClockTurn`), sets `result = { winner, reason: "resigned" }`, turns `isPlaying` off and clears the hints. It plays no sound.
- **Two presses:** `resignConfirm.ts` is pure, with the time passed in. Its state is `{ gameId, since, done }`. `pressResign` confirms on the first press, resigns on a second press under 3000 ms, and only once per game. A state from another `gameId` reads as idle, so a new game turns Confirm back.
- **Button:** `ResignButton.tsx` reads `Date.now()`, sets one timeout to re-render when Confirm runs out, and dispatches. It renders nothing when `canResign` is false.
- **Look:** `ResignButton.css` gives `.resign-button` a 104 px width with `white-space: nowrap`. Confirm (`data-confirm="true"`, `aria-label="Confirm resign"`) changes only `color` and `border-color`, to `--accent`. `BoardSidebar.css` keeps every foot on one row from 992 px.

## Why it's this way
- **Foot, 3 s, both modes** (a default the human accepted). See `pod-docs/decisions.md` → "Resign sits in the Moves card foot, with a 3 s red Confirm".
- **One width and a short "Confirm"** (the human's choice): "Confirm resign" made the button grow onto two lines and move the foot.
- **Press logic outside React:** a pure function with the time passed in, so the 2999 ms, 3000 ms and triple-press cases are plain tests (`resign-confirm.test.ts`). The component only owns the timer.
- **Loser vs Liem is always you,** even on his turn (sprint contract): only you can press it, so it is always your resignation. The trade-off is that the Two players rule ("the side whose clock runs") differs.

## Watch out
- **His late move:** once `result` is set, `playOpponentMove` for that game is ignored and `liemTurn` returns `null`. `resign.test.ts` › his late move never lands after a resign.
- **The picker:** with a promotion picker open, the mover loses. The picker stays open, the pick completes the pawn, and the result stays "resigned". `promotePawn` restores the earlier `gameOver`, so a mating pick can't flip the result.
- **A slow browser driver can miss the 3 s window.** Separate tool calls that each take a few seconds let Confirm turn back between presses. Press twice in one `eval`, with a short wait between.
- Flip and Sound while confirming keep Confirm. A new game or the end of the game turns it back.
- At 375 px the foot may wrap, but pressing Resign never moves anything in it.

## History
- 2026-10-20 · ui-polish · Resign with a 3 s red Confirm, in both modes; resign action and `GameEnd` result · [report](../reports/ui-polish.html), [PR #91](https://github.com/iamphduc/liem-sparring/pull/91)
