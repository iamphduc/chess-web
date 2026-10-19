# Idea: mark the bot's mistakes in the review

Status: parked

_Noted: 2026-10-19 · From: the `ui-refresh` plan interview; first raised by the sparring-ladder T1 slice · Decision: "The review marks only your moves" in [decisions](../decisions.md)_

## The idea

Grade the sparring bot's moves too, so his inaccuracies, mistakes and blunders get a mark in the review's move list, not only a drop in the graph. You could then see where he went wrong and whether you punished it.

## Why it's on hold

The review grades only your moves (`byHuman` in `src/game/review/build-review.ts`), and the `ui-refresh` plan changes the review's layout, not its grading.

## What would make it worth building

Not given.
