# Plan: UI motion — quicker pieces, a game-over entrance, a cleaner material line, Play again in the review

_Generated: 2026-10-20 · Status: archived · Grilled-with: grilling (fast)_
Port base: 3200

## Goal
A second polish round on the screens `ui-polish` shipped, from the human's look at them. Pieces move quickly and also move in the review's playback, the game-over notice arrives with a short entrance instead of popping in, the player card's material line reads like other chess sites, and the review's foot gets Play again instead of Back to game.

## Why
The human's words, after trying `ui-polish`: "The layout doesn't look good to me, and +4 feel like reversed" (his card reads "Easy +4 ♛♜♝♞♞♟" on the name's line); "the end game notice feels too plain for me, can we add some transition or motion?"; "I think the piece movement is quite slow, and the playback buttons doesn't play piece movement"; "What is the point of "Back to game" button? It should be the "Play again" button and remove that from the navbar". They accepted every recommendation below ("sounds good to me, implement them").

Success:
- The material line sits under the name, pieces first, then "+N".
- The game-over card and scrim ease in after the last move lands; with reduced motion they appear at once.
- A move animates in about 150 ms, in play and in the review's one-step playback.
- The review has one Play again, in the Moves card foot, and none in the top bar.

Constraints: the `ui-refresh` Look with the `ui-polish` change (body text 600), static GitHub Pages site under `/chess-web/`, Framer Motion already in use for pieces, no new dependencies.

## Scope
**In scope:**
- **Material line:** on both player cards, in both modes, the captured pieces and "+N" move to their own line under the name, in the order pieces, then "+N" (for example `♛♜♝♞♞♟ +4`). The glyph colors and the counting (`material.ts`) don't change. At 375 px the line still fits or cuts the glyphs, never "+N" (the 2026-10-19 rule).
- **Game-over entrance:** after a short pause (about 300 ms) so you see the last move, the scrim fades in over about 200 ms, and the card fades in while rising 8 px and scaling from 96 % to 100 % over about 250 ms. The card's content and buttons don't change. Under `prefers-reduced-motion: reduce` both appear at once with no pause. It runs once per game end, not again on a re-render or a resize.
- **Piece speed:** a piece move (a click, a drop, his move, castling's rook, en passant) animates in about 150 ms with an ease-out, instead of Framer Motion's default spring. A drag drop still lands without a second slide. The flip stays instant.
- **Review playback:** ◀ ▶ and the arrow keys animate the one move between the two positions, at the same speed, both forward and back (a capture's piece comes back on ◀). A jump of more than one move, such as clicking a move in the list, the first or last position, or a key moment, shows the new position without motion.
- **Review foot:** the "Back to game" link becomes a **Play again** button with the top bar's action (`playAgain` in `src/features/review/reviewLayout.ts`, a new game at the same level and color). The top bar in the review loses its Play again action and keeps ← Home and the title.
- **Docs:**
  - `pod-docs/decisions.md` entries for: the material line's order and place, the game-over entrance, the 150 ms piece speed, the review's one-step playback motion, and Play again in the review foot (superseding "The review's top bar has Play again; Back to game stays in the review" of 2026-10-19).
  - `pod-docs/feature-details/game-over.md`: drop the "Import cycle" Watch-out line (fixed by fix PR #96), and add the entrance.
  - `pod-docs/features.md` rows where this changes them.

**Out of scope:**
- **Motion on other screens,** such as the home page, cards or the review sheet.
- **Sound changes.**
- **Changes to play, the review's grading or the key-moment content.**
- **Dark mode** (`pod-docs/ideas/dark-mode.md`) and **marking his mistakes** (`pod-docs/ideas/mark-bot-mistakes.md`), both still parked.

## Sprint sequence

| Sprint | Goal | Status | Depends on |
|--------|------|--------|------------|
| motion | Material line under the name; game-over entrance; 150 ms piece moves; one-step review playback motion; Play again in the review foot | done | — |

Status values: `planned` / `active` / `done`. The orchestrator only flips its row's Status — it does not rewrite Goal/Depends-on retroactively.

The `Depends on` column is the **only** cross-sprint dependency signal. Wave ordering and per-slice deps live inside the sprint doc and are opaque from here.

## Look
The `ui-refresh` Look with the `ui-polish` change, unchanged: the light scorebook palette and tokens, Quicksand (body 600, bold 700, self-hosted), and the 4/8/12/16/24/32 spacing scale with one card style (`pod-docs/plans/ui-refresh.md` ## Look, `pod-docs/plans/ui-polish.md` ## Look). The new parts:
- **Material line:** a second line under the name, in the existing material style (soft ink "+N", the glyph row), with 4 px between the name line and it. Pieces first, then "+N".
- **Motion:** ease-out curves only; the game-over pause about 300 ms, scrim about 200 ms, card about 250 ms (8 px rise, 96 % → 100 %); pieces about 150 ms.
- **Rules out:** bounces, springs, overshoot, glows, confetti, and motion when the system asks for reduced motion.
- **Draft:** none. The human chose the values in chat; the motion can't be judged from a still page.

## Key decisions
- **Pieces first, then "+N", on a line under the name** (human, accepted). Supersedes the order and place in the 2026-10-19 "+N" layout.
- **A subtle game-over entrance after a short pause, none under reduced motion** (human, accepted option a over a bounce or a king highlight).
- **Pieces move in about 150 ms with an ease-out** (human, accepted).
- **The review animates one-step moves only; jumps snap** (human, accepted).
- **The review's foot has Play again instead of Back to game, and the top bar has none** (human: "It should be the "Play again" button and remove that from the navbar"). Supersedes the 2026-10-19 "The review's top bar has Play again; Back to game stays in the review" default. You can still go back to the game with the browser's Back.
- **Ships in `ui-polish-staging`,** so it goes to `main` with PR #93 (human, accepted).

## Known risks
- **Pieces keep their `layoutId` across moves, so a jump in the review may slide every piece.** Mitigation: a test that a jump of more than one move renders with no layout motion, and a browser check of clicking a far move.
- **A faster piece move may let a quick reply (his move, a premove) start before the last one ends.** Mitigation: check his reply right after a fast click at 150 ms; the last position must always be shown.
- **The game-over pause may hide the card if the game ends and a new game starts within it.** Mitigation: New game during the pause cancels the entrance.
- **Fake-DOM tests can't see motion.** Mitigation: test the timings and the reduced-motion choice as values (props or pure functions), and check the motion in the browser.

## Open questions
- None.

## Verification
- `npm run build && npm test` pass.
- **Material line:** on both cards, the material line is a separate line under the name, the glyphs come before "+N", and at 375 px "+N" is never cut.
- **Game over:** at mate, time and resign, the card and scrim reach full opacity after about 300 + 250 ms and the card's computed transform ends at none or identity; with reduced motion emulated, they show at once. A resize after the end doesn't replay it.
- **Pieces:** a move's piece animation lasts about 150 ms (measured from the transform's start to end), with no spring overshoot.
- **Review:** ▶ and ◀ animate the one move; clicking a move several plies away shows the new position with no piece motion.
- **Review foot:** the foot is Play again, Flip and Sound; the top bar has ← Home and the title only; Play again starts a new game at the same level and color.
- **Feature rows:** every `pod-docs/features.md` browser row passes, updated where this plan changed it on purpose.
- **Look:** both board modes, game over and the review match the Look at 1400, 992 and 375 px, with no horizontal scroll.

## Queue log
- `[2026-10-20 · PENDING · sprint-planner → human · sprint: motion · slice: M1]` Needs your decision: his card already uses its second line for "★ Book · N" or "Thinking…", and three lines don't fit the 56 px card. Value in use: the material and his detail share the second line, material first and the detail at the line's end, so neither moves when the other appears. The other way puts the detail first, which makes the material jump about 70 px each time "Thinking…" comes and goes. **Resolution:** 2026-10-20 — Needs your decision: see `pod-docs/decisions.md` → "His card's detail shares the material line, material first (agent default — override anytime)"
- `[2026-10-20 · PENDING · engineer → human · sprint: motion · slice: M1]` Needs your decision: the second line under the name is always kept, so on a card with no captures and no detail (You, White, Black at the start) the name sits about 12 px above the disc's middle. The other way centers the name until the first capture, then moves it up once. Value in use: the name stays put. **Resolution:** 2026-10-20 — Needs your decision: see `pod-docs/decisions.md` → "The name stays put on a card with no captures (agent default — override anytime)"
- `[2026-10-20 · PENDING · orchestrator → human]` plan ui-motion complete — final PR https://github.com/iamphduc/chess-web/pull/98, review pass, 4 entries from this plan sorted in the hand-back, plus the earlier fix follow-ups. **Resolution:** 2026-10-21 — final PR merged
