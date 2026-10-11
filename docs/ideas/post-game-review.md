# Idea: post-game review against Liem

_Noted: 2026-10-09 · From: the `play-like-liem` plan interview (option C of "what helps you learn") · Research: [play-like-player](../research/play-like-player.md)_

After a game against the Liem opponent, show a review that teaches:

- **Where you went wrong:** the moves where your position dropped the most, judged by Stockfish at full strength.
- **What he'd likely have played:** at each of those moves, his book move when the position is in his games, otherwise the engine's best move.
- **Where you left his book:** the first move where the game left his known lines, and what he usually played there.

## Why it's not in the first plan

It needs its own design: a review screen, a move list you can step through, and a full-strength analysis pass that may take a while in the browser. The first plan ships the opponent and the in-game book panel. This review builds on both.

## Open questions

- How many moves to flag: a fixed top 3, or every drop over a threshold?
- Analysis time per move in the browser, and whether to show progress.
- Do we keep past games to review later? That needs storage, which the app doesn't have yet.
