# Post-game review

## What it is
After a vs-Liem game, **Review game** in the Moves card foot opens `#/review`. The top bar reads "← Home", "Review · vs Medium" and **Play again**. The sidebar holds, in order: an 80 px win-% graph of your side, the key-moment card, accuracy, the Moves card (Back to game, Flip and Sound) and "Left his book at move N". On a phone the graph is the first card in the bottom sheet.

## How it works
- The analysis, grading and key moments are unchanged from the game-review plan (`src/game/review`). This file covers the layout.
- `graphPlacement({ wide, sheetOpen, low })` (`src/features/review/reviewLayout.ts`) returns `"sheet"` only below 768 px with the sheet open and up. Otherwise it returns `"sidebar"`, so `[data-review-graph]` appears exactly once.
- The graph always plots your side. `graphSide` and its switch are gone from the review slice, and a click still selects the nearest move.
- `#/review` opens only when `canOpenReview` holds. Otherwise `arriveAt` falls back to play, then home (see [screens-by-hash-link](screens-by-hash-link.md)).
- **Play again** is `playAgain`: `replayLiemGame` (same level and color), then `leaveReviewForPlay`. **Back to game** is a plain `#/play` link, and Forward reopens the review where the pass was.

## Why it's this way
- **Graph in the sidebar** (the human's choice): the full-width strip was "kinda far away from the analysis sideboard". Turned down: the strip, and the White / You switch. See `pod-docs/decisions.md` → "The review graph sits in the sidebar and shows once".
- **Shown once by a pure rule** (a default): the graph has one place at a time, the sheet or the sidebar, and `review-layout.test.ts` pins the rule. Turned down: a graph in both places.
- **Play again in the top bar, Back to game in the foot** (a default). See `pod-docs/decisions.md` → "The review's top bar has Play again; Back to game stays in the review".
- **Grades on cream:** each keeps its hue, darkened to 4.5:1. See `pod-docs/decisions.md` → "Grade and low-time colors on cream".

## Watch out
- While you try a move on a phone, the sheet sits low and the graph moves to the top of the sidebar. That's the rule, not a duplicate.
- Play again must not push a new `#/play` entry. Pushing one made Back look broken (fixed in PR #85).
- At 375 px the title is cut ("Review · vs M…") between ← Home and Play again (queue, Someday).
- `emulate` in the browser tools reloads the page, which goes home. Set the phone viewport before you play.
- The review still marks only your moves: `pod-docs/decisions.md` → "The review marks only your moves".

## History
- 2026-10-16 · post-game-review · the review after a vs-Liem game: grades, accuracy, key moments, win-% graph · [report](../reports/post-game-review.html)
- 2026-10-19 · ui-refresh · graph in the sidebar and phone sheet, no side switch, Play again in the top bar, review in the Look · [report](../reports/ui-refresh.html), [PR #84](https://github.com/iamphduc/chess-web/pull/84), [PR #85](https://github.com/iamphduc/chess-web/pull/85)
