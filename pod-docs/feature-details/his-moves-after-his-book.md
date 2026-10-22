# His moves after his book (Stockfish's top lines)

## What it is
Once a vs-Liem game leaves his opening book, he answers with Stockfish lite (single thread, in a Web Worker). Each strength step changes how deep Stockfish searches and how he picks among its top lines. 1400 to 2500 are sparring bots that make about 75 % of the mistakes and blunders real Lichess players make at that rating. The Liem step plays full strength and makes no mistakes on purpose.

## How it works
- `STEP_PROFILES` (`src/game/opponent/step-profiles.ts`) holds one profile per step: the search (depth, `multiPv`, movetime) and the pick rules (`maxLoss`, `temperature`, slip, ahead, `forceMateIn`), plus the band fields `mistakeChance`, `blunderChance`, `blunderMaxCp` and `hangWeight`. Every sparring level asks for 10 lines.
- `chooseHumanMove` (`src/game/opponent/human-move.ts`) runs in this order:
  1. Keep the legal lines.
  2. Play a seen mate within `forceMateIn`.
  3. Drop every line that gets him mated.
  4. Roll for a band, if eligible.
  5. Otherwise take the normal pick.
- **Band roll:** a move is eligible when the chances sum above 0 and the top safe line is under `AHEAD_WIN` (85 win %). Only then does he draw one extra `random()`. `r < blunderChance` picks the blunder band (loss ≥ 30 win %, and under `blunderMaxCp` cp). The next `mistakeChance` of the roll picks the mistake band (20 ≤ loss < 30, under `MAX_DROP_CP`). Weights are `exp(-(loss - least)/10)`, times `hangWeight` for a line that hangs material. An empty band falls back to the normal pick.
- `npm run calibrate -- --measure` checks the table: each level plays itself from his book, and full-strength Stockfish grades it against `scripts/ladder/human-baselines.json`.

## Why it's this way
- **Top lines, not `UCI_Elo`:** see `pod-docs/decisions.md` → "He picks among Stockfish's top lines instead of using `UCI_Elo`".
- **Bands tied to the review's grade levels:** a deliberate mistake is one the review would grade a mistake, so the measured rates mean the same thing as the human rates. Turned down: random moves from outside the top lines, which can look like a queen given away for nothing.
- **No draw when ineligible:** Liem's picks stay the same, draw for draw, so his tests and seeded runs didn't move.
- **75 % of the human rate, ±25 %:** the human's choice, since the baselines are mostly blitz. The table and its 14 runs are in `pod-docs/decisions.md` → "Sparring step table tuned to 75 % of human mistake rates".
- **Never walk into a seen mate, at any level** (a default): doing it on purpose would feel like throwing the game. Real players do miss mates.

## Watch out
- `MISTAKE_LOSS`/`BLUNDER_LOSS` (20/30) must equal `MISTAKE`/`BLUNDER` in `src/game/review/grade.ts`; a test pins it.
- A 30-point loss is always about 330 cp or more, so the mistake band is really 20–27, and `blunderMaxCp` must stay above about 330 or blunders never happen.
- Going up the steps, the chances, `blunderMaxCp` and `hangWeight` must never rise (tested). Because the human targets barely fall from 2100 to 2500, 2300 and 2500 share their chances and differ only by depth.
- Measured rates move about ±10 % between 40-game runs of the same table. Rerun with more games before trusting one cell. The ladder check (8 games a pair) sits near 50 % at 1400 against 1700.
- The bots hang pieces 1.2–2.4× and miss captures 2–5× as often as humans. Neither rate has a target, and `hangWeight` alone barely moves them.
- The review grades his moves after his book too (2026-10-22), so a bot's blunder carries a mark in the review's move list; the graph, counts and key moments stay about your moves.

## History
- 2026-10-12 · human-style-strength · top-lines chooser and the first step table · [report](../reports/human-style-strength.html)
- 2026-10-18 · sparring-ladder · mistake and blunder bands, `multiPv` 10, table tuned to 75 % of human rates · [report](../reports/sparring-ladder.html), [PR #79](https://github.com/iamphduc/liem-sparring/pull/79)
- 2026-10-21 · tidy · the `?? 0` fallbacks on the four band fields are gone from `bandPick` and `profileLine` (the fields are required); slow sampling tests get a 30 s timeout; no behavior change · [report](../reports/tidy.html), [PR #107](https://github.com/iamphduc/liem-sparring/pull/107), [PR #108](https://github.com/iamphduc/liem-sparring/pull/108)
