# Plan: Play like Liem

_Generated: 2026-10-09 · Status: archived · Grilled-with: grilling (fast)_

## Goal
Add a computer opponent that plays like GM Le Quang Liem (FIDE 12401137, Vietnam, 2732 classical). It plays his real openings from a book built from his games, then a strength-limited Stockfish takes over. The human picks their color and his strength, and a book panel shows what he played in this position.

## Why
The human wants to sharpen their chess thinking by playing against a real GM's repertoire and style. At full 2700 strength a club player learns little, so the strength can be set from 1400 up to full. His openings stay real at every level.

Success: the human can start a game against Liem as White, Black or Random. He answers at once with his book moves while the game is in his games, and with Stockfish at the chosen strength after that. The panel shows his move counts for the current position and says when the game leaves his book. The two-player mode still works as before.

Constraints: static site on GitHub Pages, no backend, so everything runs in the browser. Single-thread WASM only, because GitHub Pages can't set the COOP/COEP headers that threaded builds need. Research: [play-like-player](../research/play-like-player.md).

## Scope
**In scope:**
- **Game data import:** a Node script that collects his games and builds the books. Sources:
  - His Lichess games through the Lichess API. FIDE link: `https://lichess.org/fide/12401137/Le_Quang_Liem`. The script finds his account from that page or from the human.
  - His Chess.com games, user `liemle`, through the Chess.com public API.
  - Slow over-the-board PGN files that the human puts in a local folder ignored by git, for example from TWIC or chessgames.com.
- **Two books:** one for slow games (15 minutes or more) and one for online games. Each holds only move counts per position, plus win, draw and loss counts, and is committed as JSON. No raw game files ship.
- **His move choice:**
  - In book, he picks among his moves weighted by how often he played them.
  - The game's clock picks the book. When a line in that book is thin, he falls back to the other book.
  - Off book, Stockfish lite WASM (single thread, in a Web Worker) plays with `UCI_LimitStrength` and `UCI_Elo` at the chosen strength.
  - Every engine move is checked against our own `legalMoves` before it's applied.
- **Engine boundary:** the move choice sits behind one small interface, so the engine can be swapped later. See [opponent-engine-options](../ideas/opponent-engine-options.md).
- **Game modes:** a switch between "vs Liem" and "Two players". Two-player behavior is unchanged.
- **Setup:** before each game, pick White, Black or Random, and a strength from 1400 to full in 7 steps. When the human plays Black, the board flips.
- **Timing:** he moves as soon as his move is ready, with no fake pause. His clock runs as normal.
- **Book panel:** in vs-Liem games, shows his moves for the current position with counts, marks the move he played, and turns into an "Out of his book" note once the game leaves his book.
- **Licence:** add a GPL-3.0 `LICENSE` file, because the app ships Stockfish (GPL v3). Credit Stockfish and the game sources in the README.

**Out of scope:**
- **Post-game review:** saved as a later plan in [post-game-review](../ideas/post-game-review.md).
- **Other players.** Keep the book format and the player data free of Liem-only fields, so adding a player later is new data, not new code.
- **A personalized neural model** (Maia and similar). See [opponent-engine-options](../ideas/opponent-engine-options.md).
- **A human-like thinking pause.** The human chose instant moves.
- **Saving games, accounts or a backend.**

## Sprint sequence

| Sprint | Goal | Status | Depends on |
|--------|------|--------|------------|
| liem-book | Import script, the slow and online books as JSON, and his move choice (book, then Stockfish in a worker, checked against `legalMoves`) behind one interface, tested without UI | done | — |
| liem-opponent | Mode switch, pre-game card (color and strength), playing him on the board with clocks, the book panel, the LICENSE and credits | done | liem-book |

## Look
The human's pick: **"I like a mix between A and B"** from [the draft](../design-drafts/play-liem-look.html). I chose which parts come from each and why. The setup comes from B, because a card makes starting a game feel like a challenge. The in-game book comes from A, because a side note doesn't cover the board while you play.

- **Thesis:** a "challenge" card to start the game, in Vietnamese flag red and gold, then a quiet margin note for his book while you play.
- **Palette:**
  - Page `#333333` (unchanged).
  - Card `#1F1F1F` for the setup card, and note background `#262626`.
  - Text `#FFFFFF`, soft text `#B8B8B8`.
  - Flag red `#DA251D`: the setup card's top edge, the active mode tab underline, and the "Out of his book" note edge.
  - Flag gold `#FFCD00`: the star next to his name, the strength value and steps, the picked color tile's border (tint `#2F2A14`), and the "Book" badge (on `#3A3214`).
  - Olive `#BBBE64` (the board's dark square): the book note's left edge and the count bars.
  - Start green `#047A4F`, the app's Play green (5.38:1 with white text; darkened from `#059862` on 2026-10-10, see `docs/decisions.md`).
  - New colors go in as tokens in `src/index.css` `:root`, for example `--liem-red`, `--liem-gold`, `--book-bar`, next to the `--board-*` and `--clock-*` tokens.
- **Type:** Quicksand only (already loaded).
  - Card title: 22 / 700 (18 / 700 below 600 px, so it stays on one line).
  - Strength value: 28 / 700, in gold.
  - Labels: 16 / 700.
  - Body: 16 / 500.
  - Book counts and the badge: 15 and 14. These are the only text below 16 px, and they're secondary.
- **Layout:**
  - **Mode tabs** ("vs Liem" / "Two players") sit above the board, from B.
  - **The pre-game card**, from B, sits over the dimmed board (brightness 0.45). It shows his name with a gold star, "GM · Vietnam · 2732", three color tiles (White, Black, Random, each with a piece glyph), the 7 gold strength steps with the Elo shown large, and a green **Start game** button. A **New game** button reopens it.
  - **During the game**, from A, the sidebar shows his player card ("GM · playing 2100" plus a gold "★ Book · N" badge while in book), then the book note with move, bar and count rows, then your card.
  - **At 375 px** everything stacks: tabs, board, his card, book note, your card. The setup card fits within the board's square (312 px): below 600 px it uses less padding, shorter tiles, a 24 px Elo and 40 px strength steps.
- **Signature detail:** the flag colors. A red edge and gold star on the challenge card, and the book note's olive edge turning flag red with "He's on his own from here" when the game leaves his book.
- **Rules out:** chess.com-style character art and chat; a table-heavy explorer (look C); browser-default sliders and selects. Strength is the step control, not `<input type="range">` styling left at default.
- **Draft:** `docs/design-drafts/play-liem-look.html`. The mix: B for setup, tabs, the badge and the color tiles. A for the book note and the "Out of his book" state.

## Key decisions
- **Book first, Stockfish after.** Cloning a 2700 isn't proven: personal Maia models needed about 5,000 games, and GM attempts were "less successful". So the realistic version is his real openings plus a limited engine. — [research](../research/play-like-player.md)
- **Stockfish lite WASM, single thread, in a Web Worker.** It's about 1.7 MB, `UCI_Elo` covers 1320 to 3190, and it needs no special headers. The other options (our own TypeScript search, Maia, a personal model) and when to switch are in [opponent-engine-options](../ideas/opponent-engine-options.md). Add a `docs/decisions.md` entry when it lands.
- **The repo becomes GPL-3.0.** Stockfish is GPL v3, and the repo has no licence today. Add a `docs/decisions.md` entry.
- **Ship only move counts, never game files.** TWIC says "free for personal use only. All rights are reserved". The Lichess database is CC0. Raw PGN stays in a folder ignored by git, and the committed books hold only counts per position. This is a judgment call, not legal advice.
- **Two books, picked by the game's clock.** Slow (15 minutes or more) uses his over-the-board games, and faster clocks use his online games. When a line is thin (default: fewer than 3 games), he falls back to the other book. Each count records its source, so the split can change later.
- **Strength from 1400 to full, in 7 steps:** 1400, 1700, 1900, 2100, 2300, 2500 and full. Full means Stockfish's `UCI_Elo` set to his rating, 2732. The engine's floor is 1320. (default: the exact steps)
- **He moves at once.** The human chose this. A pause would only be a timer, so it's easy to add later if wanted.
- **Keep two-player mode** next to vs Liem. (default)
- **Color pick:** White, Black or Random each game, and the board flips when the human plays Black. (default)
- **Book depth:** follow his book as long as the position has games in it, with no fixed ply cutoff, and the panel and badge show the count. (default)
- **The import script runs by hand, not in CI,** and its output JSON is committed, so builds don't depend on outside APIs. (default)
- **A PGN parser is allowed in the script only** (for example `chess.js`, BSD-2). The app keeps its own rules engine. (default)
- **The player's data lives in one place:** name, title, federation, rating, avatar and book files sit in one player entry, so a second player is new data, not new code. (default)

## Known risks
- **Lichess or Chess.com may hold few games of his.** Mitigation: report game counts per source in the script output, and fall back between books.
- **Rate limits or API changes** on Lichess or Chess.com. Mitigation: the script runs by hand and its output is committed, so builds never call the APIs.
- **Stockfish's `UCI_Elo` is calibrated at 120s+1s,** so it plays differently at short think times. Mitigation: use a fixed node or time budget per move and smoke each strength step.
- **The WASM file and the base path:** `/chess-web/` and the worker URL may break in `vite build`. Mitigation: smoke with `npm run build && npm run preview`.
- **Legal-move mismatch** between Stockfish (UCI) and our engine (castling, en passant, promotion ids). Mitigation: convert through our `legalMoves` and reject anything not in it, with tests on special moves.
- **Bundle size:** about 1.7 MB of WASM plus the books. Mitigation: load the engine only when a vs-Liem game starts.

## Open questions
- **His Lichess username.** The FIDE link was given, but the script must resolve the actual account. If it can't, ask the human.
- **Over-the-board PGN:** the human downloads it into the ignored folder. The plan works with the online books alone if none is supplied.
- **How the opening counts are grouped** (by move order vs by position, which merges transpositions). Default: by position. The sprint planner may revisit this.

## Verification
- `npm run build && npm test` pass.
- `LICENSE` is GPL-3.0, and the README credits Stockfish and the game sources.
- The committed book JSON holds no raw game data: no player names of opponents, no dates, no full move lists.
- The import script runs from a clean checkout. It prints game counts per source and writes both books.
- In `npm run preview` at `/chess-web/`:
  - Start vs Liem as White at each strength step, then as Black, where the board flips. He replies with no fake delay.
  - While the position is in his book, his moves come from it, and the badge and panel show matching counts.
  - After the game leaves his book, the panel shows "Out of his book", and the moves still come and are legal.
  - Castling, en passant, promotion and checkmate all work against him.
- A slow clock uses the slow book, and a fast clock uses the online book. A unit test proves the fallback on a thin line.
- Two-player mode passes the existing smoke recipe unchanged.
- The pre-game card, tabs, badge and book note match the Look tokens at desktop size and at 375 px.
- The move choice sits behind one interface, and a test runs it with a fake engine.
