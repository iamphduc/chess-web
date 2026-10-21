# Post-game review

## What it is
After a vs-Liem game, **Review game** opens `#/review`, from the Moves card foot or the game-over card. The top bar reads "← Home" and "Review · vs Medium", nothing more. From 768 px up the sidebar holds exactly three cards:
1. **Key moment:** the card that walks you through your worst moves.
2. **Summary:** the 80 px win-% graph of your side, then one accuracy line, for example "26 % accuracy ?! 1 ? 0 ?? 1", with each count in its grade color ("—" until ready).
3. **Moves:** the scoresheet, starting with one line such as "Left his book at move 1 · he played 1.Nf3 in 688 games", and a foot of **Play again**, Flip and Sound.

On a phone the bottom sheet holds the key moment and then the summary.

## How it works
- The analysis, grading and key moments are unchanged from the post-game-review plan (`src/game/review`). This file covers the layout.
- The summary is `section.card[data-review-graph]` (`ReviewGraph.tsx`) with `.review-summary__accuracy`: `.review-accuracy`, then `[data-count="inaccuracy" | "mistake" | "blunder"]`. There's no book-move count.
- `LeftBookNote` renders `[data-left-book]` as the first item of the Moves list: left with his most-played move, left with no games ("Left his book at move N"), "Stayed in his book the whole game" (`data-left-book="stayed"`), or nothing without his books.
- `graphPlacement({ wide, sheetOpen, low })` (`src/features/review/reviewLayout.ts`) still decides where the summary goes, so `[data-review-graph]` appears exactly once.
- The top bar is `TopBar` with no `action`; the prop and `.top-bar__action` CSS stay, unused (`tests/review-theme.test.ts` still reads them). The `ReviewTopBar` copy is gone.
- The foot's Play again is `button.button.button--play` and dispatches `playAgain()` (`src/features/review/reviewLayout.ts`): a new game at the same level and color, then `#/play`. The review has no `a[href="#/play"]`; the browser's Back still goes to `#/play` with the finished board.
- **Playback motion:** `ReviewBoard` takes the `gameId` and the cursor (`ply`), both required, and draws each piece as a `motion.div` keyed by piece, with layout id `review-<gameId>-<piece>`. `nextReviewStep` and `reviewStepMotion` (`src/features/board/pieceMotion.ts`) pick the transition: `REVIEW_STEP_TRANSITION` (0.15 s ease-out, its own value, not the game board's 0.2 s ease-in-out `GAME_MOVE_TRANSITION`) for a one-ply step of the same game, flip and size, else `{ duration: 0 }`. The same position again keeps its motion.

## Why it's this way
- **Three cards, key moment first** (the human's choice): "too much review cards on the right side … more simple and compact", and the key moment above the graph. The merge of accuracy into the graph card is a default. Turned down: the five cards from `ui-refresh`. See `pod-docs/decisions.md` → "The review sidebar is three cards".
- **Graph shown once, by a pure rule:** see "The review graph sits in the sidebar and shows once".
- **Play again in the foot, none in the top bar** (the human: "It should be the "Play again" button and remove that from the navbar"): see "Play again sits in the review's Moves card foot", which supersedes the 2026-10-19 top-bar default.
- **Only one-step moves slide** (the human's choice): a jump would sweep every piece across the board. See "The review animates one-step moves only; jumps snap".

## Watch out
- While you try a move on a phone, the sheet sits low and the summary moves to the top of the sidebar. That's the rule, not a duplicate.
- The accuracy line reads "26 % accuracy ?! 1 …" (the draft's words), not the plan's "40 % · ?! 1 …". The reviewer accepted this.
- "Left his book at move 1 · he played 1.Nf3" when he's Black means his move in that position, the same meaning as before.
- A key-moment try counts as found when it isn't an inaccuracy, so a good move other than Stockfish's shows "You found it". This is an open choice for the human: `decisions.md` → "A key-moment try counts as found when it isn't an inaccuracy".
- Play again must not push a new `#/play` entry (fixed in PR #85).
- `emulate` in the browser tools reloads the page, which goes home. Set the phone viewport before you play.
- Each review piece must be its own element (`key={pieceType}`). Without the key, ◀ from a capture reuses the taker's element for the piece it took, and Framer fades the returning piece out to the taker's square (it ends invisible). `review-board-motion.test.tsx › a piece that comes back on ◀ is a new element` guards it.
- A snap still sets a layout transform for one script turn, but none reaches a paint. To check, count transformed pieces in a `ResizeObserver` callback (it runs after the frame's scripts, before paint); a plain `requestAnimationFrame` sample can see one frame of offset.
- `ReviewBoard`'s `gameId` and `ply` are required (plan ui-feel): the build fails the type check if either is left out, so every render, the tests too, says which game and position it shows.

## History
- 2026-10-16 · post-game-review · the review after a vs-Liem game: grades, accuracy, key moments, win-% graph · [report](../reports/post-game-review.html)
- 2026-10-19 · ui-refresh · graph in the sidebar and phone sheet, no side switch, Play again in the top bar, review in the Look · [report](../reports/ui-refresh.html), [PR #84](https://github.com/iamphduc/chess-web/pull/84), [PR #85](https://github.com/iamphduc/chess-web/pull/85)
- 2026-10-20 · ui-polish · three cards: key moment, summary with one accuracy line, Moves with the left-book line; `TopBar` action prop; title fits at 375 px · [report](../reports/ui-polish.html), [PR #91](https://github.com/iamphduc/chess-web/pull/91)
- 2026-10-20 · ui-motion · Play again in the Moves card foot, none in the top bar; ◀ ▶ and the arrow keys slide the one move in 150 ms, jumps snap · [report](../reports/ui-motion.html), [PR #98](https://github.com/iamphduc/chess-web/pull/98), [PR #97](https://github.com/iamphduc/chess-web/pull/97)
