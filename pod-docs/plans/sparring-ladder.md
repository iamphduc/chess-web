# Plan: Sparring ladder to Liem

_Generated: 2026-10-17 · Status: active · Grilled-with: grilling (fast)_
<!-- autopilot-run: started=2026-10-18T10:31:18Z sprints=0 waves=2 -->

## Goal
Turn the strength steps into a ladder that builds toward beating GM Le Quang Liem. Levels 1400 to 2500 become sparring bots: each one plays Liem's openings from his real games, then plays at its level with that level's real mistakes. Liem himself is the final boss. The page opens on the vs Liem tab.

## Why
The human's words: this project "is like a place you practice to beat Liem", and "Liem 1400" makes no sense. Liem is the hardest level, and the rest are bots at their true level that learn from him.

The human also said the 1400 step feels "too solid, I don't feel any mistake". A measurement on 2026-10-17 confirmed it:
- **Liem's games:** 50 games at 1400, every move after his book graded at the review's settings.
- **Human games:** 153 analysed Lichess games between players rated 1300–1500.
- **Result:** per 40 moves, he made 0.11 mistakes and 0.05 blunders. Real players made 1.20 and 1.30, and they hung 0.41 pieces per game against his 0.04.
- **Cause:** his loss limit (10 win %) and his slip limit (15) sit below the review's mistake level (20). He picks only from Stockfish's top 4 lines. The hanging-piece filter removes the rest.
- **Raw data:** the scratchpad `measure-1400` folder of the 2026-10-17 session (not in the repo; the plan's measurement tool replaces it).

Success:
- At every sparring level, his mistake and blunder rates per 40 moves, after the book, are about 75 % of real Lichess players at that level, within a stated tolerance. Each level is checked by the measurement tool and the human's own play.
- The levels still rise: each scores 50 % or less against the next one up.
- The Liem level plays as today's Full does.
- He still never walks into a mate he sees, and he still answers quickly on a phone.
- The page opens on vs Liem, and the cards and labels say plainly which level is a sparring bot and which is Liem.

Constraints: a static GitHub Pages site with no backend; single-thread Stockfish lite WASM in a Web Worker; GPL-3.0-or-later; our own rules engine checks every move.

## Scope
**In scope:**
- **Level names and labels:**
  - The steps read 1400, 1700, 1900, 2100, 2300, 2500 and **Liem** (today's `"full"`).
  - A sparring level's card reads "Sparring · 1400" with "Plays Liem's openings".
  - The Liem level's card reads "Le Quang Liem" with "GM · 2732", with no "playing about".
  - The setup card, his card above or below the board, the book note, the README and the docs say the same.
- **Default tab:** the page opens on vs Liem. This replaces the decision "The page opens in Two players".
- **Human baselines per level:**
  - A dev-only script fetches analysed rated games of real Lichess players near each sparring level (rating band ±100, blitz and rapid). It fetches through the public Lichess API, never with personal data, and rate-limits itself.
  - It computes per-40-move rates of inaccuracies, mistakes and blunders (at the review's 10/20/30 and at Lichess's 5/10/15), hung pieces, average win % loss and Lichess accuracy.
  - It commits the numbers as a small data file, with the sample size and date. It runs by hand, never in CI or tests, like `npm run book:import`.
- **Measurement in `npm run calibrate`:**
  - A mode that plays a level against itself from his book and grades the level's moves after the book with full-strength Stockfish (the review's settings and grading code).
  - It prints the same rates next to the level's human baseline and its target (75 %).
- **Mistakes at the true level:**
  - Change the move chooser so each sparring level can make real mistakes and blunders at its target rate: slips that reach the mistake and blunder levels, and, at low levels, moves from outside Stockfish's top lines, hung pieces and missed captures, at a measured rate.
  - Each level's numbers sit in the step table. Higher levels make fewer and smaller mistakes.
  - The Liem level makes none on purpose.
  - Keep, at every level: never walk into a mate he sees; play a seen mate in 2 or less at the higher levels.
- **Review:** it works for every level as today, including "Left his book", since every level plays his openings.
- **Docs:**
  - `pod-docs/decisions.md` entries replacing "The page opens in Two players" and the "1400 step plays like 1400" calibration.
  - The new per-level table and its measured results.
  - `pod-docs/features.md` rows and the README.

**Out of scope:**
- Making the bots copy Liem's style after the book. That needs a model trained on his games; see [opponent-engine-options](../ideas/opponent-engine-options.md).
- Leaving the book earlier at low levels. Every level plays his full book (human's choice).
- A clock choice, new levels, saved games, or changes to the review itself.
- New colors, fonts or screens.

## Sprint sequence

| Sprint | Goal | Status | Depends on |
|--------|------|--------|------------|
| ladder | Human baselines per level, the measurement in `npm run calibrate`, a chooser that makes level-true mistakes with a calibrated table, and the sparring and Liem labels with vs Liem as the default tab | active | — |

Status values: `planned` / `active` / `done`. The orchestrator only flips its row's Status — it does not rewrite Goal/Depends-on retroactively.

The `Depends on` column is the **only** cross-sprint dependency signal. Wave ordering and per-slice deps live inside the sprint doc and are opaque from here.

## Look
The existing vs-Liem look from [play-like-liem](play-like-liem.md) `## Look`, with no new colors or fonts. The human asked to keep it.
- **Sparring card:** in the place of his photo, a ♞ knight glyph on the card color (`#1F1F1F`) in the avatar's size. The name line reads "Sparring · 1400" in body text, and the detail line reads "Plays Liem's openings" in soft text `#B8B8B8`. There's no gold star and no "GM" badge; those stay Liem's. On phones (below 768 px) the detail can shorten to "Liem's openings". (default)
- **Liem card:** as today: his photo, the GM badge, gold star, "GM · 2732".
- **Setup card:** it stays Liem's challenge card. The last step reads "Liem" in gold with the star, and the 1400–2500 steps keep today's style. The line under the steps names what the picked level is: for example, "A sparring bot plays his openings, then Stockfish at about 1400." and "Le Quang Liem: his openings, then full-strength Stockfish 18." (default)
- **Rules out:** new colors, a new screen, robot or cartoon art.

## Key decisions
- **Liem is the final boss; the lower levels are sparring bots that play his openings.** The project is practice for beating Liem. (human, 2026-10-17)
- **Every level plays his full book.** Practising his lines is the point. (human)
- **Bots make about 75 % of real players' mistake rate at their level.** The real games are mostly blitz, where time pressure adds mistakes, and a 10-minute game should be a bit cleaner. (human, on the agent's recommendation)
- **Baselines come from real analysed Lichess games per level,** fetched by a dev-only script and committed as numbers. They're graded with the same formulas as the review. The 2026-10-17 measurement showed our formulas match Lichess's own counts and accuracy on the same games. (default)
- **The Liem level is today's Full,** with its label changed to "Le Quang Liem · GM 2732". (human)
- **The page opens on vs Liem,** replacing the "page opens in Two players" decision. (human)
- **Sparring card:** a ♞ glyph, "Sparring · N", "Plays Liem's openings". (default — the human can change the words or the glyph)
- **Keep the never-walk-into-a-seen-mate rule at every level.** Real players do miss mates, but walking into a mate he sees on purpose would feel like throwing the game. (default)

## Known risks
- **Mistakes that look random, not human.** A blunder picked from outside the top lines can look silly, like giving away the queen for nothing. Mitigation: make most deliberate mistakes ones that a shallower search would also make, with deeper blunders rarer. Then check them with the review and the human's play.
- **Too weak.** At 75 % of the human mistake rate, 1400 may feel easy. Mitigation: the target is a table value, so the human can move it.
- **Baselines lean on blitz,** and on games someone asked to have analysed. Mitigation: prefer rapid where the sample allows, and state the sample.
- **The Lichess API is rate-limited or changes.** Mitigation: a dev-only script, one request at a time, committed numbers so the app never depends on it.
- **The ladder may stop rising** after the mistakes are added. Mitigation: the calibrate ladder check (each level ≤ 50 % against the next).

## Open questions
- The tolerance for "about 75 %": value in use ±25 % of the target per rate, with more samples where it's close.
- Whether 2300 and 2500 baselines have enough analysed games on Lichess: value in use, widen the rating band to ±150 if a level has under 30 games.

## Verification
- `npm run build && npm test` pass.
- `npm run calibrate` in the new measurement mode prints, for each sparring level, the rates per 40 moves next to the human baseline and the 75 % target. Each rate is within the tolerance, and the results are in `pod-docs/decisions.md`.
- The ladder still rises (each level ≤ 50 % against the next), and the Liem level still plays Stockfish's best almost every move.
- Unit tests on the chooser, with fixed fake lines, show each level's mistake and blunder chances, and show that he never walks into a seen mate at any level.
- In `npm run preview` at `/chess-web/`:
  - The page opens on vs Liem.
  - A 1400 game shows "Sparring · 1400" and "Plays Liem's openings" with the ♞, and a Liem game shows his photo and "GM · 2732".
  - His book moves still come first, and the review works after a sparring game.
- The Look holds at desktop and 375 px, and two-player mode is unchanged.
