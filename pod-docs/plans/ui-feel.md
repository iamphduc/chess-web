# Plan: UI feel — calmer piece moves, square avatars, a roomier player row, a Two players button

_Generated: 2026-10-21 · Status: archived · Grilled-with: grilling (fast)_
Port base: 3200

## Goal
A third polish round from the human's look at `ui-motion`. Game-board pieces move with a gentler curve, avatars are squares, the player row gets more room, and Two players on the home page is a real button.

## Why
The human's words (2026-10-21): "The review speed feel really good but normal pieces feel too fast, maybe because of the transition type? Can you check chess.com to see how they do it?"; "Change the rounded avatar to square, review the gap in the player row too"; "For the two players, use a button instead of text button, I barely see it".

Measured on 2026-10-21 (chrome-devtools-axi, an e2–e4 move sampled every frame): chess.com's analysis board at its default ("Medium") takes about 155 ms with an ease-in-out curve (6–10 % of the way after the first frames, a gentle finish). Ours, in play and in the review, takes about 125–150 ms with an ease-out curve that covers about 20 % in the first frame, so the piece leaps off its square. Lichess's board library (chessground) and chessboard.js both default to 200 ms.

Success:
- A game-board move eases in and out over about 200 ms; the review's step stays as it is.
- Every avatar is a square with the 4 px corner, and the player row matches draft option C.
- Two players is a full-width outlined button under Play.

Constraints: the `ui-refresh` Look with the `ui-polish` and `ui-motion` changes, static GitHub Pages site under `/chess-web/`, Framer Motion for pieces, no new dependencies.

## Scope
**In scope:**
- **Piece motion:** game-board piece moves (a click, a tap, his move, castling's rook, en passant) take about 200 ms with an ease-in-out cubic curve, instead of today's 150 ms ease-out. The review's one-step playback keeps 150 ms ease-out. The Flip stays instant, a drag drop still lands at once, and reduced motion still jumps.
- **Square avatars:** your ♔/♚ disc, his ♞ disc and Liem's photo become 40 px squares with `--radius` (4 px) corners instead of circles, on every player card, in both modes and in the review.
- **Player row (draft option C):** 12 px (`--space-3`) between the avatar and the name, 16 px (`--space-4`) between the name side and the clock, and 8 px (`--space-2`) above and below each card. The card's two-line text column, the material line and the clock are otherwise unchanged. At 375 px the material line still cuts only the glyphs, never "+N" or his detail, and nothing scrolls sideways.
- **Two players button (draft option 48 px):** the home page's "Two players on one board →" text link becomes a full-width secondary button (`.button`, outlined), 48 px tall like Play, 12 px under it, reading "Two players on one board". It still goes to `#/two-players`.
- **Docs:** `pod-docs/decisions.md` entries for the piece curve, the square avatars, the player row spacing and the Two players button (superseding the `ui-motion` "Pieces move in 150 ms with an ease-out" entry for the game board); the feature-details files they touch; `pod-docs/features.md` rows.

**Out of scope:**
- **Changes to the review's motion,** the game-over entrance, or the material line's order.
- **A setting for animation speed,** like chess.com's Slow / Medium / Fast.
- **Other home page changes.**
- **Dark mode** (`pod-docs/ideas/dark-mode.md`) and **marking his mistakes** (`pod-docs/ideas/mark-bot-mistakes.md`), both still parked.

## Sprint sequence

| Sprint | Goal | Status | Depends on |
|--------|------|--------|------------|
| feel | 200 ms ease-in-out game moves; square avatars; player row option C; Two players button | done | — |

Status values: `planned` / `active` / `done`. The orchestrator only flips its row's Status — it does not rewrite Goal/Depends-on retroactively.

The `Depends on` column is the **only** cross-sprint dependency signal. Wave ordering and per-slice deps live inside the sprint doc and are opaque from here.

## Look
The `ui-refresh` Look with the `ui-polish` and `ui-motion` changes, unchanged in palette, fonts and tokens. The new parts, as the human picked them in [the draft](../design-drafts/ui-feel.html) ("1C 2B"):
- **Player row, option C:** avatars are 40 px squares with `--radius` corners; avatar → name `--space-3` (12 px); name side → clock `--space-4` (16 px); card padding `--space-2` (8 px) top and bottom.
- **Two players, the 48 px option:** the secondary `.button` style, full width, `min-height: 48px`, `--space-3` under Play.
- **Motion:** game moves 200 ms ease-in-out cubic; review steps 150 ms ease-out.
- **Rules out:** circles for avatars, new colors or fonts, springs or overshoot.
- **Draft:** `pod-docs/design-drafts/ui-feel.html` (player row C, button 48 px picked)

## Key decisions
- **Game-board moves: 200 ms ease-in-out cubic; the review keeps 150 ms ease-out** (human, accepted, from the chess.com measurement). Supersedes the game-board part of "Pieces move in 150 ms with an ease-out" (2026-10-20).
- **Square avatars with the 4 px corner** (human).
- **Player row option C** (human, from the draft).
- **Two players is a full-width 48 px secondary button** (human, from the draft).
- **Ships in `ui-feel-staging`, cut from `main`** (human, accepted).

## Known risks
- **Option C's wider gaps leave less width for the name and material on a phone.** Mitigation: check at 375 and 320 px that "+N" and his detail are never cut and nothing scrolls sideways.
- **8 px card padding makes each card taller (about 60 px instead of 52–56 px), which can shrink the board on short screens.** Mitigation: check the board size at 1400, 992 and 375 px; `squareSizeFor` must account for the new card height.
- **A 200 ms move may still be running when his reply starts.** Mitigation: a fast click right before his reply must still end on the last position.

## Open questions
- None.

## Verification
- `npm run build && npm test` pass.
- **Pieces:** a game-board move lasts about 200 ms and covers well under 20 % of the way in its first frame (ease-in-out, no overshoot); a review step still lasts about 150 ms ease-out; the Flip and a drop show no motion; reduced motion jumps.
- **Avatars:** every `.player__disc` and `.player__avatar` has `border-radius: 4px`.
- **Player row:** the avatar-to-name gap is 12 px, the name-side-to-clock gap 16 px and the card padding 8 px; at 375 and 320 px "+N" and his detail are never cut and `scrollWidth` equals the viewport width.
- **Home:** Two players is a `.button` (not `a.home__alt`), full width, 48 px tall, 12 px under Play, and goes to `#/two-players`.
- **Feature rows:** every `pod-docs/features.md` browser row passes, updated where this plan changed it on purpose.
- **Look:** home, both board modes and the review match the Look at 1400, 992 and 375 px, with no horizontal scroll.
