# Sprint: Sparring ladder to Liem

_From plan: pod-docs/plans/sparring-ladder.md · Slug: ladder · Status: active · Generated: 2026-10-18_
<!-- autopilot-run: started=2026-10-18T10:31:18Z sprints=0 waves=3 -->

## Status board

| Wave | Slice | Title | Branch | PR | Status | Confidence | Depends on |
|------|-------|-------|--------|----|--------|------------|------------|
| 1 | L1 | Look: sparring avatar style and token checks | ladder-L1 | #76 | merged | medium | — |
| 1 | H1 | Human baselines: rates module, `npm run baseline`, committed numbers | ladder-H1 | #76 | merged | medium | — |
| 1 | C1 | Chooser: mistake and blunder bands, new profile fields at zero | ladder-C1 | #76 | merged | medium | — |
| 2 | U1 | Sparring and Liem labels, page opens on vs Liem | ladder-U1 | #77 | merged | medium | L1 |
| 2 | M1 | `npm run calibrate -- --measure`: self-play from his book, graded | ladder-M1 | #77 | merged | high | H1, C1 |
| 3 | T1 | Tune the step table to 75 % of human rates; docs and results | ladder-T1 | — | done | medium | C1, H1, M1 |

## Shared contract

**Levels.** `STRENGTH_STEPS` and `StrengthStep` stay as they are, `"full"` included. `"full"` is shown as **Liem** everywhere a person reads it. 1400–2500 are **sparring levels**. Every level plays his full book first (unchanged).

**Grading (one formula, one place).** `gradeMove` in `src/game/review/grade.ts` takes an optional third argument `levels: readonly [number, number, number]`, default `[INACCURACY, MISTAKE, BLUNDER]` (10/20/30). `LICHESS_LEVELS = [5, 10, 15]` is exported next to it. The mate rules are the same at every level set. Review behavior is unchanged. No other file grades a move or computes win %. They import `gradeMove` / `winPercent`.

**Rates module** `scripts/ladder/rates.ts` (built by H1, used by M1 and T1):
- `Score` is `{ cp } | { mate }` from the side to move's view (as `EngineLine`).
- `GradedGame`: `{ uci: string[]; evals: Score[] /* length uci.length + 1, evals[i] before ply i */; graded: boolean[] /* per ply */; sides: ("white"|"black")[] }`.
- `measureGames(games: GradedGame[], opts?: { accuracy?: (game, side) => number | null }) → LevelRates`:
  - `games`, `sides`, `gradedMoves`.
  - `per40.review` and `per40.lichess`, each `{ inaccuracy, mistake, blunder }`, computed as count / gradedMoves × 40.
  - `per40.hung` and `per40.missedCapture`.
  - `avgLoss`: mean win % drop per graded move.
  - `accuracy`: mean per side, or `null` when `opts.accuracy` is absent or every value is null.
  - With zero graded moves, every rate is `null`. That is not an error.
- **Hung piece:** a graded move with `isHanging(materialNet(state, move))` (`src/game/opponent/material.ts`) and a cp loss ≥ 150. **Missed capture:** the best legal capture has `materialNet` ≥ 2, the played move's net ≤ best − 2, and the cp loss ≥ 100. For cp loss, a mate counts as ±1000 and cp is clamped to ±1000, both from the mover's view.
- `TARGET_SHARE = 0.75` and `TOLERANCE = 0.25`. `targetFor(human) = human × 0.75`. `withinTarget(bot, human)` is true when `|bot − t| ≤ 0.25 × t`, and the bounds count as within. When t = 0, only bot = 0 is within. A `null` on either side is not within.

**Baseline file** `scripts/ladder/human-baselines.json` (written by `npm run baseline`, committed):
`{ format: 1, generated: "YYYY-MM-DD", source: string, skipPlies: number, levels: { "1400" | "1700" | "1900" | "2100" | "2300" | "2500": { ratingMin, ratingMax, games, droppedGames, speeds: { blitz, rapid }, lowSample: boolean, rates: LevelRates } } }`
- `lowSample` is true when fewer than 30 games were kept even at ±150.
- `rates.accuracy` is the mean of Lichess's own per-player `accuracy` field.
- The file holds no usernames, game ids, dates of games or moves. A missing level means no baseline.

**StepProfile additions** (`src/game/opponent/step-profiles.ts`; C1 adds them at 0 and T1 sets the values):
- `mistakeChance`, 0–1.
- `blunderChance`, 0–1. The sum with `mistakeChance` is ≤ 1.
- `blunderMaxCp`, cp ≥ 0.
- `hangWeight`, 0–1.
- `search.multiPv` may now be 1–10. `MAX_MULTIPV` in `uci-engine.ts` becomes 10.

**Chooser rules** (`chooseHumanMove`):
- The existing steps run in their current order: legal lines, then a seen mate within `forceMateIn`, then never a line that gets him mated.
- **Eligible:** `mistakeChance + blunderChance > 0` and the top safe line's win % < `AHEAD_WIN`. Only then is exactly one extra `random()` drawn, before any other draw. An ineligible move draws exactly as today, so Liem's picks are unchanged draw for draw.
- **Roll:** `r < blunderChance` picks the blunder band. `r < blunderChance + mistakeChance` picks the mistake band. Anything else takes the normal path, today's steps 4–8.
- **Loss** is measured in win % from the top safe line, before the hang and free-capture filters.
  - **Mistake band:** 20 ≤ loss < 30 and cp drop < `MAX_DROP_CP`.
  - **Blunder band:** loss ≥ 30, plus cp drop < `blunderMaxCp` when both scores are cp.
  - `MISTAKE_LOSS = 20` and `BLUNDER_LOSS = 30` must equal `MISTAKE` / `BLUNDER` in `grade.ts`.
- **Band pick:** weight `exp(−(loss − least)/10)`, times `hangWeight` for a line that hangs material. In a band the free-capture rule doesn't apply, so a missed capture is allowed. A mated line is never in a band.
- An empty band, or one with all weights at 0, falls to the normal path with no further band draw.

**Measure mode output** (M1 prints it, T1 reads it): per level, each rate as bot | human | target | ok. `ok` (`yes`/`no`/`-`) is shown for `review.mistake` and `review.blunder` only. These two are the success criteria.

**CSS** (L1 owns `src/styles/liem.css` and `src/index.css`; no other slice edits them): `.liem-sparring-avatar` is the ♞ avatar.

## Per-slice detail

### L1: Look: sparring avatar style and token checks
- **Scope:**
  - Add `.liem-sparring-avatar` to `src/styles/liem.css`. It is the 40 × 40 avatar box with a centred ♞ in `var(--liem-text)` on `var(--liem-card)`.
  - Add no new tokens, colors or fonts (plan `## Look`, "Rules out"). Nothing else changes in the theme.
- **Files owned:** `src/styles/liem.css`, `src/index.css`, `tests/ladder-look.test.ts` (new)
- **Success criteria:**
  - `[test] --liem-card is #1F1F1F, --liem-text #FFFFFF, --liem-text-soft #B8B8B8, --liem-gold #FFCD00 — tests/ladder-look.test.ts › token values`
  - `[test] soft text, white text and gold on --liem-card are each ≥ 4.5:1 — tests/ladder-look.test.ts › text contrast on the card`
  - `[test] :root declares no token beyond today's set — tests/ladder-look.test.ts › no new tokens`
  - `[test] .liem-sparring-avatar is 40×40, uses only var(--liem-*) colors, no image — tests/ladder-look.test.ts › sparring avatar style`
  - `[test] Quicksand comes from src/assets/fonts and no CSS under src/ names http(s) — tests/ladder-look.test.ts › fonts served from the app`
- **Depends on:** —
- **One-way door:** none
- **Model:** opus

### H1: Human baselines: rates module, `npm run baseline`, committed numbers
- **Scope:**
  - Build `scripts/ladder/rates.ts` per the contract, and the `gradeMove` levels argument in `grade.ts`.
  - Build `npm run baseline` (`tsx scripts/ladder/baseline.ts`), a dev-only script. It never runs in tests or CI, and its tests use fixture NDJSON and an injected `fetch` only. For each sparring level it:
    1. Collects candidate players from the results of recent finished blitz and rapid Lichess arenas, then fetches their rated, analysed (`analysed=true&evals=true&accuracy=true`), standard blitz and rapid games.
    2. Keeps only games where **both** players are within ±100 of the level. When fewer than 30 games are kept, it widens to ±150. Rapid games come first, then blitz fills up to `--games` (default 150).
    3. Grades each kept game from ply `--skip-plies` (default 10). Lichess analysis gives the eval after each ply from White's view. A game with an eval missing before its last ply is dropped and counted.
  - Requests reuse `fetchText` from `scripts/book/sources.ts` (no edit to it). The script sends one request at a time, waits at least 1.5 s between requests, never sends a token or cookie, and caches raw downloads in the git-ignored `games/baseline-cache/`.
  - `chess.js` is used only under `scripts/`.
  - Run it once by hand (time budget about 60 min, in the background with a log). Commit `human-baselines.json`, and paste the run's summary lines into the PR body.
  - Document it in `pod-docs/codebase-structure.md`: `scripts/ladder/` in Layout, and a `## Human baselines` section (flags, output, cache, time, never in CI).
- **Files owned:**
  - **Scripts:** `scripts/ladder/rates.ts` (new), `scripts/ladder/lichess.ts` (new), `scripts/ladder/baseline.ts` (new), `scripts/ladder/human-baselines.json` (new)
  - **Tests:** `scripts/ladder/__tests__/rates.test.ts` (new), `scripts/ladder/__tests__/lichess.test.ts` (new), `scripts/ladder/__tests__/baseline.test.ts` (new), `src/game/review/__tests__/grade.test.ts`
  - **Other:** `src/game/review/grade.ts`, `package.json`, `pod-docs/codebase-structure.md`
- **Success criteria:**
  - `[test] gradeMove with no levels grades as today; with LICHESS_LEVELS a 12-point drop is a mistake and the mate rules match — src/game/review/__tests__/grade.test.ts › grade levels argument`
  - `[test] per-40 counts at both level sets, avgLoss, only graded plies count — scripts/ladder/__tests__/rates.test.ts › per-40 rates`
  - `[test] a hung piece needs net ≤ -2 and cp loss ≥ 150 (149 is not); mate scores clamp to ±1000 — scripts/ladder/__tests__/rates.test.ts › hung pieces`
  - `[test] missed capture at best net 2 / played 0 / cp loss 100 counts, 99 doesn't — scripts/ladder/__tests__/rates.test.ts › missed captures`
  - `[test] zero graded moves give null rates; no accuracy fn gives accuracy null — scripts/ladder/__tests__/rates.test.ts › empty and missing inputs`
  - `[test] withinTarget at exactly ±25 % is true, just outside false, t = 0 only bot 0, null false — scripts/ladder/__tests__/rates.test.ts › target and tolerance`
  - `[test] a game is kept only when both ratings are inside the band (edges inclusive); 29 kept widens to ±150; under 30 at ±150 sets lowSample — scripts/ladder/__tests__/lichess.test.ts › rating band`
  - `[test] Lichess White-view evals after each ply become side-to-move evals before each ply; a missing eval drops the game — scripts/ladder/__tests__/lichess.test.ts › eval conversion`
  - `[test] requests go one at a time with ≥ 1.5 s between, 429 waits and retries, no auth header — scripts/ladder/__tests__/lichess.test.ts › polite fetching`
  - `[test] the written file has exactly the contract's keys and no username, game id or move — scripts/ladder/__tests__/baseline.test.ts › file shape has no personal data`
  - `[test] the committed human-baselines.json parses to the contract, each level has games > 0 and gradedMoves > 0 — scripts/ladder/__tests__/baseline.test.ts › committed baselines`
- **Depends on:** —
- **One-way door:** none (it reads the public Lichess API by hand. The committed numbers can be regenerated or deleted.)
- **Model:** opus

### C1: Chooser: mistake and blunder bands, new profile fields at zero
- **Scope:**
  - Add the contract's StepProfile fields and chooser rules.
  - Set every level's new fields to 0 and leave `multiPv` as is, so play is unchanged until T1.
  - Raise `MAX_MULTIPV` to 10.
  - Keep every existing `human-move.test.ts` test passing unchanged.
  - Add a table-driven test file that reads `STEP_PROFILES`, so it holds for whatever values T1 sets.
  - Don't touch `opponent.ts` behavior.
- **Files owned:**
  - **Code:** `src/game/opponent/human-move.ts`, `src/game/opponent/step-profiles.ts`, `src/game/opponent/engine/uci-engine.ts`
  - **Tests:** `src/game/opponent/__tests__/human-move.test.ts`, `src/game/opponent/__tests__/chooser-rates.test.ts` (new), `src/game/opponent/__tests__/step-profiles.test.ts`, `src/game/opponent/engine/__tests__/uci-engine.test.ts`
- **Success criteria:**
  - `[test] mistake roll picks only from 20 ≤ loss < 30 (20 in, 30 out) — src/game/opponent/__tests__/human-move.test.ts › mistake band`
  - `[test] blunder roll picks only loss ≥ 30 with cp drop < blunderMaxCp — src/game/opponent/__tests__/human-move.test.ts › blunder band`
  - `[test] an empty band falls to the normal pick — src/game/opponent/__tests__/human-move.test.ts › empty band`
  - `[test] a seen mate within forceMateIn is played before any roll — src/game/opponent/__tests__/human-move.test.ts › mate before roll`
  - `[test] a line scored as mate against him is never picked on any roll — src/game/opponent/__tests__/human-move.test.ts › band never walks into mate`
  - `[test] well ahead or zero chances: no extra random() draw, same pick as before — src/game/opponent/__tests__/human-move.test.ts › no roll draws nothing`
  - `[test] hangWeight 0 never picks a hanging band line, 1 weighs it like others — src/game/opponent/__tests__/human-move.test.ts › hang weight`
  - `[test] a band pick may skip a free capture — src/game/opponent/__tests__/human-move.test.ts › band skips free capture`
  - `[test] MISTAKE_LOSS/BLUNDER_LOSS equal grade.ts MISTAKE/BLUNDER — src/game/opponent/__tests__/human-move.test.ts › band edges match the review`
  - `[test] over 10,000 seeded picks on fixed fake lines with a line in each band, each level's mistake and blunder share is within ±0.015 of its chances — src/game/opponent/__tests__/chooser-rates.test.ts › each level's chances`
  - `[test] at every level, on fixed fake lines with a mated line, the mated line is picked 0 times in 10,000 — src/game/opponent/__tests__/chooser-rates.test.ts › never walks into a seen mate at any level`
  - `[test] the Liem level picks the top line every time — src/game/opponent/__tests__/chooser-rates.test.ts › Liem plays the best line`
  - `[test] new fields in bounds; multiPv 1–10; movetimeMs ≤ 1000 — src/game/opponent/__tests__/step-profiles.test.ts › every step has a profile within the bounds`
  - `[test] uci engine accepts multiPv 10, rejects 11 — src/game/opponent/engine/__tests__/uci-engine.test.ts › accepts the bounds: depth 1 and 30, multiPv 1 and 10`
- **Depends on:** —
- **One-way door:** none
- **Model:** opus

### U1: Sparring and Liem labels, page opens on vs Liem
- **Scope:**
  - **Default tab:** the page opens on vs Liem with the setup card open: `match.mode` starts as `"liem"` with `setupOpen: true`, and it isn't saved. Nothing loads Stockfish or a book before Start game. Two players works as before after one tab click.
  - **Labels:** add a pure `src/features/liem/levelView.ts` that gives each step's card name, detail, short detail, setup-card value, step `aria-label`, setup engine line and out-of-book text. Components read only from it. Follow plan `## Look` exactly:
    - **Sparring card:** ♞ avatar (`.liem-sparring-avatar`), name "Sparring · 1400", detail "Plays Liem's openings", which shortens to "Liem's openings" below 768 px. No GM tag and no star.
    - **Liem card:** his photo, GM tag and star, with detail "GM · 2732" and no "playing about".
    - **Badge:** "★ Book · N", the Stockfish pill and "Thinking…" stay on both cards. Long lines end in an ellipsis per the 2026-10-11 decision, and screen readers get the full text.
    - **Setup card:** it stays "Challenge Le Quang Liem".
      - Sparring steps read "about N", and their `aria-label` is "N".
      - The Liem step reads "★ Liem" in gold with no "about", and its `aria-label` is "Liem (2732)".
      - The engine line reads "A sparring bot plays his openings, then Stockfish at about N." or "Le Quang Liem: his openings, then full-strength Stockfish 18."
    - **Out-of-book note:** "Stockfish at about N plays from here. It isn't trained on his games." For the Liem level: "Full-strength Stockfish 18 plays from here. It isn't trained on his games."
  - `Player` takes an optional glyph avatar in place of the image. Image avatars are unchanged.
  - Use only existing tokens and L1's class, and follow the Look.
  - **Tests:** update any listed test that relied on the Two players default or the old text. Have it switch mode explicitly; don't weaken it.
  - **Queue fold-in** (2026-10-16 W1 PENDING): add `review: reviewSlice.reducer` to `board-flip.test.tsx`'s store and drop the `state.review ?? initial` fallback in `useGameReview.ts`.
  - **Docs:**
    - `decisions.md`: a new entry that replaces "The page opens in Two players" (mark the old one superseded), and the labels.
    - `README.md`: vs Liem becomes the ladder, with sparring levels and Liem as the final boss.
    - `codebase-structure.md`: Layout, and the smoke recipe's "What you see", Two players and vs Liem steps (opens on vs Liem, Two players needs a click, the new texts).
- **Files owned:**
  - **Liem feature:**
    - **Code:** `src/features/liem/levelView.ts` (new), `src/features/liem/matchSlice.ts`
    - **Components:** `src/features/liem/components/SetupCard.tsx`, `SetupCard.css`, `LiemCardDetail.tsx`, `BookNote.tsx`, `BookNote.css`
    - **Tests:** `src/features/liem/__tests__/level-view.test.ts` (new), `match-slice.test.ts`, `liem-actions.test.ts`, `setup-card.test.tsx`, `book-note-render.test.tsx`, `liem-turn.test.ts`
  - **Board:**
    - **Code:** `src/features/board/Board.tsx`, `Board.css`, `components/Player.tsx`, `components/Player.css`
    - **Tests:** `src/features/board/__tests__/board-modes.test.tsx`, `board-flip.test.tsx`, `board-new-position.test.tsx`, `sound-button.test.tsx`, `promotion-clock.test.tsx`, `game-end-stop.test.tsx`, `player.test.tsx`, `square.test.tsx`, `opponent-move.test.ts`
  - **Review:** `src/features/review/useGameReview.ts`, `src/features/review/__tests__/board-review.test.tsx`, `review-actions.test.ts`
  - **Root tests:** `tests/liem-theme.test.ts`, `tests/setup-card-css.test.ts`
  - **Docs:** `README.md`, `pod-docs/decisions.md`, `pod-docs/codebase-structure.md`
- **Success criteria:**
  - `[test] the store starts with mode "liem", setupOpen true, White, 2100 — src/features/liem/__tests__/match-slice.test.ts › opens on vs Liem`
  - `[test] no request to him on page load: liemTurn is null while the card is open — src/features/liem/__tests__/liem-turn.test.ts › no request on page load`
  - `[test] color pick and strength survive Two players → vs Liem and New game; reset clears the game, not the picks — src/features/liem/__tests__/liem-actions.test.ts › picks survive switches and new games`
  - `[test] each sparring step's name, detail, short detail, value, aria-label, engine line and out text, and the Liem step's — src/features/liem/__tests__/level-view.test.ts › texts per level`
  - `[test] a 1400 card renders ♞, "Sparring · 1400", "Plays Liem's openings", no GM tag, no img; the Liem card renders his img, GM and "GM · 2732" — src/features/board/__tests__/board-modes.test.tsx › sparring and Liem cards`
  - `[test] the badge, Stockfish pill and Thinking… still show on a sparring card — src/features/liem/__tests__/book-note-render.test.tsx › badge on a sparring card`
  - `[test] Liem step shows ★ Liem and aria-label "Liem (2732)"; engine line per level — src/features/liem/__tests__/setup-card.test.tsx › setup card per level`
  - `[test] below 768 px the sparring detail reads "Liem's openings" and the full text stays for screen readers — tests/liem-theme.test.ts › sparring detail on phones`
  - `[test] Two players after one tab click renders the old layout with Play and Reset — src/features/board/__tests__/board-modes.test.tsx › two players unchanged after the switch`
  - `[test] Review game is offered after a finished 1400 game and the review builds with "Left his book" — src/features/review/__tests__/review-actions.test.ts › review after a sparring game`
  - `[test] Player with an image avatar renders as before — src/features/board/__tests__/player.test.tsx › image avatar unchanged`
  - `[manual] Look at desktop (1400 px) and 375 px in npm run preview (chrome-devtools-axi): the page opens on vs Liem with the card over the dimmed board; at 1400 his card shows ♞ / "Sparring · 1400" / soft "Plays Liem's openings" with no star or GM; Liem shows photo, GM, star, "GM · 2732"; "★ Liem" is gold on the last step; .squares top is the same in both tabs; nothing overflows at 375 px`
- **Depends on:** L1
- **One-way door:** none
- **Model:** opus

### M1: `npm run calibrate -- --measure`: self-play from his book, graded
- **Scope:**
  - Add a measure mode to `scripts/calibrate/`. Flags:
    - `--measure`
    - `--steps` (default the six sparring steps; `full` is allowed and prints no target)
    - `--games N` per level (default 20; any whole number ≥ 1)
    - `--seed`, `--jobs`
    - `--anchors` and `--anchor-elos` are rejected in this mode with a message.
  - **Games:** each one is the level against itself through `createOpponent`. It uses his committed books (read with `fs` + `parseBook`) and a 10+0 clock, as the app does, with a seeded random per side.
  - **A game ends** on checkmate or stalemate (our rules engine), at 200 plies, or by resignation. A side resigns after 3 of its own engine moves in a row whose top line is ≤ −1000 cp or a mate against.
  - **Grading:** only plies chosen by the engine are graded (`source: "engine"`), for both sides. Book plies are never graded.
    - One separate full-strength Stockfish process per game grades every position at `REVIEW_LIMITS` (`src/features/review/reviewLimits.ts`). Terminal positions use `terminalEval`.
    - If the grader fails, the game is listed as an error and not counted.
  - **Rates and comparison:**
    - Rates come from `measureGames`. The comparison is against `human-baselines.json` through `targetFor` and `withinTarget`.
    - A missing file or level prints "-" with a note naming `npm run baseline`, and the run exits 0.
  - **Accuracy column:** if `src/game/review/game-accuracy.ts` exists on the branch, pass its game-accuracy function as `opts.accuracy` through a small loader `scripts/calibrate/accuracy.ts`. The loader checks that the file exists and uses a dynamic import, with the check injected for tests. Never copy the formula. If the file is absent, omit the column and add a queue PENDING for T1.
  - **Per-level output:**
    - The step's profile line, including the new fields.
    - Games, errors, average book plies, graded moves, and average and max ms per move.
    - The rate table in the contract's shape.
    - The 3 biggest graded drops, each as FEN + move + drop, for eyeballing.
  - The existing modes and their output are unchanged.
  - Write no docs. T1 runs this mode and documents it with the real times.
- **Files owned:**
  - **Code:** `scripts/calibrate/calibrate.ts`, `scripts/calibrate/measure.ts` (new), `scripts/calibrate/accuracy.ts` (new)
  - **Tests:** `scripts/calibrate/__tests__/measure.test.ts` (new), `scripts/calibrate/__tests__/cli.test.ts`
- **Success criteria:**
  - `[test] --measure parses steps, games, seed, jobs; rejects --anchors with --measure; old flags parse as before — scripts/calibrate/__tests__/cli.test.ts › measure flags`
  - `[test] with fake players and a fake grader, book plies are never graded and engine plies of both sides are — scripts/calibrate/__tests__/measure.test.ts › grades only engine plies`
  - `[test] resign after the 3rd consecutive own top line ≤ -1000 or mated; a better line in between resets the count; -999 never counts — scripts/calibrate/__tests__/measure.test.ts › resignation`
  - `[test] a game hits the 200-ply cap as a draw and still counts its graded plies — scripts/calibrate/__tests__/measure.test.ts › ply cap`
  - `[test] a grader failure lists the game as an error and leaves it out of the rates — scripts/calibrate/__tests__/measure.test.ts › grader failure`
  - `[test] the table shows bot, human, target and ok for mistake and blunder; a missing baseline prints "-" and exit 0 — scripts/calibrate/__tests__/measure.test.ts › table against baseline`
  - `[test] accuracy loader returns null when the file is missing and the column is omitted — scripts/calibrate/__tests__/measure.test.ts › accuracy column is optional`
  - `[manual] npm run calibrate -- --measure --steps 1400 --games 2 --jobs 2 finishes and prints the table (paste output in the PR)`
- **Depends on:** H1, C1
- **One-way door:** none
- **Model:** opus

### T1: Tune the step table to 75 % of human rates; docs and results
- **Scope:**
  - **Values:** set every sparring level's `mistakeChance`, `blunderChance`, `blunderMaxCp`, `hangWeight` and, where a band is too often empty, `multiPv` (≤ 10) and the existing fields.
    - **Goal:** each level's `review.mistake` and `review.blunder` per 40 are within tolerance of 75 % of its human baseline.
    - **Rising order:** higher levels make fewer and smaller mistakes. Going up, the chances, `blunderMaxCp` and `hangWeight` never rise.
    - **Liem level:** stays exactly as today.
    - **Mates:** keep `forceMateIn` ≥ 2 at 1900 and up, and ≥ 1 below.
  - **Runs**, each in the background with a log:
    1. Per level: `npm run calibrate -- --measure --steps N --games 20` (about 5–10 min each). Repeat with more games where a rate is close.
    2. Confirm with `npm run calibrate -- --measure --steps 1400,1700,1900,2100,2300,2500,full --games 40` (about 90 min).
    3. Check the ladder with `npm run calibrate -- --games 8 --anchors none` (about 6 min).
    - **Total budget:** 5 hours of runs.
    - If a level can't be brought into tolerance within budget, keep the closest table, record it, and add a queue PENDING to the human.
  - **Accuracy:** if `game-accuracy.ts` has landed and M1 left the accuracy column out, wire it through `scripts/calibrate/accuracy.ts`.
  - **Docs:**
    - `decisions.md`: a new entry with the table, the baseline sample per level (games, band, speeds, date), each run's flags, results and time, and the ladder scores. Mark "The 1400 step plays like 1400" and the 2026-10-12 table entry superseded.
    - `codebase-structure.md`: the `human-move.ts` and `step-profiles.ts` descriptions, and the measure mode in `## Calibrating the strength steps` (flags, output, time, never in CI).
- **Files owned:**
  - **Code:** `src/game/opponent/step-profiles.ts`, `scripts/calibrate/accuracy.ts`
  - **Tests:** `src/game/opponent/__tests__/step-profiles.test.ts`, `src/game/opponent/__tests__/chooser-rates.test.ts`, `scripts/calibrate/__tests__/measure.test.ts`
  - **Docs:** `pod-docs/decisions.md`, `pod-docs/codebase-structure.md`
- **Success criteria:**
  - `[test] every sparring level has mistakeChance > 0 and blunderChance > 0; Liem's new fields are 0 and its other values unchanged — src/game/opponent/__tests__/step-profiles.test.ts › sparring levels make mistakes, Liem doesn't`
  - `[test] going up the steps, mistakeChance, blunderChance, blunderMaxCp and hangWeight never rise — src/game/opponent/__tests__/step-profiles.test.ts › stronger steps never search shallower or allow bigger losses`
  - `[test] forceMateIn ≥ 2 from 1900 up, ≥ 1 below — src/game/opponent/__tests__/step-profiles.test.ts › mate and slip rules per step`
  - `[test] chooser-rates tests still pass on the tuned table — src/game/opponent/__tests__/chooser-rates.test.ts › each level's chances`
  - `[manual] the confirming measure run shows ok = yes for review.mistake and review.blunder at all six sparring levels (or the PENDING above), with full showing ≈ 0 mistakes; recorded in decisions.md`
  - `[manual] the ladder run shows each level ≤ 50 % against the next up; average ms per move ≤ each level's movetimeMs; recorded in decisions.md`
  - `[manual] the printed biggest drops per level look like human errors (missed tactics, a loose piece), not a queen given for nothing; play one 1400 game in npm run dev and see at least one real mistake graded in the review`
- **Depends on:** C1, H1, M1
- **One-way door:** none
- **Model:** opus
