# Post-game review

## What it is
After a vs-Liem game, **Review game** opens `#/review`, from the Moves card foot or the game-over card. The top bar reads "← Home", "Review · vs Medium" and **Play again**. From 768 px up the sidebar holds exactly three cards:
1. **Key moment:** the card that walks you through your worst moves.
2. **Summary:** the 80 px win-% graph of your side, then one accuracy line, for example "26 % accuracy ?! 1 ? 0 ?? 1", with each count in its grade color ("—" until ready).
3. **Moves:** the scoresheet, starting with one line such as "Left his book at move 1 · he played 1.Nf3 in 688 games", and a foot of Back to game, Flip and Sound.

On a phone the bottom sheet holds the key moment and then the summary.

## How it works
- The analysis, grading and key moments are unchanged from the post-game-review plan (`src/game/review`). This file covers the layout.
- The summary is `section.card[data-review-graph]` (`ReviewGraph.tsx`) with `.review-summary__accuracy`: `.review-accuracy`, then `[data-count="inaccuracy" | "mistake" | "blunder"]`. There's no book-move count.
- `LeftBookNote` renders `[data-left-book]` as the first item of the Moves list: left with his most-played move, left with no games ("Left his book at move N"), "Stayed in his book the whole game" (`data-left-book="stayed"`), or nothing without his books.
- `graphPlacement({ wide, sheetOpen, low })` (`src/features/review/reviewLayout.ts`) still decides where the summary goes, so `[data-review-graph]` appears exactly once.
- The top bar is `TopBar` with an `action` prop (Play again); the `ReviewTopBar` copy is gone.

## Why it's this way
- **Three cards, key moment first** (the human's choice): "too much review cards on the right side … more simple and compact", and the key moment above the graph. The merge of accuracy into the graph card is a default. Turned down: the five cards from `ui-refresh`. See `pod-docs/decisions.md` → "The review sidebar is three cards".
- **Graph shown once, by a pure rule:** see "The review graph sits in the sidebar and shows once".
- **Play again in the top bar, Back to game in the foot** (a default): see "The review's top bar has Play again; Back to game stays in the review".

## Watch out
- While you try a move on a phone, the sheet sits low and the summary moves to the top of the sidebar. That's the rule, not a duplicate.
- The accuracy line reads "26 % accuracy ?! 1 …" (the draft's words), not the plan's "40 % · ?! 1 …". The reviewer accepted this.
- "Left his book at move 1 · he played 1.Nf3" when he's Black means his move in that position, the same meaning as before.
- A key-moment try counts as found when it isn't an inaccuracy, so a good move other than Stockfish's shows "You found it". This is an open choice for the human: `decisions.md` → "A key-moment try counts as found when it isn't an inaccuracy".
- Play again must not push a new `#/play` entry (fixed in PR #85).
- `emulate` in the browser tools reloads the page, which goes home. Set the phone viewport before you play.

## History
- 2026-10-16 · post-game-review · the review after a vs-Liem game: grades, accuracy, key moments, win-% graph · [report](../reports/post-game-review.html)
- 2026-10-19 · ui-refresh · graph in the sidebar and phone sheet, no side switch, Play again in the top bar, review in the Look · [report](../reports/ui-refresh.html), [PR #84](https://github.com/iamphduc/chess-web/pull/84), [PR #85](https://github.com/iamphduc/chess-web/pull/85)
- 2026-10-20 · ui-polish · three cards: key moment, summary with one accuracy line, Moves with the left-book line; `TopBar` action prop; title fits at 375 px · [report](../reports/ui-polish.html), [PR #91](https://github.com/iamphduc/chess-web/pull/91)
