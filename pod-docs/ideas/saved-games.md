# Idea: save past games to review later

Status: parked

_Noted: 2026-10-13 · From: the `post-game-review` plan interview (left out of scope) · Research: [post-game-review](../research/post-game-review.md)_

## The idea

The post-game review covers only the game that just ended. Closing or reloading the page loses it. Saving games would let the human review an older game, or compare games over time.

- **Where:** IndexedDB, since `localStorage` caps at about 5 MiB. Browsers can clear IndexedDB under storage pressure, so add an export and import file, or ask for `navigator.storage.persist()`.
- **What to store:** the moves, the date, the color, the strength step, and the review's analysis, so a saved game opens without running Stockfish again.
- **Screen:** a "Past games" list that opens the same review screen.
- **Later:** a report across saved games that finds patterns, such as the phase or move number where the human most often goes wrong, or the first move where they leave his book.

## Why it's on hold

The post-game review shipped first, for the game that just ended. Storage was left out of its scope.

## What would make it worth building

Not given.

## Open questions

- How many games to keep, and whether old ones drop off on their own.
- Whether saved data has to keep working when the review's format changes.
