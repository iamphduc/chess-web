# Moves card and material

## What it is
The board screen's sidebar card and the "+N" line on the player cards. The Moves card is a scoresheet: one row per move, alternate rows on `--surface-2`, and the last move in an ink chip. Its foot holds the controls:
- **vs Liem:** Review game (once the game can be reviewed), New game, Flip and Sound.
- **Two players:** Play, New game, Flip and Sound.
- **Review:** Back to game, Flip and Sound.

Each player card shows "+N" and the captured pieces beside the name once that side is ahead or has captured something. The Fallen Pieces panel is gone.

## How it works
- `Notation` renders the `.notation` list as `.scoresheet` rows (base classes in `src/styles/look.css`). Notation strings come from the board slice as before (disambiguation, `O-O`, `+`, `#`).
- `materialLine(state, color)` (`src/features/board/material.ts`) reads the board, not a capture log. `captured` lists the other side's kinds missing from their starting count, highest first. `advantage` is this side's piece value (P 1, N 3, B 3, R 5, Q 9) minus the other's, or 0.
- `Player` renders `.player__material[data-material="N"]` and leaves it out at the start and in an equal position with no captures.

## Why it's this way
- **One card instead of Fallen Pieces and a buttons box** (the human's choice): the extra panels made the gaps uneven. See `pod-docs/decisions.md` → "The board screen has a top bar and one Moves card".
- **Counted from the board** (a default): promotions count with no extra state. A promoted pawn adds the new piece and takes away the pawn, and the glyphs show only what was really taken. See `pod-docs/decisions.md` → ""+N" counts promotions".
- **Review game in the foot** (a default): it needed a place once the buttons box went. See `pod-docs/decisions.md` → "Review game sits in the Moves card".

## Watch out
- "+N" is never cut. On a narrow card the glyphs and then the name give way with an ellipsis.
- An equal trade shows the glyphs on both cards but no "+0".
- `BoardSlice.fallenPieces` is still filled but nothing reads it (queue, Someday).
- After a game ends, the vs-Liem foot at 1400 px wraps Flip and Sound onto a second line under Review game and New game. The report noticed this; it isn't in the queue yet.
- The current-move chip is `--ink` with `--bg` text, and marks are red ink. Never use `--gold` for text.

## History
- 2026-10-19 · ui-refresh · Moves card scoresheet with controls in its foot; "+N" material on the player cards replaces Fallen Pieces · [report](../reports/ui-refresh.html), [PR #84](https://github.com/iamphduc/chess-web/pull/84)
