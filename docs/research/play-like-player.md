# Research: Computer opponent that plays like GM Le Quang Liem (FIDE 12401137)

_Generated: 2026-10-09 · Depth: standard · Searches: 10 · Pages read: 21_

**Assumptions:** The app is static (GitHub Pages), so everything must run in the browser. "Plays like" means opening choices plus human-like move picks, not a perfect clone. Game counts come from sites that change over time.

**Who the player is:** [FIDE profile](https://ratings.fide.com/profile/12401137) shows Le, Quang Liem, Vietnam, GM (2006), born 1991, Standard 2732, Rapid 2626, Blitz 2675. Peak 2741 (Aug 2024) per [Wikipedia](https://en.wikipedia.org/wiki/Quang_Liem_Le).

## What exists

### Game sources (PGN)
| Name | Link | What it gives | Download / terms | Fit |
|------|------|---------------|------------------|-----|
| chessgames.com | [player page](https://www.chessgames.com/perl/chessplayer?pid=99199) | 1,932 games, 2002-2026; stats exclude blitz/rapid/exhibition | "PGN Download" button links to an inactive page; terms page returned 404, so terms unknown | Good count, download unclear |
| TWIC | [theweekinchess.com/twic](https://theweekinchess.com/twic) | Weekly zipped PGN of international games (issue 1665, 5 Oct 2026, 5,766 games) | "Free for personal use only. All rights are reserved." | Best bulk source; filter by player yourself; redistribution not allowed |
| chesshere.com | [profile](https://www.chesshere.com/masters/quang-liem-le) | Profile page with FIDE ID, recent games | Download and terms: no evidence found | Unclear |
| 365chess, chessarchive.net | n/a | Both returned HTTP 403 to my fetch | Not verified | no evidence found |
| Lichess (Liem_Chess) | [coach page](https://lichess.org/coach/Liem_Chess) | Coach profile of "GM Liem Quang Le", FIDE 2728; page doesn't confirm it is the same person | Game count: no evidence found | Unconfirmed identity |
| Lichess database | [database.lichess.org](https://database.lichess.org/) | All rated Lichess games, CC0 | Free for any use | Only useful if he has an account with games; none confirmed |

Not found: chess-results, OlimpBase, national federation PGN; time-control split of the games; confirmed chess.com username.

### Imitation approaches
| Name | Link | What it does | Alive? | License | Fit |
|------|------|--------------|--------|---------|-----|
| Stockfish.js (nmrugg) | [GitHub](https://github.com/nmrugg/stockfish.js) | Stockfish as WASM. Lite builds about 1.6-1.7 MB; full builds about 94 MB. Single-thread builds need no special headers | 1.2k stars, based on Stockfish 19 | GPL v3 (engine) | Strong engine to use after the book |
| Stockfish strength options | [UCI wiki](https://github.com/official-stockfish/Stockfish/wiki/UCI-Protocol-and-Stockfish-Commands) | UCI_LimitStrength + UCI_Elo (1320-3190, calibrated at 120s+1s); Skill Level 0-20 sometimes picks a weaker move | Official | GPL | Range covers 2700, but weakened play is not human-style |
| Maia (v1) | [CSSLab/maia-chess](https://github.com/CSSLab/maia-chess) | Lc0-format nets, 1100-1900, plus training code for your own PGN | 1.3k stars | GPL-3.0 | Too weak for a 2700 GM |
| Maia-2 | [CSSLab/maia2](https://github.com/CSSLab/maia2) | One model; input is board plus your Elo and opponent Elo | 156 stars | MIT | Rating is an input; its top Elo range not verified |
| Maia-3 ONNX | [HF bqrio/maia3-onnx](https://huggingface.co/bqrio/maia3-onnx) | Browser-ready ONNX, 3.2M-78.9M params, fp16 files 6.7 to 156 MB, onnxruntime-web (WebGPU or WASM) | Community export | AGPLv3 | Runs client-side; AGPL is strong for a public site |
| Maia4All | [arXiv 2507.21488](https://arxiv.org/html/2507.21488v1) | Personalizes Maia-2 with about 20 games | Preprint; no code link seen | none stated | Fits the idea, but not usable today |
| Transfer Maia (2022) | [summary](https://chessenginelab.substack.com/p/creating-individualised-chess-engines) | Fine-tunes Maia on one player | Paper plus code on GitHub | n/a | Needs 5,000+ games per player |
| Maia2 in a browser app | [Lichess blog](https://lichess.org/@/HollowLeaf/blog/integrating-maia2-the-human-like-chess-engine-into-my-chess-application/zi3EhDn5) | ONNX Runtime Web, one file, rating bucket as input, opening book for first 10 ply | Blog, undated | Not stated | Working recipe |

### Products that play a named person
| Product | Link | What it does | Weak points |
|---------|------|--------------|-------------|
| Chess.com bots (Hikaru, MrBeast, others) | [Chessiverse comparison](https://chessiverse.com/compare/best-chess-bot-personalities) | 100+ bots on Komodo with character art and chat | Link between personality and real play is weak (rival's claim) |
| Play Magnus | same page | Magnus at ages 10, 18, now | Effectively wound down after the 2022 acquisition (same source) |
| Maia platform | [blog](https://www.maiachess.com/blog/platform-v1) | Maia-2 drills against a chosen Maia model | Not a named person; no personalization seen |

## Gaps and angles
- No product found that builds a bot from one real GM's games. Named-person bots are Komodo plus personality, per a rival's page (weak source). — [Chessiverse](https://chessiverse.com/compare/best-chess-bot-personalities)
- Personalized Maia gains are small (4-5% move match) and GM attempts were "less successful, possibly because GMs make fewer mistakes." Cloning a 2700 is not proven. — [summary](https://chessenginelab.substack.com/p/creating-individualised-chess-engines)
- Personalization needed 5,000 games (old) or about 20 games with no code seen (new). Liem has about 1,900 database games, mostly slow ones. — [Maia4All](https://arxiv.org/html/2507.21488v1), [chessgames](https://www.chessgames.com/perl/chessplayer?pid=99199)
- Neural nets play erratically in the opening; the working fix is an opening book. — [Lichess blog](https://lichess.org/@/HollowLeaf/blog/integrating-maia2-the-human-like-chess-engine-into-my-chess-application/zi3EhDn5)
- Human-like bots should make pattern-based errors and keep a consistent style, not random blunders (vendor view). — [Chessiverse blog, May 2026](https://chessiverse.com/blog/chess-bot-feels-more-real-than-ever-and-why-it-matters)

## What his games show (for the book)
- Style: "highly technical, positional, and solid," strong endgames. White: 1.d4, Catalan, London, QGD. Black: Berlin, Najdorf, Four Knights, Grünfeld. — [chesshere](https://www.chesshere.com/masters/quang-liem-le)
- Most played as White: QGD (117), Queen's Pawn (117), Slav (81), King's Indian (73), Nimzo-Indian (41), Grünfeld (40). As Black: Sicilian (201), Ruy Lopez (86), QGD (64), Najdorf (58), Grünfeld (57). — [chessgames](https://www.chessgames.com/perl/chessplayer?pid=99199). The "as White" list has Black-side openings (King's Indian, Grünfeld), so it likely counts openings faced; check against real PGN.
- Record +362 -112 =370 (64.8%) in slow games. — same page
- Rating-level mistakes: no evidence found. His errors at 2700 are rare and I found no source on them.

## Best practices
- Opening book first, engine after; hand over after about 10 ply. — [Lichess blog](https://lichess.org/@/HollowLeaf/blog/integrating-maia2-the-human-like-chess-engine-into-my-chess-application/zi3EhDn5)
- Filter neural net output to legal moves from your own rules engine. — same
- Use single-thread lite WASM on GitHub Pages: multi-thread builds need COOP/COEP headers. — [stockfish.js](https://github.com/nmrugg/stockfish.js)
- Use `UCI_LimitStrength`/`UCI_Elo`; Elo is calibrated at one time control, so test with your own timing. — [UCI wiki](https://github.com/official-stockfish/Stockfish/wiki/UCI-Protocol-and-Stockfish-Commands)
- Check licences: Stockfish.js engine is GPL v3, Maia-3 ONNX is AGPLv3, Maia-2 code is MIT (weight terms not separately verified). — links above

## Ideas to consider
- Minimal: static opening book (JSON) from his games, then a UCI_Elo-limited lite Stockfish. — grows from best practice 1
- Repertoire view: show which of his lines you are in and what he usually plays next. — (own idea)
- Weighted choice: sample among top Stockfish MultiPV moves, favoring his frequent book moves. — (own idea)
- Maia-2 in the middlegame with a high Elo input, Stockfish in endgames. — grows from the Maia browser recipe
- Bring-your-own-PGN: user imports a PGN, the book is built in the browser; avoids redistributing data. — grows from the TWIC "personal use" terms
- Bold: fine-tune Maia on his games offline and ship ONNX. — weak evidence for GMs
- Post-game review: "he would have played X here." — (own idea)
- Player-agnostic design so other players can be added later. — (own idea)

## Questions for the plan
- Can his games be shipped in the repo? — TWIC is "personal use only", chessgames terms not found — options: ship only derived move counts / user imports PGN / ask permission
- How strong should it be? — his rating 2732, UCI_Elo cap 3190, browser speed — options: fixed about 2700 / slider / levels
- Book depth and rule? — about 1,900 games, mostly slow — options: top-N by frequency / weighted random / stop at 10-15 ply
- Is Stockfish GPL acceptable for the repo's licence? — engine is GPL v3 — options: make repo GPL / other engine / Maia only
- Ship a neural net? — Maia-3 ONNX 6.7 to 156 MB and AGPLv3 — options: skip / Maia-2 / small 5M model
- Which time control to mimic? — chessgames stats exclude blitz/rapid; his blitz is 2675 — options: classical only / separate bots
- Are the Lichess/Chess.com accounts his? — Lichess coach page doesn't confirm — options: ask the human / skip
- Does "improve my chess thinking" need explanations or just a sparring partner? — options: plain opponent / hints / review

## Sources
- FIDE profile — https://ratings.fide.com/profile/12401137 — fetched 2026-10-09
- Wikipedia, Quang Liem Le — https://en.wikipedia.org/wiki/Quang_Liem_Le — 2026
- chessgames.com player page — https://www.chessgames.com/perl/chessplayer?pid=99199 — 2026
- chesshere.com — https://www.chesshere.com/masters/quang-liem-le — 2026
- Lichess coach page — https://lichess.org/coach/Liem_Chess — undated
- TWIC — https://theweekinchess.com/twic — 5 Oct 2026
- Lichess database — https://database.lichess.org/ — undated
- stockfish.js — https://github.com/nmrugg/stockfish.js — undated
- Stockfish UCI wiki — https://github.com/official-stockfish/Stockfish/wiki/UCI-Protocol-and-Stockfish-Commands — undated
- Maia — https://github.com/CSSLab/maia-chess — undated
- Maia-2 — https://github.com/CSSLab/maia2 — undated
- Maia-3 ONNX — https://huggingface.co/bqrio/maia3-onnx — undated
- Maia4All — https://arxiv.org/html/2507.21488v1 — 2025
- Transfer Maia summary — https://chessenginelab.substack.com/p/creating-individualised-chess-engines — 2024-03-26
- Maia2 in browser (Lichess blog) — https://lichess.org/@/HollowLeaf/blog/integrating-maia2-the-human-like-chess-engine-into-my-chess-application/zi3EhDn5 — undated
- Maia platform v1 — https://www.maiachess.com/blog/platform-v1 — 2025
- Chessiverse bot personalities — https://chessiverse.com/compare/best-chess-bot-personalities — 2026-09-09
- Chessiverse blog — https://chessiverse.com/blog/chess-bot-feels-more-real-than-ever-and-why-it-matters — 2026-05-18
