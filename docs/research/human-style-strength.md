# Research: Human-style strength steps (1400 to 2700) on Stockfish

_Generated: 2026-10-11 · Depth: standard · Searches: 17 · Pages read: 23_

**Assumptions:** The repo is GPL-3.0, so Stockfish's GPL is not a problem. "Rating" means the label on a step in the UI, not a measured rating. I ran no test, so every number is from a page, or marked as my own calculation.

## What exists
| Name | Link | What it does | Alive? | License | How close to the idea |
|------|------|--------------|--------|---------|-----------------------|
| Stockfish Skill / UCI_Elo | [search.h](https://raw.githubusercontent.com/official-stockfish/Stockfish/master/src/search.h) | Elo 1320-3190 becomes a "level" 0-19 via a cubic. With skill on, MultiPV is raised to at least 4, then one move is picked among the lines at a set depth | 16.9k stars | GPL-3.0 | What you tried. Likely source of the odd blunders |
| DEV post "human mode" | [dev.to](https://dev.to/tiltedlunar123/stockfish-already-picks-the-best-move-getting-it-to-pick-a-human-looking-one-was-the-hard-part-357n) | MultiPV 4; weight by cp gap (<=10: 1.0, <=30: 0.55, <=60: 0.18, <=100: 0.05, else 0.01); random pick | One post, undated | n/a | Almost your plan. Author: weights eyeballed, not fitted |
| Maia (human-move nets) | [Toronto CSSLab](https://csslab.cs.toronto.edu/blog/2020/08/24/maia_chess_kdd/) | One net per rating bin 1100-1900. Matches human moves at 46%+; depth-limited Stockfish only 35-40% | 2020 (possibly stale) | see prior report | Best human-likeness, but tops out near 1900 |
| Chessiverse bots | [blog](https://chessiverse.com/blog/how-we-build-human-like-chess-bots) | Vendor says a "Move Curator" has a stronger engine reject unnatural moves; openings from human games | Vendor claims | Closed | The curator is the same idea as your loss cap |
| lichess-bot | [repo](https://github.com/lichess-bot-devs/lichess-bot) | Bridge from Lichess bot accounts to UCI engines | 1.1k stars | AGPL-3.0 | Not a human-style method |
| stockfish.js | [repo](https://github.com/nmrugg/stockfish.js) | WASM Stockfish 19; lite single build about 1.7 MB, no special headers | 1.2k stars | GPL-3.0 | Your engine host |

## Gaps and angles
- **Why UCI_Elo 1400 feels wrong.** From the fetched cubic, my calculation gives level about 0.57 at `UCI_Elo` 1400. The pick runs when `depth == 1 + int(level)`, so at depth 1 ([search.h](https://raw.githubusercontent.com/official-stockfish/Stockfish/master/src/search.h)). The weakness term is `120 - 2*level` plus a random part ([search.cpp](https://raw.githubusercontent.com/official-stockfish/Stockfish/master/src/search.cpp)). So near the floor it picks from shallow, noisy lines. That fits "random one-move blunders" and "too weak overall".
- **What UCI_Elo is calibrated against.** `no evidence found` from a page I fetched (the Stockfish wiki URL 404ed; the repo README and engine.cpp have no calibration text). I also found no source mapping UCI_Elo to Lichess or chess.com ratings.
- **Weakened engines look like engines.** Maia authors: depth-limited Stockfish resembles "full-strength Stockfish with noise added"; very weak Stockfish predicts human moves better than moderate depth ([CSSLab](https://csslab.cs.toronto.edu/blog/2020/08/24/maia_chess_kdd/)).
- **A cap alone is "taste, not skill".** The DEV author says re-ranking good moves does not reproduce a real 1400's mistakes. Real 1400s do hang pieces sometimes, so "no one-move blunders" plays stronger than a true 1400 unless the engine search is also shortened.
- **Human data per band is thin.** I found no measured ACPL or blunder rate per rating band. Lichess forum has only anecdotes (about 64 cp ACPL at about 1700, undated) ([thread](https://lichess.org/forum/general-chess-discussion/correlation-of-accuracy-to-rating)). A 35,000-game study (10-minute games, Stockfish 17.1 depth 13, Apr 2025) shows accuracy rising steadily from 400 to 2600 but gives the values only in a chart image ([lucb3](https://lichess.org/@/lucb3/blog/do-stronger-players-play-more-accurately-i-analyzed-35000-games-to-find-out/Ml0nRybj)). A blitz study of about 2,500 games says blunders per game fall sharply with rating while mistakes stay flat; figures are images ([kwojcicki](https://kwojcicki.github.io/blog/CHESS-BLUNDERS)).
- **Rating scales differ.** Lichess runs about 300-400 above chess.com at low levels and converges near 2500 ([lucb3](https://lichess.org/@/lucb3/blog/converting-chesscom-to-lichess-ratings-a-new-data-driven-method/Ww3v70WB)).
- **chess.com bot method** is `no evidence found` from chess.com itself; only a competitor's claim that bots play normally then inject mistakes ([Chessiverse](https://chessiverse.com/blog/how-we-build-human-like-chess-bots) did not state this on the page I read).

## Best practices
- **Compare moves in win%, not cp.** Lichess: `Win% = 50 + 50*(2/(1+exp(-0.00368208*cp))-1)`; accuracy `103.1668*exp(-0.04354*(winBefore-winAfter))-3.1669` ([Lichess](https://lichess.org/page/accuracy)). My calculation: 50 cp about 54.6%, 100 cp about 59%, 200 cp about 67.6%, 300 cp about 75%. A 100 cp loss when already far ahead costs little win%; at equality it costs more.
- **Blunder size.** ChessBase used "two pawns or worse": 1.37% of 4.9M moves (2014 games), 1.07% above 2500, 0.96% above 2775; the trendline halves the rate per 600 rating points; Crafty at 2 s per move, published 2015 (possibly stale) ([ChessBase](https://en.chessbase.com/newsroom/post/grandmaster-blunders-a-statistical-analysis)). Order of magnitude only.
- **Filter, then sample.** Cap the loss first, then pick by weight; the DEV post tapers so moves 80+ cp worse almost never get picked.
- **Keep MultiPV small, and do not use it at the top step.** MultiPV loses most cutoffs: one test took 1086 ms single-PV vs about 58 s with 29 lines at depth 20, single thread; the gap is much smaller at low depth (depth 12: 2 s vs 6 s per-move in another test) ([TalkChess, Jan 2020](https://talkchess.com/viewtopic.php?p=827436)). I found no WASM nodes-per-second figures, so measure on your own build.
- **Time pressure raises blunders.** One month of Lichess games shows blunders rising as the clock drops, with a spike at the low-time alarm, also for 2000+; correlation only ([Lichess forum](https://lichess.org/forum/redirect/post/1SL2qHTI)).
- **Disclose the engine.** Lichess bot API guidance: "Clearly state which engine your bot uses in the profile", example bio "Powered by Stockfish 16" ([lila docs mirror](https://mintlify.wiki/lichess-org/lila/api/bot/account); a mirror, not lichess.org). Lichess introduced bots as accounts for engines (8 May 2018, possibly stale) ([blog](https://lichess.org/blog/WvDNticAAMu_mHKP/welcome-lichess-bots)). I found no bot that labels book moves vs engine moves; that would be new. Stockfish is GPL-3.0, so a credit and source link are also a licence matter ([Stockfish repo](https://github.com/official-stockfish/Stockfish)).

## Ideas to consider
- **Minimal:** MultiPV 4, short fixed movetime; drop moves whose win% loss is above the step's cap; choose with softmax over win%. Grows from the DEV post and Lichess formula above.
- **Cap table as config:** one row per step: `maxWinLoss`, `temperature`, `lines`, `movetime`. Start with guesses (for example 1400: cap about 12 win%, high temperature; 2700: cap 0, one line), tune by self-play. (own idea)
- **Rare small slips at low steps:** with small chance allow a larger cap, but never a move that loses a piece for nothing (check with your own rules engine). (own idea)
- **Obvious-move bias:** boost recaptures, checks and castling inside the cap, like the DEV post.
- **Strength from search, flavour from sampling:** shorter movetime or depth at low steps so the bot misses deep tactics like a human, instead of random noise. (own idea)
- **Clock effect:** if games have a clock, raise temperature and cap as the player's clock drops. Grows from the Lichess low-time data.
- **Calibration script (dev tool):** play each step against UCI_Elo anchors and against other steps; report the gap. (own idea)
- **Bold:** swap in Maia-style nets for 1100-1900 steps behind the same `chooseMove` interface ([opponent-engine-options](../ideas/opponent-engine-options.md)).

## Questions for the plan
- Should low steps ever hang a piece? — why it matters: real 1400s do; the Maia and DEV sources say re-ranking does not copy their errors — options: never / rare small slips / blunders only in time trouble.
- Which scale is "1400"? — why it matters: Lichess is 300-400 above chess.com there — options: Lichess / chess.com / "approximate, no claim".
- How will steps be calibrated? — why it matters: no source maps caps to ratings — options: self-play vs UCI_Elo anchors / label as approximate / test with real players.
- Fixed movetime, depth or nodes? — why it matters: WASM speed varies by device, no kn/s data found — options: depth (same strength everywhere) / movetime (same feel) / nodes.
- How many lines? — why it matters: Stockfish skill mode uses at least 4; more lines cost more — options: 3 / 4 / 6 at lower depth.
- How to treat mate scores? — why it matters: cp caps break near mates; win% saturates — options: exclude any move that allows forced mate / cap in win% only / skip sampling when one move holds.
- Should low steps still convert won endgames? — why it matters: loose sampling can let a won position drift — options: lower temperature when far ahead / same sampler everywhere.
- Where does the disclosure go? — why it matters: moves after the book come from Stockfish, GPL asks for credit — options: line under the opponent name plus About page / per-move "book" vs "engine" badge / docs only.

## Sources
- Lichess accuracy page — https://lichess.org/page/accuracy — undated
- Stockfish search.h — https://raw.githubusercontent.com/official-stockfish/Stockfish/master/src/search.h — fetched 2026-10-11
- Stockfish search.cpp — https://raw.githubusercontent.com/official-stockfish/Stockfish/master/src/search.cpp — 2026-10-11
- Stockfish repo — https://github.com/official-stockfish/Stockfish — 2026-10-11
- DEV post, human mode — https://dev.to/tiltedlunar123/stockfish-already-picks-the-best-move-getting-it-to-pick-a-human-looking-one-was-the-hard-part-357n — undated
- Maia KDD post — https://csslab.cs.toronto.edu/blog/2020/08/24/maia_chess_kdd/ — 2020-08-24 (possibly stale)
- Chessiverse blog — https://chessiverse.com/blog/how-we-build-human-like-chess-bots — undated, vendor
- ChessBase blunders — https://en.chessbase.com/newsroom/post/grandmaster-blunders-a-statistical-analysis — 2015-01-30 (possibly stale)
- kwojcicki blog — https://kwojcicki.github.io/blog/CHESS-BLUNDERS — undated
- Lichess forum, accuracy vs rating — https://lichess.org/forum/general-chess-discussion/correlation-of-accuracy-to-rating — undated
- lucb3, 35,000 games — https://lichess.org/@/lucb3/blog/do-stronger-players-play-more-accurately-i-analyzed-35000-games-to-find-out/Ml0nRybj — 2025-04-21
- lucb3, rating conversion — https://lichess.org/@/lucb3/blog/converting-chesscom-to-lichess-ratings-a-new-data-driven-method/Ww3v70WB — undated
- TalkChess, MultiPV slow — https://talkchess.com/viewtopic.php?p=827436 — 2020-01
- Lichess forum, low-time blunders — https://lichess.org/forum/redirect/post/1SL2qHTI — undated
- Lila bot API docs mirror — https://mintlify.wiki/lichess-org/lila/api/bot/account — undated
- Welcome Lichess Bots — https://lichess.org/blog/WvDNticAAMu_mHKP/welcome-lichess-bots — 2018-05-08
- stockfish.js — https://github.com/nmrugg/stockfish.js — 2026-10-11
- lichess-bot — https://github.com/lichess-bot-devs/lichess-bot — 2026-10-11

Not found: `no evidence found` for UCI_Elo calibration anchor on a fetched page, measured ACPL or blunder rate per band at 1400-2700, WASM kn/s numbers, Lichess level table from a primary source, chess.com's own bot method, and any bot that separates book from engine moves.
