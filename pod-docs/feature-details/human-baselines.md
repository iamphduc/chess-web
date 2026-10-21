# Human baselines (dev only)

## What it is
`npm run baseline` measures how often real Lichess players near each sparring level (1400 to 2500) make inaccuracies, mistakes and blunders. It writes the numbers to `scripts/ladder/human-baselines.json`, which is committed. The measure mode (`npm run calibrate -- --measure`) compares each bot against these numbers. The script runs by hand only, never in tests or CI.

## How it works
- **Sourcing:** it reads recent finished blitz and rapid arenas, takes their players, and fetches each player's rated, analysed games (`analysed=true&evals=true&accuracy=true`). Where arenas have too few players near a level, it also reads those players' opponents within ±150.
- **Filtering:** it keeps a game only when **both** players are within ±100 of the level. If fewer than 30 games are kept, it widens to ±150. Rapid games come first, then blitz fills up to `--games` (150).
- **Grading:** Lichess gives White-view evals after each ply. These become side-to-move evals before each ply. Plies from 10 on are graded with the review's own `gradeMove`, at the review's 10/20/30 levels and Lichess's 5/10/15. A game missing an eval is dropped and counted.
- **Rates:** `measureGames` in `scripts/ladder/rates.ts` counts per 40 graded moves, plus hung pieces, missed captures, average win % loss and Lichess's own accuracy. The same module serves the measure mode, so both sides are counted the same way.
- **Politeness:** one request at a time, at least 1.5 s apart. It waits and retries on 429 and never sends a token or cookie. Raw downloads are cached in the git-ignored `games/baseline-cache/`. The 2026-10-18 run took about 14 min for 900 games.

## Why it's this way
- **Real analysed games, not guesses:** the 2026-10-17 measurement showed the review's formulas match Lichess's own counts on the same games. Turned down: hand-picked rates.
- **Committed numbers, fetched by hand:** the app and tests never depend on the Lichess API, which is rate-limited and may change. The cost is that the numbers age until someone reruns the script.
- **Both players in the band:** a game between mismatched players skews the rates.
- **Opponents at 2300 and 2500:** recent arenas had 7 and 1 players there. It's a default: `pod-docs/decisions.md` → "2300 and 2500 baselines include arena players' opponents".

## Watch out
- The file holds no usernames, game ids, game dates or moves, and a test checks its shape. Keep it that way.
- **`--levels N` merges into the file:** the levels it measured are replaced, the others stay, in ascending order. A run with no `--levels` writes the whole file. A missing or unreadable file starts empty. A level with no games kept leaves its old entry. The header (`generated`, `skipPlies`) comes from the latest run, so mixing `--skip-plies` values across partial runs gives levels graded differently; rerun all levels after changing it.
- The rates are mostly blitz (rapid is 47/23/9/19/7/2 of 150, from 1400 up to 2500), so they carry time-pressure mistakes. The 75 % target allows for some of that.
- `chess.js` is used only under `scripts/`, never in the app.

## History
- 2026-10-20 · fix · `--levels` merges into the saved file instead of replacing it
- 2026-10-18 · sparring-ladder · `npm run baseline`, `rates.ts`, first committed baselines (150 games a level) · [report](../reports/sparring-ladder.html), [PR #79](https://github.com/iamphduc/chess-web/pull/79)
