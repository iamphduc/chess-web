# Moves card and material

## What it is
The board screen's sidebar card, and the player cards around the board.

**Moves card:** a scoresheet, one row per move, with the last move in an ink chip. Its foot holds the controls:

| State | Foot |
|---|---|
| vs Liem, in progress | New game, Resign, Flip, Sound |
| vs Liem, over | Review game (when reviewable), New game, Flip, Sound |
| Two players, before Play | Play, New game, Flip, Sound |
| Two players, clocks running | New game, Resign, Flip, Sound |
| Two players, over | New game, Flip, Sound |
| Review | Back to game, Flip, Sound |

**Player cards:** a 40 px disc or his photo, the name, "+N" with the captured pieces, and the clock. Your card is "You" with ♔ (White) or ♚ (Black). In Two players the cards read "White" and "Black", each with its disc. His card: see [stockfish-is-named](stockfish-is-named.md).

## How it works
- `Notation` renders the scoresheet rows. After a move it sets the box's own `scrollTop` from `listScrollTop` (`src/features/board/listScroll.ts`), so only the list scrolls.
- `materialLine(state, color)` (`material.ts`) reads the board, not a capture log; `Player` renders `.player__material[data-material="N"]`.
- `Player` shows `span.player__disc` when there's no photo and no `glyph`; his ♞ uses the same class. `avatarSrc` returns `null` for an unknown name.
- The clock (`PlayerClock`) is a fixed 112 px box. Each digit is a `.player__timer-digit` cell (0.62 em, centred), and each `:` or `.` a `.player__timer-sep` cell (0.28 em).
- Resign: see [resign](resign.md).

## Why it's this way
- **One card instead of Fallen Pieces and a buttons box** (the human's choice): see `pod-docs/decisions.md` → "The board screen has a top bar and one Moves card".
- **Counted from the board** (a default): promotions count with no extra state. See ""+N" counts promotions".
- **A disc, not a stock photo** (a default the human accepted): the cartoon picture didn't match his ♞ card. See "A color disc in place of a photo".
- **A fixed clock** (the human's choice): a running clock must not "jump in out". Turned down in review: trusting `tabular-nums`, which Quicksand ignores; a font file with `tnum` was the other option.
- **The list scrolls itself** (sprint contract): `scrollIntoView` scrolled every scrollable parent, so the page jumped on each move.

## Watch out
- **Never call `scrollIntoView` (or `window.scrollTo`) on a move.** `body { overflow-anchor: none }` in `src/index.css` is also needed: Chrome's scroll anchoring moved the page about 70 px at 375 px. Tests: `notation-scroll.test.tsx`.
- **`tabular-nums` does nothing in the self-hosted Quicksand** ("1" is 0.389 em, "0" 0.614 em at 700). `tests/clock-digits.test.ts` reads the real widths from the woff2; keep it if you change the font or the cells.
- From 992 px every foot fits one row: its text buttons take 12 px sides and the row doesn't wrap. At 375 px it may wrap.
- "+N" is never cut. On a narrow card the glyphs and then the name give way.
- `BoardSlice.fallenPieces` is still filled, but nothing reads it (queue, Someday).
- Never use `--gold` for text.

## History
- 2026-10-19 · ui-refresh · Moves card scoresheet with controls in its foot; "+N" material on the player cards replaces Fallen Pieces · [report](../reports/ui-refresh.html), [PR #84](https://github.com/iamphduc/chess-web/pull/84)
- 2026-10-20 · ui-polish · a move scrolls only the list; Resign in the foot, one row from 992 px; ♔/♚ discs; White and Black in Two players; fixed clock box and digit cells · [report](../reports/ui-polish.html), [PR #91](https://github.com/iamphduc/chess-web/pull/91), [PR #92](https://github.com/iamphduc/chess-web/pull/92)
