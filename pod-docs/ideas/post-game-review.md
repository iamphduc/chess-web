# Idea: post-game review against Liem

Status: built — pod-docs/plans/post-game-review.md (PR #73)

_Noted: 2026-10-09 · From: the `play-like-liem` plan interview (option C of "what helps you learn") · Research: [play-like-player](../research/play-like-player.md)_

## The idea

After a game against the Liem opponent, show a review that teaches:

- **Where you went wrong:** the moves where your position dropped the most, judged by Stockfish at full strength.
- **What he'd likely have played:** at each of those moves, his book move when the position is in his games, otherwise the engine's best move.
- **Where you left his book:** the first move where the game left his known lines, and what he usually played there.

## Why it's on hold

It needed its own design: a review screen, a move list you can step through, and a full-strength analysis pass that may take a while in the browser. The first plan shipped the opponent and the in-game book panel, and this review builds on both.

## What would make it worth building

The opponent and the in-game book panel are live.

## Open questions

- How many moves to flag: a fixed top 3, or every drop over a threshold?
- Analysis time per move in the browser, and whether to show progress.
- Do we keep past games to review later? See [saved-games](saved-games.md).
