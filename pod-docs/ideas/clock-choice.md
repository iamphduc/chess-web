# Idea: pick the clock before a game against Liem

Status: parked

_Noted: 2026-10-10 · From: the human's review of PR #62 (item 7) · Plan: [play-like-liem](../plans/play-like-liem.md)_

## The idea

Today every vs-Liem game uses the app's 10+0 clock, so `bookForClock` always picks his **online** book. A clock choice on the home page would let you play him at a slow time control, where he plays from his **slow** book.

- **What it adds:** a clock row on the home page, for example 5+0, 10+0, 15+10 and 30+0. The pick drives both the board clocks and `GameClock`, so a game of 15 minutes or more (base + 40 × increment ≥ 900 s) uses the slow book.
- **What it needs:** clocks that take a base and an increment (the board's clock has no increment today), and a fuller slow book.
- **Also worth deciding:** whether Stockfish's think time should follow the clock.

## Why it's on hold

The slow book has only 129 games until his over-the-board PGN goes into `games/otb/`, and the board's clock has no increment yet.

## What would make it worth building

His over-the-board games are imported, so the slow book is worth playing against.

## Open questions

- Which clock presets to offer.
- Whether the slow book is worth it before the over-the-board games are imported.
