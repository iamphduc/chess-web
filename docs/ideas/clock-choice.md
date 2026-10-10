# Idea: pick the clock before a game against Liem

_Noted: 2026-10-10 · From: the human's review of PR #62 (item 7) · Plan: [play-like-liem](../plans/play-like-liem.md)_

Today every vs-Liem game uses the app's 10+0 clock, so `bookForClock` always picks his **online** book. A clock choice on the setup card would let you play him at a slow time control, where he plays from his **slow** book.

- **What it adds:** a clock row on the setup card, for example 5+0, 10+0, 15+10 and 30+0. The pick drives both the board clocks and `GameClock`, so a game of 15 minutes or more (base + 40 × increment ≥ 900 s) uses the slow book.
- **What it needs:** clocks that take a base and an increment (the board's clock has no increment today), and a fuller slow book. The slow book has only 129 games until his over-the-board PGN goes into `games/otb/`.
- **Also worth deciding:** whether Stockfish's think time should follow the clock, because `UCI_Elo` is tuned at 120 s + 1 s.

## Open questions

- Which clock presets to offer.
- Whether the slow book is worth it before the over-the-board games are imported.
