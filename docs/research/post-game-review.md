# Research: Post-game review that teaches (win % drop, Stockfish alternative, GM book move, book exit)

_Generated: 2026-10-13 · Depth: standard · Searches: 14 · Pages read: 17_

**Assumptions:** The human is about 1400. "Book" means a local opening dataset built from the GM's games. Lichess-style win % is wanted. Review runs after the game, on the player's own device.

## What exists
| Name | Link | What it does | Alive? | License | How close to the idea |
|------|------|--------------|--------|---------|-----------------------|
| Lichess analysis + "Learn from your mistakes" | [blog](https://lichess.org/blog/WFvLpiQAACMA8e9D/learn-from-your-mistakes) | Server Stockfish analysis, then walks through each error and asks you to find a better move; reveals the best move on request | Live; blog is old (possibly stale) | AGPL (lila) | Closest for the retry loop. No GM-book layer. |
| Chess.com Game Review | [support](https://support.chess.com/en/articles/8584089-how-does-game-review-work) | Coach walks through "key moves" (first is usually the last book move), Retry button, Book label | Live; free users get 1 review per day | Closed | Closest overall UX. Book = generic theory, not one GM. |
| Chesskit | [repo](https://github.com/GuillaumeSD/Chesskit) | Open-source site: imports games, eval graph, move classification, games stored in the browser, Stockfish | 425 stars; last commit date not shown | AGPL-3.0 | Same kind of app. License needs a check before copying code. |
| En Croissant | [repo](https://github.com/franciscoBSalgueiro/en-croissant) | Desktop app, imports Lichess/chess.com games, any UCI engine | About 1.9k stars; release date not shown | GPL-3.0 | Desktop, not a browser. Little to copy for UI. |
| UChess | [page](https://www.uchess.com/acknowledgements) | Ships Stockfish.js 18 lite single-thread for review in the browser | Live | Engine GPL-3.0 | Same engine setup as this project. No speed data given. |
| Chessigma | [blog](https://www.chessigma.com/blog/how-chessigma-analysis-works) | In-browser Stockfish; most moves at depth 14; opening positions reuse cached evals | Live | Unknown | Shows depth 14 is a workable browser target. Says mobile "can feel sluggish". |
| Lichess web-programming tutorial | [blog](https://lichess.org/@/HollowLeaf/blog/chess-web-programming-part-five-game-review/32JsEsrs) | Tutorial: depth 12, MultiPV 3, labels by eval gap | Tutorial, date unknown | n/a | The minimal version. Its labels use a raw eval gap and have a hole between 2 and 3. |

Not found: a tool that shows what one specific GM played at a given position, next to the engine move. This looks open.

## Gaps and angles
- Chess.com's "book" is generic theory. Its coach bubble shows the opening name, how often you played it, and a suggested course, not what a chosen master played. A GM-specific book line is new. — [chess.com](https://support.chess.com/en/articles/8584089-how-does-game-review-work)
- Chess.com's quick post-game summary can disagree with the full review ("A move labeled Brilliant in the summary may be classified differently"). Mixed depths on one screen confuse users, so say which depth you used. — [chess.com](https://support.chess.com/en/articles/8584089-how-does-game-review-work)
- Lichess "Learn from your mistakes" needs a full analysis first and works per game. — [lichess blog](https://lichess.org/blog/WFvLpiQAACMA8e9D/learn-from-your-mistakes)
- A ChessBase review of GM Nick Pert's course on 1000-1600 players says their main weakness is psychological as well as knowledge, and they throw away good positions with unnecessary moves. This suggests flagging "you were winning and lost it" moments, not only the biggest drops. — [ChessBase, 2020, possibly stale](https://en.chessbase.com/newsroom/post/typical-mistakes-by-1000-1600-players-2?page=0)
- Phone speed: no published numbers for single-thread lite WASM. `no evidence found`. Chessigma says its faster multi-thread build is not on mobile yet. — [chessigma](https://www.chessigma.com/blog/how-chessigma-analysis-works)

## Classification and accuracy: what the big sites do
| Item | Lichess | Chess.com |
|------|---------|-----------|
| Win % from centipawns | `50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)` ([page](https://lichess.org/page/accuracy)) | Expected points model, uses player rating ([support](https://support.chess.com/en/articles/8572705-how-does-game-review-work)) |
| Per-move accuracy | `103.1668 * exp(-0.04354 * (winBefore - winAfter)) - 3.1669` | Not in the page I read |
| Inaccuracy | About 10 point win % drop | 0.05 to 0.10 points lost |
| Mistake | About 20 | 0.10 to 0.20 |
| Blunder | About 30 | 0.20 to 1.00 |
| Good / Excellent / Best | Third-party extension: under 1% loss = good | Good 0.02-0.05, Excellent 0-0.02, Best 0 |
| Brilliant / Great / Miss | Third-party extension only ("interesting" moves) | Rule-based: sacrifice and not already winning; critical move; missed chance |

Lichess thresholds come from a forum post quoting the code, not the source file ([forum](https://lichess.org/forum/general-chess-discussion/what-constitutes-an-inaccuracy)). Confirm in lila before copying. The Lichess accuracy page gives no numeric cutoffs.

## Best practices
- Let the player try before the answer. Lichess says the feature exists to make you "rethink the position by yourself"; chess.com offers Retry. — [lichess](https://lichess.org/blog/WFvLpiQAACMA8e9D/learn-from-your-mistakes), [chess.com](https://support.chess.com/en/articles/8584089-how-does-game-review-work)
- Accept several good moves. Lichess does not count a move as a mistake in the opening if at least two masters played it. That fits your book idea directly. — [lichess](https://lichess.org/blog/WFvLpiQAACMA8e9D/learn-from-your-mistakes)
- Use win %, not centipawns, so a 1-pawn slip in a won game is not weighed like one in an equal game. — [lichess](https://lichess.org/blog/WFvLpiQAACMA8e9D/learn-from-your-mistakes)
- Make the last book move the first key moment. Chess.com does this. — [chess.com](https://support.chess.com/en/articles/8584089-how-does-game-review-work)
- Let the user choose whose key moments to show (you, opponent, both). — [chess.com](https://support.chess.com/article/364-how-does-the-game-report-analysis-work)
- Count a 2nd or 3rd MultiPV line as "good", as the tutorial does. — [tutorial](https://lichess.org/@/HollowLeaf/blog/chess-web-programming-part-five-game-review/32JsEsrs)
- Engine depth is modest even on big sites: Lichess server analysis is about depth 16 per a third-party author (2024). Depth 12-14 in a browser is in the same range. — [TotalNoob69](https://lichess.org/@/TotalNoob69/blog/brilliantgoodbest-move-detection-on-lichessorg/R2b0tizP), [chessigma](https://www.chessigma.com/blog/how-chessigma-analysis-works)
- Engine files: lite single-thread is about 1.7 MB and needs no special headers, so it works on GitHub Pages. Engine code is GPL-3.0, matching your license. — [stockfish.js](https://github.com/nmrugg/stockfish.js)
- Local storage: Web Storage is capped at 5 MiB per origin. IndexedDB quotas are far larger (Safari about 60% of disk). Data is best-effort unless you call `navigator.storage.persist()`. Safari can delete script-created data after 7 days without a visit when tracking prevention is on. — [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)

## Ideas to consider
- **Minimal:** after the game, run depth ~12 on every position once; list the 3 biggest win % drops with "you played X, engine says Y". — grows from the tutorial approach.
- Add a "left book at move N" line with the GM's top moves and counts at the last book position. — grows from chess.com's first key move.
- At each flagged move, a "Try again" step with the best move hidden, then reveal engine move and GM move. — grows from Retry / Learn from mistakes.
- Treat a move as fine if it is in the GM's book, even if the engine prefers another. — grows from the Lichess masters rule.
- Eval graph (win %), tap to jump; phone layout: board on top, graph strip, one key-moment card, prev/next buttons. — (own idea)
- Tag "squandered lead" moments (above 70%, then below 50%) separately. — grows from the ChessBase point on throwing away good positions.
- Save finished games and their analysis to IndexedDB with a "Past games" list. — grows from Chesskit's browser storage and MDN quotas.
- **Bold:** a "recurring leak" report across saved games (phase, move number, first move out of book). — (own idea)

## Questions for the plan
- How fast is the lite single-thread build on a mid-range phone? — why it matters: no published numbers found; Chessigma says mobile lags — options: one-day benchmark (fixed depth 12 and 14, 20 positions, 2 phones) / fixed time cap per position / cap that adapts to measured speed.
- Analyse during the game or after? — why it matters: one core is shared with the opponent engine; stopping a search may need a worker restart — options: after only (simplest) / while the human is thinking / hybrid.
- Which thresholds? — why it matters: Lichess is 10/20/30 win % drop; chess.com is 5/10/20 points and rating-aware, so it flags more — options: Lichess / chess.com-like / custom.
- How many moves to flag? — why it matters: no source gives counts; long lists overwhelm — options: top 3 / top 5 / all mistakes and worse with a filter.
- Is a GM book move "fine" even when the engine disagrees? — why it matters: Lichess treats master moves as playable — options: always / only inside book depth / show both, no label.
- What counts as "in book", and how many games must back "usually"? — why it matters: thin positions give weak claims — options: minimum count / show counts / hide below the minimum.
- Save past games? — why it matters: localStorage caps at 5 MiB; IndexedDB is larger but best-effort — options: none / IndexedDB with export-import file / IndexedDB plus `persist()`.
- Reuse code from Chesskit (AGPL-3.0)? — why it matters: license terms differ from GPL-3.0 — options: write own classifier from the public formulas / reuse after license review.

## Not found
- Single-thread lite WASM time per position on phones or desktops, and total time for a 40-move game: `no evidence found`.
- Mobile review layout specifics (chess.com app move list): `no evidence found`.
- Controlled evidence that review tools raise ratings: `no evidence found`.
- Lichess numeric classification in source code: only a forum quote was fetched.

## Sources
- Lichess accuracy metric — https://lichess.org/page/accuracy — undated
- Chess.com move classifications — https://support.chess.com/en/articles/8572705-how-does-game-review-work — undated
- Chess.com Game Review support — https://support.chess.com/en/articles/8584089-how-does-game-review-work — undated
- Chess.com game report analysis — https://support.chess.com/article/364-how-does-the-game-report-analysis-work — undated
- Lichess forum, what constitutes an inaccuracy — https://lichess.org/forum/general-chess-discussion/what-constitutes-an-inaccuracy — undated
- Lichess blog, Learn from your mistakes — https://lichess.org/blog/WFvLpiQAACMA8e9D/learn-from-your-mistakes — about 2016, possibly stale
- Lichess blog, web programming part five — https://lichess.org/@/HollowLeaf/blog/chess-web-programming-part-five-game-review/32JsEsrs — undated
- Lichess blog, brilliant/good/best detection — https://lichess.org/@/TotalNoob69/blog/brilliantgoodbest-move-detection-on-lichessorg/R2b0tizP — 2024-07-12
- En Croissant repo — https://github.com/franciscoBSalgueiro/en-croissant — fetched 2026-10-13
- Chesskit repo — https://github.com/GuillaumeSD/Chesskit — fetched 2026-10-13
- stockfish.js repo — https://github.com/nmrugg/stockfish.js — fetched 2026-10-13
- UChess acknowledgements — https://www.uchess.com/acknowledgements — undated
- Chessigma, how analysis works — https://www.chessigma.com/blog/how-chessigma-analysis-works — undated
- ChessBase, typical mistakes by 1000-1600 players — https://en.chessbase.com/newsroom/post/typical-mistakes-by-1000-1600-players-2?page=0 — 2020-02-11, possibly stale
- MDN, storage quotas and eviction — https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria — fetched 2026-10-13
