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
| Review | Play again, Flip, Sound |

**Player cards:** a 40 px square disc or his photo (4 px corners, `--radius`), the name line, a material line under it, and the clock. The material line is the captured pieces, then "+N" (for example `♛♜♝♞♞♟ +4`); it is missing before any capture, and an equal trade lists the glyphs with no "+0". Your card is "You" with ♔ (White) or ♚ (Black). In Two players the cards read "White" and "Black", each with its disc. His card: see [stockfish-is-named](stockfish-is-named.md). On his card, "★ Book · N" or "Thinking…" shares the second line with the material: the material first, the detail at the line's end (agent default, flagged for the human).

## How it works
- `Notation` renders the scoresheet rows. After a move it sets the box's own `scrollTop` from `listScrollTop` (`src/features/board/listScroll.ts`), so only the list scrolls.
- `materialLine(state, color)` (`material.ts`) reads the board, not a capture log; `Player` renders `.player__material[data-material="N"]` inside `.player__sub`, the second line of `.player__text` (the name line is `.player__name`, the title then the name). `.player__captured` comes before `.player__advantage`.
- The card is 60 px: an 8 px pad above and below (`--space-2`) and a 44 px `.player__text` (name line 1.2 × 16 px, 4 px gap, 20 px second line). The avatar sits 12 px (`--space-3`) from the name, and the name side 16 px (`--space-4`) from the clock: option C in `pod-docs/design-drafts/ui-feel.html`. The column keeps its height with or without the second line, so the name doesn't move at the first capture.
- `Player` shows `span.player__disc` when there's no photo and no `glyph`; his ♞ uses the same class. `avatarSrc` returns `null` for an unknown name.
- The clock (`PlayerClock`) is a fixed 112 px box. Each digit is a `.player__timer-digit` cell (0.62 em, centred), and each `:` or `.` a `.player__timer-sep` cell (0.28 em).
- Resign: see [resign](resign.md).

## Why it's this way
- **One card instead of Fallen Pieces and a buttons box** (the human's choice): see `pod-docs/decisions.md` → "The board screen has a top bar and one Moves card".
- **Counted from the board** (a default): promotions count with no extra state. See ""+N" counts promotions".
- **A disc, not a stock photo** (a default the human accepted): the cartoon picture didn't match his ♞ card. See "A color disc in place of a photo".
- **Square avatars and option C** (the human's choice, from `pod-docs/design-drafts/ui-feel.html`): C was picked over the recommended B. It costs the second line 8 px of width on a phone. See `decisions.md` → "Avatars are squares with the 4 px corner" and "The player row has more room (option C)".
- **A fixed clock** (the human's choice): a running clock must not "jump in out". Turned down in review: trusting `tabular-nums`, which Quicksand ignores; a font file with `tnum` was the other option.
- **Pieces first, then "+N", under the name** (the human: "+4 feel like reversed"). Turned down: the 2026-10-19 "+N" before the glyphs on the name line. See `decisions.md` → "The material line sits under the name, pieces then +N".
- **His detail shares the second line, material first** (agent default, override anytime): three lines don't fit the 44 px text column, and detail-first would make the material jump about 70 px each time "Thinking…" comes and goes. See `decisions.md` → "His card's detail shares the material line, material first".
- **The list scrolls itself** (sprint contract): `scrollIntoView` scrolled every scrollable parent, so the page jumped on each move.

## Watch out
- **Never call `scrollIntoView` (or `window.scrollTo`) on a move.** `body { overflow-anchor: none }` in `src/index.css` is also needed: Chrome's scroll anchoring moved the page about 70 px at 375 px. Tests: `notation-scroll.test.tsx`.
- **`tabular-nums` does nothing in the self-hosted Quicksand** ("1" is 0.389 em, "0" 0.614 em at 700). `tests/clock-digits.test.ts` reads the real widths from the woff2; keep it if you change the font or the cells.
- From 992 px every foot fits one row: its text buttons take 12 px sides and the row doesn't wrap. At 375 px it may wrap.
- "+N" and the detail are never cut or wrapped. On a narrow card the glyphs give way first (ellipsis), and the name line cuts on its own.
- **`min-width: 0` on every flex box from `.player__info` down to `.player__captured`.** Without it on `.player__material`, the box can't shrink below its glyph row, the ellipsis never applies, and at 375 px "+N" and his detail slide under the clock (or the page scrolls sideways). Don't add `overflow: hidden` to `.player__material`: it would clip "+N". `tests/player-css.test.ts` › `the material line never cuts +N` checks both. Found in review of PR #98, fixed in PR #99.
- Below about 300 px of viewport his detail and "+N" could overlap (not reproduced; 320 and 375 px fit). Queued as Someday.
- The second line is always kept, so on a card with no captures and no detail the name sits about 12 px above the disc's middle. That's on purpose: see `decisions.md` → "The name stays put on a card with no captures".
- `BoardSlice.fallenPieces` is still filled, but nothing reads it (queue, Someday).
- Never use `--gold` for text.
- `Player.css` still has two `50%` values: the clock hand's `transform-origin` and a `clip-path: inset(50%)`. They aren't corners. `tests/player-css.test.ts` bans only `border-radius: 50%`, so don't widen it to every `50%`.
- Every `.board > .player` is 60 px (8 + 44 + 8). If you change the pad, the text column or a line height, change that height and its test with it.

## History
- 2026-10-19 · ui-refresh · Moves card scoresheet with controls in its foot; "+N" material on the player cards replaces Fallen Pieces · [report](../reports/ui-refresh.html), [PR #84](https://github.com/iamphduc/liem-sparring/pull/84)
- 2026-10-20 · ui-polish · a move scrolls only the list; Resign in the foot, one row from 992 px; ♔/♚ discs; White and Black in Two players; fixed clock box and digit cells · [report](../reports/ui-polish.html), [PR #91](https://github.com/iamphduc/liem-sparring/pull/91), [PR #92](https://github.com/iamphduc/liem-sparring/pull/92)
- 2026-10-20 · ui-motion · the material line moves under the name, pieces then "+N"; his detail shares it; Review foot reads Play again, Flip, Sound; `min-width: 0` fix so only the glyphs cut · [report](../reports/ui-motion.html), [PR #98](https://github.com/iamphduc/liem-sparring/pull/98), [PR #99](https://github.com/iamphduc/liem-sparring/pull/99)
- 2026-10-21 · ui-feel · 40 px square avatars with 4 px corners; row option C (12 px to the name, 16 px to the clock, 8 px pads); cards 60 px · [report](../reports/ui-feel.html), [PR #101](https://github.com/iamphduc/liem-sparring/pull/101)
