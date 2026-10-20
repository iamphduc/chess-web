# Game over

## What it is
When a game ends by checkmate, stalemate, a flag fall or a resign, the board dims under a card:
- the result: "White wins", "Black wins" or "Draw" (the same words in both modes);
- how it ended: "Checkmate", "Stalemate", "On time" or "Resigned";
- **Review game** (vs Liem, after a move of yours) and **New game**.

The final position, the last-move tint and the check glow show through the scrim. Once the game is over, no piece can be picked up or moved.

## How it works
- **Result:** the board slice holds `result: GameEnd | null` (`{ winner: PieceColor | null; reason: EndReason }`, in `src/features/board/gameEnd.ts`). A move that mates or stalemates sets it, as do `stop()` on a flag fall and `resign()`. It's set once; only `reset` and `newGame` clear it. The older `gameOver: GameOverType` still exists, and `canResign`, `liemTurn` and the clocks read it.
- **Card text:** `gameOverView(board, match)` (`gameOverView.ts`) is pure. It returns `null` mid-game or while a promotion pick is pending; otherwise `{ title, reason, review }`. `review` is `canOpenReview`.
- **New game:** `gameOverNewGame(mode)` returns `replayLiemGame()` vs Liem and `reset()` in Two players.
- **Markup:** `GameOver.tsx` renders `.game-over` (the scrim fills `.squares`, `background-color: var(--game-over-scrim)`, `pointer-events: none`) holding `.game-over__card` (`pointer-events: auto`, `--surface`, a 24 px pad) with `.game-over__title`, `.game-over__reason` and `.game-over__actions`, a wrapping row with an 8 px gap.
- `--game-over-scrim` is `rgba(30, 27, 22, 0.4)`, the `--ink` value at 40 %, in `src/index.css`.

## Why it's this way
- **Dim the board** (the human's choice): "dim the board to make the endgame more prominent". Turned down: the 2026-10-19 cream card with no scrim. See `pod-docs/decisions.md` → "The game-over card dims the board".
- **Result and reason, both buttons** (a default): one look says who won and how, and the next step is on the card. The same words serve both modes.
- **A scrim that takes no clicks:** the board's marks stay visible and nothing on the board can be played anyway, so only the card needs clicks.
- **The card waits for a promotion pick:** a flag fall or resign can land while the picker is open. Showing the card then would cover the picker.
- **Phone buttons stack when they don't fit** (the plan's value in use for its open question).

## Watch out
- **The first ending sticks.** A pick after a flag fall or a resign keeps that result, and a later `stop()` or `resign()` changes nothing. Tests: `resign.test.ts`, `promotion-clock.test.tsx`.
- **Import cycle:** `GameOver.tsx` → `gameOverView.ts` → `BoardSlice` → `GameOver.tsx` (for `GameOverType`). A test that imports `liemTurn.ts`, `Piece.tsx` or `gameEnd.ts` before the store crashes with "Cannot read properties of undefined (reading 'Continue')". The fix (move the enum to its own file) is queued as Fix next.
- `flagFallWinner` ("White" | "Black") still exists next to `result`. Read `result` for new code.
- The scrim token is the only color this plan added. Don't add a second one for the card.

## History
- 2026-10-20 · ui-polish · scrim over the board; result and reason from `GameEnd`; Review game and New game on the card; resign counts as an ending · [report](../reports/ui-polish.html), [PR #91](https://github.com/iamphduc/chess-web/pull/91)
