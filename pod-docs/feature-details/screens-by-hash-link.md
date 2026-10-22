# Screens by hash link

## What it is
Four screens, each with its own hash: `#/` home, `#/play` the vs Liem board, `#/two-players` and `#/review`. Back and Forward move between them. A reload of `#/play` or `#/review` with no game goes home, and so does any unknown hash.

## How it works
- `src/app/route.ts`: `parseHash` matches exactly (`#/play/` and `#/PLAY` are unknown); `""`, `"#"` and `"#/"` are home. `goTo(screen)` sets `location.hash`, which adds a history entry.
- `useHashRoute` (mounted in `App.tsx`) runs `followHash` on load and on every `hashchange`. `followHash` dispatches `arriveAt(screen)`, which brings the store in line and returns the screen to show. When that screen's hash differs from the URL, it calls `replaceState`, which adds no entry and fires no event.
- `arriveAt` falls back: review with no finished game → play; play with no vs-Liem game → home. Home runs `goHome()` (a reset) unless the store is already home. Two players calls `switchMode("two-player")`, which keeps a game in progress when you're already there.
- Leaving the review for play: a review opened from `#/play` marks its history entry (`history.state["liem-sparring.reviewOverPlay"]`). **Play again** (`leaveReviewForPlay`) then steps Back onto that `#/play` entry, or replaces `#/review` with `#/play` when no entry is marked. The review has no **Back to game** link; the browser's Back goes to `#/play` (`arriveAt` closes the review with `backToGame`).

## Why it's this way
- **Hash links, no router library** (the human's choice): they work on GitHub Pages with no server. See `pod-docs/decisions.md` → "The site opens on the home page".
- **Going home ends the game** (a default). Turned down: keeping the game so `#/play` can resume it, which needs a "resume" state. See `pod-docs/decisions.md` → "Going home ends the game".
- **Play again steps Back, it doesn't push.** Pushing left a `#/review` entry that fell back to play, so Back seemed to do nothing (review round 1, fixed in PR #85).
- **Rules in a thunk, glue in a hook.** `arriveAt` is tested on a store with no DOM, and `useHashRoute` holds no rules.

## Watch out
- The store isn't saved, so a reload always loses the game. That's by design, not a bug.
- Back from `#/play` goes home and ends the game, so Forward stays on `#/`.
- Board unmounts on home, so the next game loads his engine again (from the browser cache).
- Don't call `goTo("play")` from the review. Use `leaveReviewForPlay`, or one Back will land on the board again.
- New history-reading code must keep the `reviewOverPlay` marker when it calls `replaceState` (spread the existing state).

## History
- 2026-10-19 · ui-refresh · hash screens, `arriveAt` fallbacks and ← Home; review fix: Play again steps Back onto `#/play` · [report](../reports/ui-refresh.html), [PR #84](https://github.com/iamphduc/liem-sparring/pull/84), [PR #85](https://github.com/iamphduc/liem-sparring/pull/85)
