# Plan: Post-game review against Liem

_Generated: 2026-10-13 · Status: active · Grilled-with: grilling (fast)_

## Goal
After a vs-Liem game ends, the human can open a review that teaches. Stockfish at full strength grades each of the human's moves, the review marks the inaccuracies, mistakes and blunders, and it walks the human through their 3 biggest drops. At each one the human first tries to find the better move, then sees what they played, Stockfish's move and, when the position is in his book, what Liem played.

## Why
The human plays Liem to improve. Today a game just ends, with no feedback. Research: [post-game-review](../research/post-game-review.md). chess.com Game Review and Lichess "Learn from your mistakes" are the closest tools, but neither shows one GM's moves next to the engine's. The research also says that trying the move before the answer is shown is the part that teaches.

Success:
- After any vs-Liem game, a **Review game** button opens the review, and it works for every result (win, loss, draw, time).
- The analysis runs after the game with visible progress, the first key moment is usable before it finishes, and the review works on a phone.
- The marked moves and accuracy follow the public Lichess formulas.
- The human can play through the 3 key moments, trying a move first each time.

Constraints:
- A static GitHub Pages site with no backend.
- Single-thread Stockfish lite WASM in a Web Worker, behind `MoveEngine`.
- GPL-3.0-or-later. Our own rules engine checks every move.

## Scope
**In scope:**
- **Analysis pass:** after the game ends, one full-strength Stockfish search per position in the game (MultiPV 1, a fixed time per position with a depth cap). It reuses his engine worker, which is idle once the game is over, and it reports progress. Starting a new game or leaving the review stops it.
- **Speed check:** before the time per position is fixed, time the lite build on desktop and in phone emulation, and on a real phone if one is at hand. Record the numbers and the chosen value in `docs/decisions.md`.
- **Grading (pure functions):**
  - Win % with the Lichess formula (already in `human-move.ts`; share it, don't copy it).
  - Each human move's drop in win % from the human's side. Inaccuracy ≥ 10, mistake ≥ 20, blunder ≥ 30.
  - Per-move accuracy with the Lichess formula `103.1668*exp(-0.04354*(before-after)) - 3.1669`, clamped to 0–100, and a game accuracy (see Key decisions).
  - Mate scores are handled apart from centipawns, as the chooser does.
- **His book:** a human move whose resulting position is in his book (`lookupBook`, either book) is never flagged. It's marked as a book move: "Still in his book: he faced this in N games". The review shows where the game left his book ("Left his book at move N") and what he played most there.
- **Key moments:** the human's 3 biggest drops that are at least inaccuracies (fewer if fewer exist). For each:
  - **Find the better move:** the board shows the position before the human's move, the answer is hidden, and the human plays a move. A move counts as found if it's Stockfish's best, or if it loses less than 10 win % against the best (an extra search on that move, the same settings). It has **Show answer** and **Skip**.
  - **Reveal:** "You played X · Stockfish: Y · Liem played Z in N games" (the Liem line only when that position is in his book).
- **Review screen:** a board you can step through (first, back, forward, last, and the arrow keys), the move list with grade marks, the win % graph (tap or click a point to jump there), the accuracy, the key-moment card and the "Left his book" note. **Back to game** returns to the finished game, and **New game** works as it does today.
- **Docs:** `docs/features.md` rows, the README, and the new `docs/decisions.md` entries.

**Out of scope:**
- Saving past games or a "Past games" list. Only the game that just ended can be reviewed, and closing or reloading the page loses it. Write `docs/ideas/saved-games.md` for the next plan.
- Reviewing two-player games.
- Analysing during the game.
- Labels like "brilliant", "great" or "best", and a recurring-mistakes report across games.
- Any code from Chesskit (AGPL-3.0). Write our own from the public formulas.
- Changes to the opponent, his book or the strength steps.

## Sprint sequence

| Sprint | Goal | Status | Depends on |
|--------|------|--------|------------|
| game-review | The analysis pass with progress and the speed check, grading, the book check and key moments as pure tested code, then the review screen (A's coach card, B's big graph, C's bottom sheet on phones) with Find the better move | planned | — |

Status values: `planned` / `active` / `done`. The orchestrator only flips its row's Status — it does not rewrite Goal/Depends-on retroactively.

The `Depends on` column is the **only** cross-sprint dependency signal. Wave ordering and per-slice deps live inside the sprint doc and are opaque from here.

## Look
The human's pick: **"A plus the big graph point like B and also I like the idea of having the bottom sheet open like C in mobile view"**, from [the draft](../design-drafts/review-look-directions.html). So: A's coach flow and card, B's large win % graph with its points, and C's bottom sheet for the key-moment card on phones. Everything else keeps the vs-Liem look from [play-like-liem](play-like-liem.md) `## Look`.

- **Thesis:** a coach walks you through three moments, one card at a time, over a big picture of how the game went.
- **Palette:** the existing vs-Liem tokens, plus grade colors. Add the grade colors as tokens in `src/index.css` `:root` (for example `--grade-inaccuracy`).
  - Page `#333333`, card `#1F1F1F`, note `#262626`, line `#474747`, text `#FFFFFF`, soft text `#B8B8B8`.
  - Flag red `#DA251D`: the key-moment card's top edge and the bottom sheet's top edge. It's used for fills and edges only, never for text (3.35:1).
  - Gold `#FFCD00`: the stars for found moves, and a found card's top edge.
  - Olive `#BBBE64`: book moves, the graph's book band, the progress bar, and the waiting card's top edge.
  - Grade colors (text contrast on `#1F1F1F` / `#262626` / `#333333`):

    | Grade | Color | Contrast |
    |---|---|---|
    | Inaccuracy ?! | `#6CB4EE` | 7.38 / 6.77 / 5.66 |
    | Mistake ? | `#FF9F43` | 8.08 / 7.42 / 6.19 |
    | Blunder ?? | `#FF7A70` | 6.49 / 5.96 / 4.98 |
    | Best (Stockfish's move) | `#4CC38A` | 7.44 / 6.83 / 5.70 |
    | Book | olive `#BBBE64` | 8.37 / 7.68 / 6.42 |

  - Grade chips use `#1F1F1F` ink on the grade color. A selected move turns white with `#1F1F1F` ink, because grade text on gray fails contrast.
- **Type:** Quicksand only.
  - Card title: 22 / 700, or 20 / 700 in the bottom sheet.
  - Accuracy number: 28 / 700.
  - Body and moves: 16 / 500.
  - Labels, axis, tooltip and step count: 14–15 / 700. These are secondary, as in the existing Look.
- **Layout:**
  - **Desktop:** the board stays where it is. B's big graph runs full width above the board and sidebar, 150 px tall. The 468 px sidebar holds, top to bottom: the key-moment card ("Key moment 2 of 3", stars, red top edge), the accuracy (28 px number), the move list (book moves 1–N folded into one "In his book" row you can open), and the "Left his book" note. Step buttons sit under the board.
  - **The graph (from B):** win % from the human's side, with a **White / You** switch. It has a card background, an olive band over the book moves, a dashed 50 % line, grade-colored points at the flagged moves, a white line and a white tooltip ("27.Qe2?? −44 %") at the selected move, and move ticks. Tap or click anywhere on it to jump to the nearest move.
  - **Analysing:** the card shows "Analysing move 14 of 38" with an 8 px olive progress bar and an olive top edge. Key moments appear as soon as their moves are analysed.
  - **At 375 px:** everything stacks: the graph (90 px tall, 312 px wide), the board (312 px), the step buttons, the accuracy, the move list, then the "Left his book" note. The key-moment card opens as **C's bottom sheet**: rounded top corners (16 px), a red top edge, a grab bar, a ✕ to close, and a dimmed board behind it (`rgba(0,0,0,.35)`). Tapping a key point on the graph or a flagged move opens it again. During Find the better move the sheet sits low, so the board stays usable.
- **Signature detail:** gold stars for found moves. Each key moment has an empty star, the same gold star that sits next to his name, and it fills when the human finds the move. The review ends on "2 of 3 found".
- **Rules out:** chess.com-style coach characters and "brilliant" icons; a table-heavy analysis screen; browser-default controls; new colors beyond the grade tokens; flag red as text.
- **Draft:** `docs/design-drafts/review-look-directions.html` (A, with B's graph and C's phone sheet).

## Key decisions
- **Only vs-Liem games, and only the game that just ended.** There's nothing to save, so there's no new storage. Saving games is the next idea. (human)
- **The full version: step-through, graph, accuracy, and Find the better move.** The research says trying first is the part that teaches. (human) — [research](../research/post-game-review.md)
- **Analyse after the game, not during it.** The app has one engine worker, shared with his play. After the game it's idle, and a full-strength pass can't slow down his moves. (human)
- **Lichess levels (10/20/30 win-% drop), with every inaccuracy or worse marked, and the 3 biggest drops as key moments.** (human) — [research](../research/post-game-review.md)
- **A move that keeps the game in his book is never flagged.** This is like Lichess's rule for master moves. His book stores only his own moves, so for the human's move the wording is "he faced this in N games", not "Liem played this". (human, wording corrected in the interview)
- **Write our own code from the public Lichess formulas; no Chesskit code** (AGPL-3.0). (default)
- **The time per position comes from the speed check.** Start from about 0.5 s with a depth cap of 18, so a 40-move game (about 80 positions) takes about 40 s. Record the measured value in `docs/decisions.md`. (default)
- **Game accuracy is the plain average of the human's per-move accuracy.** Book moves count as 100. Lichess also mixes in a volatility-weighted mean, which is more work for a small change. (default)
- **A tried move counts as found if it loses less than 10 win %** against Stockfish's best, which is under the inaccuracy level. (default)
- **The graph shows the human's side by default**, with a switch to White's side. (default)
- **His opponents' color doesn't matter for "in his book".** Use `lookupBook` on the position after the human's move, with either book, as the opponent does. (default)

## Known risks
- **The analysis may be slow on phones** (no published numbers for this build). Mitigation: the speed check first, a time cap per position, progress shown, and key moments ready as soon as their moves are analysed.
- **Reusing his worker:** a review search must not overlap with a new game's search. Mitigation: New game and Back to game stop the review search before the opponent starts. If a stop isn't clean, replace the engine (the existing `retry-fresh` path).
- **Short searches give noisy scores,** so a move may be flagged a little wrong. Mitigation: full strength with a depth cap, and Lichess's thresholds, which are loose enough for noise.
- **Mate scores and won positions flatten win %.** Mitigation: handle mates apart from centipawns and reuse the chooser's mate handling.
- **The phone layout is long** (graph, board, list and sheet). Mitigation: the bottom sheet for the card, and the 375 px Look check.

## Open questions
- The time per position is set by the speed check. Value in use: about 0.5 s with a depth cap of 18.
- What the review shows after a very short game (for example, a loss in 10 moves fully in his book, with no flagged moves). Value in use: "No mistakes found", the graph and the book note.

## Verification
- `npm run build && npm test` pass.
- Unit tests, with fixed fake scores, for:
  - win % and per-move accuracy (Lichess formulas, mates included);
  - the 10/20/30 grades;
  - the book check (a move in his book is never flagged);
  - choosing the key moments (the 3 biggest drops at inaccuracy or worse);
  - the found-move rule.
- The speed check's numbers and the chosen time per position are in `docs/decisions.md`.
- In `npm run preview` at `/chess-web/`, after a real vs-Liem game:
  - **Review game** opens the review, with progress while it analyses.
  - The graph, the move list marks, the accuracy and "Left his book at move N" are shown.
  - The 3 key moments can be played: a correct move fills the star, and a wrong one lets the human try again, show the answer, or skip.
  - Back to game and New game work, and no review search runs into his next game.
  - A two-player game has no Review button.
- At desktop and 375 px, the review matches `## Look`: B's graph, A's card and stars, and C's bottom sheet on the phone, with no sideways page scroll.
- The README and `docs/features.md` describe the review.
