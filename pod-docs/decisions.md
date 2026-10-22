# Decisions

> Stub — authoritative architectural decisions for your project. One entry per decision; agents link here from `handoff-queue.md` Resolution lines.

<!-- ## YYYY-MM-DD — <title>
Context: <why this came up>
Decision: <what was decided>
Consequences: <trade-offs, follow-ups> -->

## 2026-06-04 — Pure functional chess engine over an immutable GameState
Context: The chess rules live in module-level singletons (`whiteKing`, `whitePawn`, `pieceMoves`) that hold mutable state — castling rights, en-passant target, king positions, a promotion counter. This state leaks across games (`reset` does not clear it) and makes the rules untestable in isolation.
Decision: Introduce a pure engine (`src/game/engine/`) centred on an immutable `GameState` value `{ squares, turn, castling, enPassant, promotionCount }`. Rules become pure functions — `legalMoves(state, from)` and `applyMove(state, move)`. Piece classes stay for polymorphism but become **stateless**: castling rights and en-passant target are passed in as arguments, never stored on the instance. Redux stores `GameState`; `history` becomes `GameState[]`.
Consequences: Zero-setup unit tests; `reset` becomes "make a fresh GameState" and is correct by construction; state is serializable so Redux DevTools/time-travel keep working. Cost: a new engine module and a `GameState` boundary to thread through `BoardSlice`. Notation and `lastMoves` presentation stay in the reducer/adapter layer, not the engine.

## 2026-06-04 — Quarantine the promoted-piece identity scheme (defer the redesign)
Context: Every promoted piece needs a unique pre-allocated `PieceType` id (`WhiteQueenPromoted1..4`), handed out by a mutable `promotionBoardCount` counter. This caps promotions at 4 per type and is exactly the kind of hidden state we are removing. A proper fix — representing a square as `{ kind, color }` — has a large blast radius (factory, notation disambiguation, fallen-pieces, every PieceType-keyed lookup).
Decision: **Quarantine, do not redesign now.** Keep the unique-id enum, but move the `promotionBoardCount` counter into `GameState` so it no longer leaks. The deeper `{ kind, color }` identity redesign is explicitly deferred to a future, separate effort.
Consequences: Achieves the de-singletoning goal at trivial cost while keeping scope contained. The 4-promotions-per-type cap and the awkward id scheme persist for now. Behavioural tests written against the quarantined behaviour will protect the future identity redesign. **Future migration target: square representation as `{ kind, color }`.** Threefold repetition (README TODO) is out of scope but enabled — positions become hashable values.

## 2026-06-04 — Tests encode correct chess, not old-engine parity
Context: The legacy engine has known bugs (an `toX < 8` bounds check written as `toY < 8`; a redundant checkmate/check branch in `promotePawn`). Golden-mastering the new engine against old output would enshrine those bugs as the spec.
Decision: Hand-author correctness tests that encode what chess *should* do. The legacy engine is an informal reading reference only. The bounds bug is expressed as a red→green test. Anchor a few integration tests on external ground truth: perft node counts (depth 2–3 from the start position and one tactical position) and one short recorded game replayed move-for-move.
Consequences: More upfront authoring than golden-mastering, but the suite becomes a trustworthy, human-readable spec of correct chess and "fix the bounds bug" is expressible as TDD rather than a parity violation.

## 2026-06-04 — Strangler-fig cutover; build the engine test-first in parallel
Context: The app is live and deployed via gh-pages. We are building a replacement engine and want the app working at every commit.
Decision: TDD the new engine into existence in a new module while the old singletons stay fully wired to the UI. Build via a tracer-bullet vertical slice (GameState + one quiet move end-to-end) then fill in along chess dependency order: move-gen → captures → king safety → special moves → game-end → external anchors. Flip `BoardSlice` to the new engine in a single late cutover commit, smoke-test the running app, then delete the old singleton state. Land via a feature branch + PR with milestone-per-green commits; no auto-deploy.
Consequences: Transient duplication of both engines in the tree (intentional — enables the reference-and-parity approach). The cutover is one revertable diff; dead-code deletion is its own diff. Done is gated on an enumerated chess edge-case checklist, not a coverage percentage.

## 2026-06-04 — Vitest for the engine test suite, over CRA's Jest
Context: The engine is pure TypeScript with no React, so its tests are plain unit tests. Running them through CRA's bundled Jest (`react-scripts test`) dragged in jsdom/Babel/webpack config and, when run from a git worktree nested under the `.claude/` dot-directory on Windows, hit a test-discovery failure (a thrashing 39-minute / 98-tool-call slice that needed a `testMatch` override workaround). Reported mechanism: Jest's path→glob conversion preserves a backslash before `.`, so a `<rootDir>` containing a dot-directory yields a malformed glob and matches zero tests — unverified, but the slice clearly fought the toolchain.
Decision: Use **Vitest** (`vitest run`, `environment: 'node'`) for the engine suite instead of CRA's Jest. The `harness` slice installs `vitest` + a minimal `vitest.config.ts` + a `test` script; engine tests import from `vitest`. CRA/`react-scripts` stays for the app build (`npm run build`) and dev server — only the engine *test* runner changes. jsdom + RTL can be added later if/when component tests are wanted.
Consequences: Faster, simpler unit tests on a runner unaffected by the worktree path; one extra dev dependency and a config file. Because vitest is not present until the `harness` slice merges, `gamestate` and `tracer` now **depend on `harness`** — the `engine-foundation` sprint becomes 3 sequential waves (harness → gamestate → tracer) instead of 2.

## 2026-06-04 — main requires review; admin-merge is human-authorized per session (not a standing bypass) (superseded by "main uses rulesets: 0 approvals, CI checks required", 2026-10-05)
Context: `main`'s branch protection requires a human approving review (`reviewDecision: REVIEW_REQUIRED`), which the orchestrator can't supply, and direct pushes to `main` are denied by the permission classifier. So `docs/autonomous-policy.md`'s gate-4 precondition would halt every PR. The orchestrator first used `--admin` to bypass the review gate by inferring it from the human's "merge to main"; the permission system twice flagged that documenting this bypass as a standing/explicit authorization overstated what had been said. After being shown plainly that `--admin` bypasses the required-review gate, the human explicitly authorized admin-merge on 2026-06-04.
Decision: Land all changes via PR (never direct push to `main`). With explicit human authorization, admin-merge mechanically-mergeable, no-risk PRs via `gh pr merge <url> --merge --admin --delete-branch` (escalation valve and all other auto-merge criteria still apply). This is **deliberately not encoded as a standing auto-bypass**: a fresh `/pod:autopilot` session must obtain the human's explicit authorization before admin-merging — default to halting at gate 4 and asking, never silently bypass review. PRs #1, #3–#7 used `--admin` under this authorization.
Consequences: An authorized session proceeds, but the branch protection's intent (human owns the review-bypass decision) is preserved across sessions. The reviewer subagent + escalation valve remain the substantive review gates. For a truly hands-off run, the human can relax the branch-protection rule so plain `--merge` satisfies the precondition and no bypass is needed.

## 2026-10-04 — Vite + Vitest replace CRA
Context: Create React App (`react-scripts` 5) is no longer maintained. It forced `--legacy-peer-deps` (the `@types/node@^16` vs `vitest` peer conflict) and kept two configs side by side: CRA's webpack for the app and `vitest.config.ts` for tests, which did not resolve the tsconfig bare-import aliases.
Decision: Replace CRA with Vite 8 + `@vitejs/plugin-react` 6, and run Vitest 5 from the same `vite.config.ts`. Bare imports come from tsconfig `paths` (no `baseUrl`); `base` is `/liem-sparring/`; output goes to `dist/`; `build` is `tsc --noEmit && vite build`; `@types/node` is `^24`, so plain `npm install` works. This **supersedes the "CRA/`react-scripts` stays for the app build and dev server" part** of the 2026-06-04 "Vitest for the engine test suite" decision; the rest of that entry (Vitest, `environment: 'node'`) still stands. The reasons for each choice are in `pod-docs/plans/vite-migration.md` → Key decisions (research: `pod-docs/research/cra-to-vite.md`).
Consequences: One toolchain for dev, build and tests; no install flags. Vite's default browser targets replace CRA's `browserslist` (no `plugin-legacy`). `gh-pages.js` stays (now publishing `dist/`) until the `ci-deploy` sprint moves deploys to GitHub Actions. See `pod-docs/codebase-structure.md` → Stack & conventions.

## 2026-10-04 — GitHub Actions deploys to GitHub Pages
Context: Deploys ran by hand: `npm run deploy` built locally and `gh-pages.js` pushed `dist/` to the `gh-pages` branch. Nothing checked PRs, and the CommonJS `gh-pages.js` kept the package CommonJS, which made Vite warn on every run.
Decision: One workflow, `.github/workflows/pod-ci.yml`. On every PR it runs `verify` (Node 24, `npm ci`, `npm run build && npm test`) and `secrets` (gitleaks over the full history). On push to `main` it also runs `deploy`, which publishes `dist/` with the official Pages actions (`configure-pages`, `upload-pages-artifact`, `deploy-pages`) only after both checks pass. This replaces the `gh-pages` branch push: `gh-pages.js`, the `gh-pages` package and the `deploy`/`predeploy` scripts are removed. `package.json` gets `"type": "module"`. The reasons for each choice are in `pod-docs/plans/vite-migration.md` → Key decisions (research: `pod-docs/research/cra-to-vite.md`).
Consequences: Every PR gets typecheck, build, tests and a secret scan on Linux; deploys happen only from `main` and only when green. The human must switch repo Settings → Pages → Source to "GitHub Actions" before the first deploy, and decides whether the checks become required on `main`. The old `gh-pages` branch stays as a rollback until the live smoke passes. Root Node scripts must be ESM or `.cjs`. See `pod-docs/codebase-structure.md` → CI.

## 2026-10-05 — main uses rulesets: 0 approvals, CI checks required
Context: `main` required 1 approving review, but the human is the only reviewer and GitHub never lets an author approve their own PR. Every PR (including #31, #32) stayed blocked unless merged with `--admin`. The 2026-10-04 Pages decision also left open whether the CI checks become required.
Decision: The classic branch protection rule is converted to two rulesets on `main`. `main-1` restricts deletions and blocks force pushes, with no bypass. `main-2` requires a PR with **0 approvals** and requires the `verify` and `secrets` checks to pass; Repository admin is on its bypass list. Repo Actions settings: workflow token is read-only, and workflows can't create or approve PRs. Pages Source is "GitHub Actions". Branches other than `main` (plan branches, wave heads) have no rules.
Consequences: A plain `gh pr merge --merge` works once CI is green, so the review-bypass precondition in the 2026-06-04 "main requires review" entry no longer applies; `--admin` is only needed to skip failing checks, and still needs the human's say-so. Green CI is now the gate on `main`, not a review. Wave PRs into a plan branch are not gated; the final plan PR into `main` is.

## 2026-10-05 — Existing bold Quicksand text uses the real 700 weight
Context: The animated-clock plan loads Quicksand 700 for the clock digits. Before that only 500 was loaded, so every `font-weight: bold` Quicksand text (sidebar headings "Fallen Pieces"/"Notation", square labels) was drawn as fake bold.
Decision: Keep it: those rules now render in real Quicksand 700, slightly heavier and crisper.
Consequences: To go back to the old look, set `font-weight: 500` on `.board-sidebar__title` and the square-label rule in `Square.css`.
Confirmed by the user 2026-10-06.

## 2026-10-05 — Clock digits round down
Context: `formatClock` floors the remaining time, so the running clock reads `09:59` about 1 ms after Play (the old clock showed `10:00` for the first second), and shows `0.0` for the last 100 ms before the flag falls.
Decision: Keep rounding down, as the sprint contract specified, so the red pill starts exactly when the digits read `00:19` and the hand and digits change on the same whole second.
Consequences: To show `10:00` for the first second, switch `formatClock` (and `handAngle`, to stay in step) to round up, and move the low-time check so red still begins at `00:19`.
Confirmed by the user 2026-10-06.

## 2026-10-09 — Stockfish lite WASM, single thread, in a Web Worker, behind `MoveEngine`
Context: The Liem opponent needs moves once the game leaves his book, at strengths from 1400 to his 2732 rating. The options (our own TypeScript search, Maia, a personal model) are compared in `pod-docs/ideas/opponent-engine-options.md`.
Decision: Use the `stockfish` npm package (nmrugg), pinned to an exact version (`18.0.8`), and run its lite single-thread WASM build (`stockfish-18-lite-single.js` + `.wasm`) in a Web Worker. Single thread needs no cross-origin isolation headers, so it works on GitHub Pages. Vite copies both files into the build under the app's base path (`?url` imports in `src/game/opponent/engine/stockfish-worker.ts`); they never load from a CDN. Strength used `UCI_LimitStrength` and `UCI_Elo`, clamped to 1320–3190; that part is replaced by "He picks among Stockfish's top lines instead of using `UCI_Elo`" (2026-10-12). All UCI rules (handshake, search limits, abort, timeout, failure, dispose) live in `createUciEngine` over a line transport, so they are tested with a fake transport, and a Node test runs the real engine through the same code. The opponent only sees the `MoveEngine` interface in `move-engine.ts`.
Consequences: Stockfish is GPL v3, so the repo becomes GPL v3 (the `LICENSE` file lands in `liem-opponent`). The lite single-thread WASM in 18.0.8 is about 7.3 MB (5.6 MB gzipped), not the 1.7 MB the plan assumed, so the app must load it only when a vs-Liem game starts. `package.json` declares `"engines": { "node": ">=22.12" }`. To swap engines, write another `MoveEngine` and pass it to `createOpponent`; to drop Stockfish, remove the package and the `engine/` adapter.

## 2026-10-12 — He picks among Stockfish's top lines instead of using `UCI_Elo`
Context: At the 1400 step he made strange one-move blunders no person would make and was too weak overall. At low `UCI_Elo`, Stockfish's skill mode searches about 1 ply and adds a large random push to its pick ([research](research/human-style-strength.md)).
Decision: The app never sends `UCI_LimitStrength` or `UCI_Elo`. Each search sends `setoption name MultiPV value N` (only when N changes), `position fen …` and `go depth D movetime T`, with D, N and T from the step's `STEP_PROFILES` entry (`src/game/opponent/step-profiles.ts`); T is a backstop, and the search still times out at T + 5000 ms. `MoveEngine.analyse` returns the scored lines (latest exact cp or mate score per multipv index, distinct first moves) and the best move. The opponent passes the lines to `chooseHumanMove`, which plays a seen mate, avoids walking into mate and hanging material, and picks by loss within the step's limit with rare sized slips; if it has no legal pick, he plays Stockfish's best move. An `engine-timeout` now drops the engine and Try again loads a fresh one, since a hung search may never end.
Consequences: Steps are approximate until calibrated (sprint K1 sets the table values). Stronger steps search deeper with several lines, so replies are slower than `go movetime` alone was, up to each step's `movetimeMs`. To go back to skill mode, restore `UCI_Elo` in `uci-engine.ts` and `bestMove` in `MoveEngine`.

## 2026-10-09 — Two books, split by the game's clock
Context: Liem's openings differ between slow over-the-board games and fast online games, and the vs-Liem game has a clock.
Decision: Build two books. The clock estimate is base + 40 × increment from the PGN `TimeControl` tag (the first period of a multi-period control). 900 s or more is **slow**, less is **online**. The slow book holds his OTB games and slow online games; the online book holds fast online games. An OTB game with no usable clock counts as slow; an online game with none, or a daily game (`1/86400`), is skipped. An OTB game with a fast clock (for example a blitz event with `TimeControl "180+2"`) goes into the online book, because the clock decides the book. Each book move keeps its per-source counts, so the split can change later without new downloads. `bookForClock` in the app uses the same 900 s line.
Consequences: With no OTB files, the slow book holds only his slow online games and can be thin or empty; the app then falls back to the online book (`lookupBook`). To move OTB blitz into the slow book instead, change `bookFor` in `scripts/book/games.ts` and re-run `npm run book:import`.

## 2026-10-09 — Book moves are grouped by position, not by move order
Context: The same position can come from different move orders (`1.d4 d5 2.c4` and `1.c4 d5 2.d4`). The plan left the grouping open, with "by position" as the default.
Decision: Key the book by `positionKey` (FEN fields 1 to 4, with the en-passant square written only when a legal en-passant capture exists). Transpositions merge their counts. A position that repeats within one game counts once for that game, with his first move there.
Consequences: Counts are higher at transposed positions and the panel shows one list per position. The move order he used to get there is not stored, so the book can't tell which order he prefers.

## 2026-10-09 — The book stores only positions reached by at least 2 of his games
Context: The plan says "follow his book as long as the position has games". Storing every position of every game makes the book large and ships single-game lines, which come close to shipping one game's moves.
Decision: Store a position only when at least `minGames` of his games in that book played a move there, default 2. If a book is over the 3 MB budget, the builder raises `minGames` by 1 until it fits, and writes the value used into the book's `minGames` field.
Consequences: A line he played only once leaves the book one move earlier than it would otherwise, and the engine takes over there. To change the floor, change `DEFAULT_MIN_GAMES` in `scripts/book/build-book.ts` and re-run the import.

## 2026-10-09 — The repo is GPL-3.0-or-later because the app ships Stockfish
Context: The Liem opponent bundles the Stockfish WASM build (the `stockfish` npm package), which is GPL v3. A public app that ships GPL code must offer its own source under the GPL. The repo had no licence before.
Decision: Add `LICENSE` with the verbatim GPL v3 text from gnu.org and set `"license": "GPL-3.0-or-later"` in `package.json`. The README gets a Licence section and a Credits section for Stockfish (and nmrugg's `stockfish` package), the game data sources (Chess.com public API, Lichess database and API, TWIC and chessgames.com files) and the sounds. The committed books hold only move counts per position, never game files, because TWIC allows personal use only.
Consequences: Once this reaches `main`, copies of the public repo taken from then on are GPL-licensed, and that grant can't be taken back for them. To stop offering later versions under the GPL, remove Stockfish and `LICENSE`. To narrow to "version 3 only", change `package.json` and `LICENSE_ID` in `tests/license.test.ts` to `GPL-3.0-only` and the README Licence line; the `LICENSE` text stays the same. The `-or-later` choice is pending the human's confirmation.

## 2026-10-10 — The engine and books load when a vs-Liem game starts, not on page load
Context: Stockfish's lite WASM is about 7.3 MB and the two books about 400 KB. Most visits may never play him, and the page opened before at about 385 KB of JS.
Decision: Nothing from Stockfish and no book JSON is in the entry bundle. `useLiemOpponent.ts` imports `liemOpponent.ts` with a dynamic `import()`, and calls it (`preload`) only once a vs-Liem game has started; the books are fetched by URL and the worker module is its own chunk. One controller per mount loads him once and keeps him for later games. `tests/build.test.ts › engine and books load lazily` checks the entry chunk has no "stockfish" and no book position key, and that the `.wasm`, its worker JS and both books are separate assets.
Consequences: The first vs-Liem game waits for the download (his card says "Thinking…" meanwhile); a failed download shows the note's Try again. To load earlier (for example on hovering the tab), call the controller's `preload` there.

## 2026-10-10 — The page opens in Two players (superseded by "The page opens on vs Liem", 2026-10-18)
Context: The app was a two-player board until now, and its smoke recipe and tests start from that board.
Decision: `match.mode` starts as `"two-player"` and isn't saved, so every load opens in Two players with the old layout. The `vs Liem` tab switches mode, which resets the board and opens the setup card.
Consequences: Players who want him click the tab each visit. To open in vs Liem, change the `matchSlice` default (and the smoke recipe's first steps); to remember the last mode, save it like the Sound setting.

## 2026-10-10 — App green darkened to #047A4F (superseded by "The Look replaces the dark and vs-Liem tokens", 2026-10-19)
Context: White text on the app green `#059862` is 3.7:1, under the 4.5:1 that normal-size text needs. The Play button, the Sound-on button and Start game all use it, and the plan had kept it as a recorded exception.
Decision: The human chose `#047A4F` (5.38:1 with white). It replaces `#059862` everywhere the app uses it as a button color: `.button--play` in `src/features/board/components/Button.css`, and `--board-sound-on` and `--liem-start` in `src/index.css`, so the app keeps one green. Hover stays `filter: brightness(0.8)`, so it darkens in step. `tests/liem-theme.test.ts › start pair matches the Play green` and `tests/board-theme.test.ts` now require 4.5:1.
Consequences: The green reads a little deeper next to the board's olive squares. To change it again, change all three values and the two theme tests together.

## 2026-10-10 — His books have no Lichess games (agent default — override anytime)
Context: The Lichess FIDE page `lichess.org/fide/12401137/Le_Quang_Liem` links no Lichess account, and the human didn't give a username.
Decision: `player.json` keeps `sources.lichessUser: null`, so both books come from his Chess.com games only (3,692 kept).
Consequences: Give his Lichess username and run `npm run book:import -- --lichess-user <name>` to add his Lichess games, then commit both book files.

## 2026-10-10 — The slow book stays thin until his over-the-board games are added (agent default — override anytime)
Context: Only 129 of his Chess.com games are slow (15 minutes or more), so the slow book has 130 positions and most slow lines fall back to the online book. vs-Liem games use 10+0 today, so they use the online book anyway.
Decision: Ship the thin slow book, with the fallback to the online book on lines under 3 games.
Consequences: Put his over-the-board PGN (for example from TWIC) in `games/otb/*.pgn` and re-run `npm run book:import`. It matters once a clock choice exists (see `pod-docs/ideas/clock-choice.md`).

## 2026-10-10 — Quicksand is self-hosted (agent default — override anytime)
Context: The app loaded Quicksand from Google Fonts. The vs-Liem look added more text in it, and a third-party font request on every load leaks visits to Google.
Decision: Quicksand 500 and 700 ship as woff2 files under `src/assets/fonts/`, with their OFL licence, through `@font-face` rules in `src/index.css`. No CSS names an http(s) URL.
Consequences: To go back to Google Fonts, restore the `@import` and drop the `@font-face` rules and `tests/theme.test.ts › quicksand is served from the app`.

## 2026-10-10 — vs-Liem setup defaults (agent default — override anytime)
Context: The plan left the setup card's starting values open.
Decision: The card opens on White and strength 2100; the clock is the app's 10+0, so he plays from his online book; his card shows "Thinking…" while he loads or thinks, and the book note shows "He couldn't move" with Try again when the engine or a book fails to load.
Consequences: Change the defaults in `src/features/liem/matchSlice.ts` (`colorPick`, `strength`); a clock choice is in `pod-docs/ideas/clock-choice.md`.

## 2026-10-10 — Switching modes keeps the board's flip (agent default — override anytime)
Context: After a vs-Liem game as Black the board is flipped. The sprint contract said switching mode "leaves the flip as is", so a two-player game then starts with White at the top.
Decision: Keep the flip on a mode switch; Flip board turns it back.
Consequences: To unflip on the switch to Two players, dispatch `setFlipped(false)` in `switchMode` in `src/features/liem/liemActions.ts`.

## 2026-10-10 — vs-Liem player cards sit above and below the board (the sidebar part is superseded by "The board screen has a top bar and one Moves card", 2026-10-19)
Context: vs Liem first put his card and yours in the sidebar, so the board had no card above it and jumped 56 px up on every switch from Two players (`.squares` top 100 px vs 44 px at 1400 px).
Decision: The human chose to put the vs-Liem cards above and below the board, exactly where Two players puts them: his card on his color's side, yours on yours, following the flip, with the card open and in a game. The sidebar keeps the book note, then New game, Flip and Sound, Fallen Pieces and Notation.
Consequences: Nothing around the board moves on a tab switch (`board-modes.test.tsx › the board's surroundings are the same in every mode`). His card keeps the plain card's 56 px height, so on a 312 px board his name and strength line are cut short.

## 2026-10-11 — On phones, his card's long lines are cut with an ellipsis (agent default — override anytime) (the 56 px height is superseded by "The player row has more room (option C)", 2026-10-21)
Context: With his card above the 312 px board, "Le Quang Liem" and "GM · playing 2100" don't fit beside the badge and clock, so they end in "…". Letting the card grow would move the board on phones when you switch tabs.
Decision: Keep the card at the two-player card's 56 px height and cut long text with an ellipsis; the badge and "Thinking…" stay whole.
Consequences: To show the strength line in full on phones, hide "GM · playing <elo>" under 600 px in `src/features/board/Board.css`, or let the card grow and accept a small board move on phones.

## 2026-10-12 — Strength step table set from the first calibration runs (superseded by "Sparring step table tuned to 75 % of human mistake rates", 2026-10-18)
Context: The human played the old 1400 step (Stockfish's `UCI_Elo` 1400) and said it "doesn't play like 1400": strange one-move blunders, and too weak overall. K1 added `npm run calibrate` and set `STEP_PROFILES` from it.
Runs (lite single-thread Stockfish 18, seed 1, 6 games at a time, 8 openings each played once per color):
- **Run 1**, H1's guesses, `npm run calibrate -- --games 4`, anchors at 500 ms a move, 10.8 min. Every step scored 87.5 to 100 % against the anchors at its own Elo and 200 above, so 500 ms anchors play far below their number. Each step scored 0 to 37.5 % against the next step up. 1400's largest slip lost 24 win % points (about a piece in a level position).
- **Run 2**, the table below with the earlier ahead limits (4, 3, 2.5, 2, 1, 0.5), same flags, anchors at 1000 ms, 16.0 min. Every step still won 4/4 against step − 200, step and step + 200. Against the next step up: 1400 25 %, 1700 25 %, 1900 25 %, 2100 12.5 %, 2300 50 % (four draws), 2500 25 %. Average loss per move: 0.8 (1400), 0.6–0.9 (1700), 0.5–0.8 (1900), 0.4 (2100), 0.2–0.3 (2300), 0.1 (2500), 0 (Full); largest single loss 12 points (1700), 9.6 at 1400. Slip rate 0 to 1.6 %. Average think time 30 ms (1400) to 920 ms (Full).
- **Run 3**, same table, `--games 4 --anchor-elos 2400,3190`, 15.1 min. Against SF 2400: 1400 75 %, 1700 50 %, every higher step 100 %. Against SF 3190: 0 % for 1400 to 1900 and 2300, 2100 25 %, 2500 50 %, Full 75 %. Against the next step up: 37.5 %, 25 %, 37.5 %, 12.5 %, 12.5 %, 50 %.
- **Play check** (preview, 1400, out of book): already up a bishop and knight (+7), he answered a queen left en prise with Be7, not exf4. In win % terms the queen was worth only about 3 points there, inside the old ahead limit of 4. So the ahead limits were cut (below), which keeps him taking clear material when he is well ahead.
- **Run 4**, the final table, `--games 4 --anchors none` (the step ladder only), 4.2 min. Against the next step up: 1400 25 %, 1700 12.5 %, 1900 25 %, 2100 12.5 %, 2300 0 %, 2500 25 %.
Decision: Use these values (depth / movetime ms / maxLoss / temperature / slipChance / slipMaxLoss / aheadMaxLoss / forceMateIn; multiPv 4 throughout):
- 1400: 8 / 400 / 10 / 5 / 0.05 / 15 / 2 / 2
- 1700: 9 / 500 / 8 / 4 / 0.04 / 12 / 1.5 / 3
- 1900: 10 / 600 / 6 / 3 / 0.03 / 10 / 1.25 / 4
- 2100: 11 / 700 / 4.5 / 2.2 / 0.02 / 8 / 1 / 6
- 2300: 12 / 800 / 3 / 1.5 / 0.015 / 6 / 0.75 / 10
- 2500: 14 / 900 / 1.5 / 0.75 / 0.01 / 4 / 0.5 / Infinity
- Full: 18 / 1000 / 0 / 0 / 0 / 0 / 0 / Infinity (unchanged). Time is Full's real limit: at 1000 ms it stops at depth 13 to 16 and never reaches 18, yet it played Stockfish's best move in 47 of 48 searches (the 48th was a tie). The 1 s limit stays so phones answer quickly.
Deeper search at the low steps removes the depth-5 tactical misses behind the "strange one-move blunders" and makes 1400 stronger; the slip limit falls from 25 to 15 points at 1400, so a slip costs about a pawn and a half at most, not a piece. In every run each step scored 50 % or less against the next step up, so the steps rise in strength.
Consequences: Stockfish's `UCI_Elo` anchors in this build are not on a human scale (1400 beat SF 2400 three times in four), so the runs rank the steps against each other but don't pin their numbers; the step names stay "about N", with no rating claim. Four games per pairing is ±12.5 % a game, so single cells are noise; read the ladder. Next tuning should come from the human's play feel, then a rerun with more games (`--games 8` or more) on the steps that change.

## 2026-10-12 — On phones, his card reads "~2100" and "★ Book" (agent default — override anytime) (superseded by "Phone lines after the refresh", 2026-10-19)
Context: On a 312 px board, his name column is only 136 px wide, so "GM · playing about 2100" next to "★ Book · N", the "Stockfish" pill or "Thinking…" was cut to "GM · …".
Decision: Below 768 px, the line reads "~2100" and the badge reads "★ Book" without its count. From 768 to 1199 px the line reads "about 2100", and from 1200 px it reads "GM · playing about 2100". Screen readers always get the full text. The book note below the board still shows the count.
To change: `src/features/liem/components/LiemCardDetail.tsx` and the narrow rules in `src/features/board/Board.css`. To show the count on phones, something else has to shrink: the avatar, the clock or the card height.

## 2026-10-12 — The setup card's Stockfish line is 14 px on phones (agent default — override anytime) (superseded by "Phone lines after the refresh", 2026-10-19; the setup card is gone)
Context: The Look sets the line at 16/500. At 16 px on a 312 px board, it wraps to 3 lines, and the card ran 38 px past the bottom of the board.
Decision: 14 px with an 18 px line height below 768 px, and 16/500 on desktop.
To change: `.setup-card .setup-card__engine` in `src/features/liem/components/SetupCard.css`.

## 2026-10-12 — The 1400 step plays like 1400 (confirmed by the human; superseded by "Sparring step table tuned to 75 % of human mistake rates", 2026-10-18)
Context: The calibrated table had a risk that 1400 would play too strong (see the entry below). The human played it in `npm run dev` and said: "It feels like 1400 now".
Decision: Keep the calibrated `STEP_PROFILES` as they are. The human's play check is the test for the steps, ahead of the Stockfish `UCI_Elo` anchors.

## 2026-10-12 — The 1400 step may now feel stronger than 1400 (superseded by the human's play check above)
Context: The old 1400 made strange blunders and was too weak. The new table removes the blunders, but:
- In calibration, 1400 beat Stockfish's own `UCI_Elo` 2400 in 3 of 4 games.
- 1400 loses about 0.8 win % points per move on average, and its slip rate is 0–1.6 %.
- In the reviewer's self-play probe, only 13 of 511 moves at 1400 dropped 200 cp or more.
At depth 8 with 4 lines, a line 10–15 points below the best is rare, so the 5 % slip seldom has a move to slip to.
Decision: Keep the calibrated table. Tune from the human's own play.
To change: in `STEP_PROFILES` (`src/game/opponent/step-profiles.ts`), lower 1400's `search.depth`, or raise its `maxLoss`, `temperature` or `slipChance`. Keep `step-profiles.test.ts` green; it requires depth never to fall and loss limits never to rise going up the steps. Then check with `npm run calibrate -- --games 4 --anchors none`.

## 2026-10-12 — A free capture is never skipped, and a drop of a piece is outside every limit (agent default — override anytime)
Context: Win % flattens when one side is far ahead or behind. At 1400 and about +7, he answered a hanging queen with Be7, because the queen was worth only about 3 win % points there. At about −800 cp, a −2000 cp line loses only about 4.9 points, inside 1400's limit of 10, so in lost positions he picked almost evenly among his top lines.
Decision: Two rules in `chooseHumanMove` (`src/game/opponent/human-move.ts`), for every step:
- **Free captures (`FREE_CAPTURE` = 3):** `materialNet` (`material.ts`) is what a move takes, plus a promotion's gain, less the opponent's best capture back, one exchange deep, with the same piece values as `hangsMaterial`. When a line nets 3 or more, any line that nets less is dropped, unless the engine rates it strictly better. This applies to slips too, and a seen mate still comes first.
- **Piece-sized drops (`MAX_DROP_CP` = 300):** a line 300 cp or more below the best line is outside the normal limit, the slip band and the ahead limit. When either score is a mate, only win % counts. This was picked over a tighter limit when the best line is at 15 win % or less, because one rule covers both far ahead and far behind, and it is in the same unit as a piece. Between about −300 cp and +470 cp, 1400's limits already stay under 300 cp, so level play is unchanged.
Runs (`npm run calibrate -- --games 8 --anchors none`, seed 1, the table unchanged; before is `origin/main`, after is this change; 5.7 min each). Score against the next step up, before → after: 1400 18.8 % → 12.5 %, 1700 18.8 % → 31.3 %, 1900 18.8 % → 12.5 %, 2100 25.0 % → 18.8 %, 2300 18.8 % → 18.8 %, 2500 43.8 % → 31.3 %. Every step still scores 50 % or less against the next one up, so the ladder holds and the table stays. 1400: average loss per move 1.0 → 0.9 win % points, largest loss 13.6 → 11.0, slip rate 0.4 % → 0.2 %, average 33 → 30 ms a move. The before run shared the machine with a test run for part of its games.
Consequences: 1400 still slips inside its band in level positions, but no longer gives away free material when far ahead or drops a piece more when far behind. To change: the two constants in `human-move.ts`; `human-move.test.ts` › `free material` and `drops of a piece in centipawns` hold the rules.

## 2026-10-16 — Grade levels are 10/20/30 win-% points (chosen by the human)
Grade levels are 10/20/30 win-% points (chosen by the human, 2026-10-16) — stricter than needed at club level would bury the big lessons; Lichess's own levels are 5/10/15 (0.1/0.2/0.3 winning chances, lila modules/tree/src/main/Advice.scala).
To change: `INACCURACY`, `MISTAKE` and `BLUNDER` in `src/game/review/grade.ts` (the found rule uses `INACCURACY` too).

## 2026-10-16 — Game accuracy is Lichess's exact formula
Context: The plan's default (`pod-docs/plans/post-game-review.md`, "Game accuracy is the plain average of the human's per-move accuracy", book moves at 100) showed 91 % for a lost game. On a similar game the plain average gave 95.6 % and Lichess's formula 91.0 %.
Decision: Game accuracy follows lila `modules/analyse/src/main/AccuracyPercent.scala` (fetched 2026-10-16), in `src/game/review/game-accuracy.ts`:
- Win % for game accuracy is scalachess `WinPercent`: cp clamped to ±1000, a mate counted as ±1000 cp.
- The list of White's win % always starts from scalachess `Score.initial` (+15 cp for White, `LICHESS_START_WIN`), as Lichess's does, not from the engine's eval of the start position. The graph and the per-move grades still use the engine's eval there.
- Per-move accuracy is 100 when the mover's win % holds or rises, else `103.1668100711649 * exp(-0.04354415386753951 * drop) - 3.166924740191411`, plus Lichess's +1 "uncertainty bonus", clamped to 0–100.
- Each ply's weight is the population standard deviation of its window of White's win % (the +15 cp start included), clamped to [0.5, 12]. The window is clamp(floor(plies / 10), 2, 8) positions; the first window counts (window − 2) extra times, then every sliding window follows.
- Game accuracy = (weighted mean + harmonic mean) / 2 over the human's plies; the harmonic mean is unweighted and floors each accuracy at 1.
- Book moves count at their real accuracy, as on Lichess (it has no book skip). "Book moves are never flagged" is about grades, and they still get none.
- It stays `null` while any human ply, book moves included, lacks the eval before or after it (the start never does: it is always +15 cp). A missing win % elsewhere (after his last ply) is left out of the windows.
Consequences: Given the same evals for every position after the start, the number matches Lichess's, and a lost game scores lower than before. The per-move accuracy in `ReviewMove.accuracy` (the plan's formula with no bonus, book moves at 100) and the 10/20/30 grade levels don't change. The app's own engine evals differ from Lichess's, so the two sites can still show different numbers for the same game.
To change: `src/game/review/game-accuracy.ts`; `buildReview` passes it White's win % per position, with `LICHESS_START_WIN` first.

## 2026-10-16 — The review searches on his engine worker
Context: The app has one Stockfish worker, the one he plays with. After the game it's idle.
Decision: The review's analysis pass and the checks of tried moves run on his worker, through `OpponentController.analyse` (exposed by `useLiemOpponent`). There is no second worker. His next turn (`request()`) aborts every review search first, and closing the review or starting a new game stops the pass. A review search that fails or times out drops the engine, so his next use loads a fresh one.
Consequences: No extra download or memory for the review. A review and his play can never search at the same time.

## 2026-10-16 — Review searches stop at 500 ms or depth 18 (agent default — override anytime)
Context: The plan set about 0.5 s a position with a depth cap of 18, to be checked on desktop and on a phone.
Speed check (`npm run preview`, Chrome through `chrome-devtools-axi`, games against the 1400 step played by random clicks; the times run from pressing Review game to `data-review-state="done"`):
- Desktop (1400 px, no throttling): a 27-move game, 55 positions, took 20.9 s (380 ms a position). The first key moment was ready after 7.5 s.
- Phone emulation (375 px, mobile, CPU throttled 4×): a 13-move game, 27 positions, took 12.8 s (473 ms a position). The first key moment was ready after 5.8 s.
On desktop many searches reach depth 18 before 500 ms; throttled, nearly every search runs to the time limit. So a 40-move game (81 positions) takes about 30 s on desktop and about 40 s on a slow phone. A real phone wasn't at hand, and CDP's CPU throttling may not slow the Web Worker as much as a real phone would.
Decision: `REVIEW_LIMITS` in `src/features/review/reviewLimits.ts` is `{ depth: 18, multiPv: 1, movetimeMs: 500 }`. The progress bar and key moments that show as soon as their moves are analysed make the wait usable.
To change: `movetimeMs` there (`review-actions.test.ts › review limits` keeps it from 100 to 1000 ms). Lower it if a real phone is too slow; scores get noisier below about 300 ms.

## 2026-10-16 — The move list shows your move while you look for a better one (agent default — override anytime)
Context: At a key moment the card says "Your move is hidden", but the move list beside it (or under the phone sheet) still shows the move you played with its mark, for example `2. g4 ??`. The better move, which is the answer, stays hidden. Raised by the reviewer of PR #73.
Decision: Keep showing it. You already know what you played, and the mark only says it was a mistake.
To change: hide the played move's row (or its mark) in `MoveList` while the active moment is `trying`, and reword the card's "Your move is hidden" if needed.

## 2026-10-17 — browser: chrome-devtools-axi (superseded by "browser: agent-browser", 2026-10-21)

Agents check pages with `npx -y chrome-devtools-axi` (`open`, then `eval`), each in its own session. `agent-browser` is installed, but its `open` hung again and again in the post-game-review run (see `pod-docs/known-issues/agent-browser-batch-hang.md`), while chrome-devtools-axi worked every time. (human, 2026-10-17)

## 2026-10-18 — The page opens on vs Liem (chosen by the human, plan sparring-ladder) (superseded by "The site opens on the home page", 2026-10-19)
Context: The app is practice for beating GM Le Quang Liem, so his ladder is the main screen. This replaces "The page opens in Two players".
Decision: `match.mode` starts as `"liem"` with `setupOpen: true` (`src/features/liem/matchSlice.ts`), and it isn't saved, so every load opens on the challenge card over the dimmed board. Nothing loads Stockfish or a book before Start game. **Two players** is one tab click away and works as before. Clicking the vs Liem tab at load changes nothing.
Consequences: Tests that start from a fresh store are in vs Liem with the card open; a two-player test switches mode first (`switchMode("two-player")`). To remember the last mode, save it like the Sound setting.

## 2026-10-18 — Sparring and Liem labels (plan sparring-ladder ## Look; the words are a default — override anytime) (superseded by "Levels have names, not ratings", 2026-10-19)
Context: Levels 1400 to 2500 are sparring bots that play his openings; the last step is Liem himself. The cards and the setup card must say which is which.
Decision: `src/features/liem/levelView.ts` holds every text a level shows, and the components add no words of their own:
- **Sparring card:** the ♞ glyph (`.liem-sparring-avatar`) in place of a photo, "Sparring · 1400", "Plays Liem's openings" ("Liem's openings" below 768 px). No GM tag and no star.
- **Liem card:** his photo, the GM tag and "GM · 2732" (no "playing about"). No star by his name: the wave 2 fix removed it, since it cut his name on phones and the card had none before. Below 768 px the line reads "2732", since the GM tag already sits by his name.
- **Both cards** keep "★ Book · N", the Stockfish pill (removed by "His card shows only his book or Thinking…", 2026-10-20) and "Thinking…". Long lines end in an ellipsis (2026-10-11), and screen readers get the whole line.
- **Setup card:** still "Challenge Le Quang Liem". Sparring steps read "about N" (`aria-label` "N"); the last step reads "★ Liem" in the gold Elo style (`aria-label` "Liem (2732)"). The line under the steps reads "A sparring bot plays his openings, then Stockfish at about N." or "Le Quang Liem: his openings, then full-strength Stockfish 18."
- **Out of book:** "Stockfish at about N plays from here. It isn't trained on his games.", or "Full-strength Stockfish 18 plays from here. It isn't trained on his games." at the Liem level.
Consequences: Liem's short name ("Liem") is the last word of `player.json`'s `name`. On a phone the sparring line next to "★ Book" ends as "Liem's …". To change a word, edit `levelView.ts` and `src/features/liem/__tests__/level-view.test.ts` together.

## 2026-10-18 — Sparring step table tuned to 75 % of human mistake rates (agent default — override anytime)
Context: Plan sparring-ladder: at every sparring level, his mistake and blunder rates per 40 moves after the book should be 75 % of Lichess players at that level, ±25 % of that target. C1 added the mistake and blunder bands to `chooseHumanMove`, H1 the human baselines, M1 `npm run calibrate -- --measure`. This entry supersedes "Strength step table set from the first calibration runs" (2026-10-12) and "The 1400 step plays like 1400" (2026-10-12): the band fields change how every sparring level plays, so the human's 1400 play check needs doing again.
Baselines (`scripts/ladder/human-baselines.json`, generated 2026-10-18, Lichess rated blitz and rapid games with Lichess analysis, both players within ±100 of the level, graded from ply 10): 150 games at every level, none dropped, none `lowSample`. Bands and speeds (blitz/rapid): 1400 1300–1500, 103/47; 1700 1600–1800, 127/23; 1900 1800–2000, 141/9; 2100 2000–2200, 131/19; 2300 2200–2400, 143/7; 2500 2400–2600, 148/2. **Caveat:** the human rates are mostly blitz, and 2300 and 2500 come mostly from the opponents of arena players, so their time pressure adds mistakes a 10-minute game wouldn't have. The 75 % target allows for some of that.
Targets per 40 (review mistake / blunder): 1400 1.00 / 1.10; 1700 0.77 / 1.07; 1900 0.81 / 0.78; 2100 0.68 / 0.65; 2300 0.59 / 0.62; 2500 0.61 / 0.62.
Runs (lite single-thread Stockfish 18, `--jobs 10` on 12 cores, graded at depth 18 or 500 ms a position; measure runs seed 1):
- **Run 1**, the earlier guess (chances 0.3 to 0.5, `blunderMaxCp` 600 to 800), `--measure --games 20`, 16.0 min. 1700, 1900 and 2100 blundered too often (up to 1.12 against 0.65 at 2100); 2500 at depth 14 made too few mistakes (0.43) with the same chances as 2300.
- **Run 2**, chances cut, 2500 down to depth 12, `--measure --games 40`, 30.0 min. All 12 rates within tolerance, several near the edges.
- **Run 3**, small nudges, `--measure --steps 1400,...,2500,full --games 40`, 43.1 min. 11 of 12 within; 2300 mistakes 0.74 against a limit of 0.736.
- **Run 4**, `hangWeight` lowered to 0.6 → 0.3, same flags, 42.3 min. 1900 mistakes 1.10, 2100 blunders 0.43 and 2300 mistakes 0.79 out. Lower `hangWeight` barely cut hung pieces and cut 2100's counted blunders, so it was raised again.
- **Run 5** (confirming run for 1400 to 2100 and Full), the table below with 1400 at depth 8 and 2300/2500 at mistake 0.24, depth 12, same flags, 43.5 min. All 12 within (table below). Full: mistakes 0.01, blunders 0.00 per 40.
- **Run 6**, ladder, `--games 8 --anchors none`, 4.3 min. 1400 scored 62.5 % against 1700 and 2300 56.3 % against 2500 (2300 and 2500 had the same depth).
- **Runs 7–9**, 2500 to depth 13, 2300/2500 at mistake 0.27 then 0.25: `--measure --steps 2300,2500 --games 40` (13.5 and 13.0 min) and `--steps 1400,2300 --games 16 --anchors none` (2.7 min). At 0.27, 2300's mistakes were 0.74 again; at 0.25 both levels are within (table below).
- **Runs 10–11**, ladder on that table: `--games 8 --anchors none` (4.6 min): 1900 scored 68.8 % against 2100 and 2300 56.3 % against 2500; `--games 16 --anchors none --seed 2` (7.9 min): 1400 56.3 % against 1700, everything else 12.5 to 40.6 %. Eight games is ±12.5 % a game, so single cells swing that much on an unchanged table.
- **Runs 12–13**, 1400 to depth 7: `--measure --steps 1400 --games 40` (4.2 min) and `--steps 1400 --games 16 --anchors none --seed 2` (0.3 min, 43.8 % against 1700).
- **Run 14**, final ladder, `--games 8 --anchors none`, 4.6 min. Against the next step up: 1400 50.0 %, 1700 25.0 %, 1900 37.5 %, 2100 6.3 %, 2300 43.8 %, 2500 0.0 % (against Full). Average ms per move 29, 74, 132, 218, 317, 558 for 1400 to 2500, all under each level's `movetimeMs`.
- Total run time about 4 h.
Decision: Use these values (depth / movetime ms / mistakeChance / blunderChance / blunderMaxCp / hangWeight; multiPv 10 at every sparring level; maxLoss, temperature, slip, ahead and forceMateIn as in the 2026-10-12 table):
- 1400: 7 / 400 / 0.40 / 0.36 / 800 / 0.8
- 1700: 9 / 500 / 0.36 / 0.33 / 700 / 0.7
- 1900: 10 / 600 / 0.28 / 0.26 / 650 / 0.6
- 2100: 11 / 700 / 0.28 / 0.22 / 600 / 0.6
- 2300: 12 / 800 / 0.25 / 0.22 / 600 / 0.5
- 2500: 13 / 900 / 0.25 / 0.22 / 600 / 0.4
- Full: unchanged (18 / 1000, multiPv 4, every band field 0).
Measured review mistake / blunder per 40 on the final table (target ±25 %, all `ok = yes`): 1400 1.07 / 1.25 (run 12); 1700 0.59 / 0.97, 1900 0.83 / 0.72, 2100 0.78 / 0.77 (run 5); 2300 0.47 / 0.70, 2500 0.58 / 0.72 (run 9).
Consequences:
- 40 games still moves a rate by about ±10 % between runs of the same table, so a rate near its edge can read `no` on a rerun; 1700's mistakes (0.59 against a floor of 0.58) sit lowest. Rerun with more games before reading one cell.
- Going up, the chances can't rise, yet the human targets barely fall from 2100 to 2500 and deeper searches make fewer counted mistakes for the same chance. So 2300 and 2500 share their chances and differ only by depth and the normal-path limits.
- The bots hang pieces and miss captures more often than the humans (hung 0.5 to 0.9 per 40 against 0.3 to 0.7; missed captures 2 to 4 times the human rate). These rates aren't targets; `hangWeight` alone didn't move them much.
- The biggest drops are missed tactics and loose pieces in sharp middlegames and endgames (a rook move that drops the h-pawn race, a king step into a fork), not a queen left for nothing.
- **Play check** (agent, `npm run dev`, 1400, as White, two games played by a scripted Stockfish): in the second game, level at about 50 %, he played 13...Rxd2 and left his queen on a2 to 14.Qxa2. The review's graph shows his side drop 34 win % there, a blunder by the review's levels. The review grades only your own moves, so his slip shows in the graph, not as a mark in the move list. The human's own 1400 play check is still to do.

## 2026-10-18 — 2300 and 2500 baselines include arena players' opponents (agent default — override anytime)

Recent arenas had only 7 players near 2300 and 1 near 2500, so `npm run baseline` also reads the opponents those players met within ±150 of the level. The 2300 and 2500 baselines rest almost entirely on them. To use arena players only, change the sourcing in `scripts/ladder/baseline.ts` and rerun `npm run baseline`.

## 2026-10-18 — His rating reads "2732" on phones (agent default — override anytime) (restated in "Phone lines after the refresh", 2026-10-19)

Below 768 px the Liem card's line reads "2732" instead of "GM · 2732", because the GM tag already sits by his name and the full line cut to "GM · 27…" next to "★ Book". Screen readers still get "GM · 2732". Change it in `src/features/liem/levelView.ts`.

## 2026-10-18 — His name may end in an ellipsis at 375 px (agent default — override anytime)

At 375 px the in-game Liem card reads "Le Quang Li…" (the name box is 136 px; the GM tag and name need 145 px), as it did before the sparring ladder. Options: hide the GM tag on phones, show "Liem" as the phone name, or tighten the GM tag and name margins (`src/features/board/components/Player.css`).

## 2026-10-18 — The ladder check is 8 games a pair (agent default — override anytime)

The final `npm run calibrate -- --games 8 --anchors none` run has each level at or under 50 % against the next (50.0 / 25.0 / 37.5 / 6.3 / 43.8 / 0 %). A 16-game run of the same table had 1400 at 56.3 % against 1700, because their human targets are close. To make the test stricter, run 16 or more games a pair and retune 1400 or 1700 until it holds.

## 2026-10-18 — The review marks only your moves (agent default — override anytime)

A sparring bot's mistake shows as a drop in the review graph, never as a mark in the move list, because the review grades only the human's moves (`byHuman` in `src/game/review/build-review.ts`). Marking his moves too would be a review change, which the sparring-ladder plan left out of scope.

## 2026-10-18 — The tuned table stands until you replay 1400 (agent default — override anytime)

The 2026-10-12 "The 1400 step plays like 1400" check is superseded by the tuned table. The bots now hang pieces 1.2–2.4× and miss captures 2–5× as often as humans; those two rates have no target. Play a few 1400 games and say if it feels too loose: lower `hangWeight` or `blunderMaxCp` in `src/game/opponent/step-profiles.ts`.

## 2026-10-19 — merge target: pod-staging (superseded by "merge target: ui-feel-staging", 2026-10-21: each plan cuts its own staging branch from `main`, and the human merges it into `main` and deletes it)

Autopilot merges land on `pod-staging`, cut from `main`. The human looks, then moves them to `main`, which deploys to GitHub Pages, so unattended code never deploys alone. (human, 2026-10-19)

For plan ui-refresh the human renamed `pod-staging` to `ui-refresh` after the merge, so the branch names its feature (2026-10-19). The next autopilot run cuts a new `pod-staging` from `main`, unless you choose another name for it.

## 2026-10-19 — The site opens on the home page (chosen by the human, plan ui-refresh) (the Two players link is superseded by "Two players is a full-width button", 2026-10-21)
Context: The human wanted "a home page to start first, not just straight to the board". This replaces "The page opens on vs Liem".
Decision: Screens are hash links (`#/` home, `#/play`, `#/two-players`, `#/review`, in `src/app/route.ts`), with no router library, so they work on GitHub Pages with no server. Home holds the level picker, your color, Play and the "Two players on one board" link. It has no photo and no "beat him" message. The board screen has no mode tabs and no challenge card. `match` still starts as `"liem"` with `setupOpen: true`, which is now the home state.
Consequences: Back and forward move between the screens. A reload of `#/play` or `#/review` goes home, because the store isn't saved, and an unknown hash goes home too.

## 2026-10-19 — Going home ends the game (agent default — override anytime)
Context: ← Home, the browser's Back from `#/play` and an edited hash all reach home mid-game.
Decision: Arriving home resets the board (`goHome`). The level and color picks stay until a reload. The board unmounts on home, so the next game loads his engine again, from the browser cache.
Consequences: There is no "resume game". To keep a game across home, stop `arriveAt("home")` from resetting and let `#/play` show the game in progress.

## 2026-10-19 — Levels have names, not ratings (chosen by the human; the names are a default — override anytime) (the card line and the out-of-book text are superseded by "His card shows only his book or Thinking…" and "No out-of-book note", 2026-10-20)
Context: A 1000-rated player who beats "1400" easily would think the app is wrong. This replaces "Sparring and Liem labels".
Decision: The seven steps read Easy, Medium, Hard, Harder, Expert, Master and ★ Liem (`LEVEL_NAMES` in `src/features/liem/levelView.ts`, the one place to change them). A bot's card reads its name with the ♞ and "Plays Liem's openings". The home engine line reads "A sparring bot plays his openings, then Stockfish at the Medium level.", and out of book "Stockfish at the Medium level plays from here. It isn't trained on his games." No sparring level puts a rating or "about" in any text or `aria-label`. Only Liem shows "GM · 2732"; the Liem texts don't change. "★ Liem" is ink text with an ochre ★ (`src/features/liem/components/Star.tsx`).
Consequences: The numbers stay in code, `npm run calibrate` and the docs. To rename a level, edit `LEVEL_NAMES` and `src/features/liem/__tests__/level-view.test.ts` together.

## 2026-10-19 — The default level stays Harder (agent default — override anytime)
Context: The home page needs a level picked on load.
Decision: The default stays strength 2100, which is now named "Harder" (as in "vs-Liem setup defaults", 2026-10-10), and White.
Consequences: Change `strength` and `colorPick` in `src/features/liem/matchSlice.ts`.

## 2026-10-19 — The Look replaces the dark and vs-Liem tokens (chosen by the human, plan ui-refresh ## Look)
Context: The early dark UI and the newer vs Liem and review UI felt like two apps. The human picked the "scorebook" look (B) set in Quicksand (A's font). This replaces "App green darkened to #047A4F".
Decision: `src/index.css` `:root` holds the Look's tokens: the palette (`--bg` #F4EFE4, `--surface` #FBF8F1, `--surface-2` #EFE8D8, `--line` #DCD2BD, `--ink` #1E1B16, `--soft` #6B6457, `--accent` #A8322B, `--gold` #B8860B, `--go` #1E1B16 with `--go-ink` #FBF8F1), the wood board (#F0E3C8 and #B98B5E), the spacing scale (4, 8, 12, 16, 24 and 32 px), a 4 px radius and four type sizes (30, 20, 16 and 14 px). The old `--dark-*`, `--liem-*`, `--book-bar`, `--review-page`, `--board-sound-on`, `--background` and `--text` tokens are gone. Play and Sound-on are ink, not green. Light only, with no dark mode. Ochre is never a text color. `tests/leftover-styles.test.ts` keeps old tokens, undeclared tokens and literal colors out of `src/`.
Consequences: To change a color, change its token; no CSS file outside `index.css` names a color. A dark mode would be a second set of the same tokens.

## 2026-10-19 — Grade and low-time colors on cream (agent default — override anytime)
Context: The review's grade colors and the low-time clock were set for a dark page, and some failed 4.5:1 on cream.
Decision: Each grade keeps its old hue (within 10°), darkened just enough to read at 4.5:1 on `--surface` and `--surface-2`: `--grade-inaccuracy` #146AB0, `--grade-mistake` #A45000, `--grade-blunder` #CF0F00, `--grade-best` #27744F and `--grade-book` #686A2D. Chips put `--grade-ink` (the `--surface` cream) on the grade color. Low time is red ink (`--accent`) with `--surface` text; waiting is `--soft` on `--surface-2`, running is `--bg` on `--ink`.
Consequences: Change a value in `src/index.css`; `tests/look.test.ts` and `tests/theme.test.ts` check the contrast.

## 2026-10-19 — The last-move highlight is an ochre tint (agent default — override anytime)
Context: The old `--board-highlight`, `rgba(255, 255, 51, 0.5)` yellow, was loud on the wood board, and the Look gave no value for it.
Decision: `--board-highlight` is `rgba(204, 153, 26, 0.5)`, an ochre tint close to `--gold`. It marks the last move and the selected square, and stays readable on both the light and the dark squares.
Consequences: Change it in `src/index.css`. It must stay see-through so the square color shows.

## 2026-10-19 — The board screen has a top bar and one Moves card (chosen by the human, plan ui-refresh) (the foot is updated by "Resign sits in the Moves card foot", 2026-10-20; the "+N" order and place are superseded by "The material line sits under the name, pieces then +N", 2026-10-20; the review foot by "Play again sits in the review's Moves card foot", 2026-10-20)
Context: The gaps around the tabs, the separate buttons box and the Fallen Pieces panel made the board screen uneven.
Decision: A 56 px top bar holds ← Home and the title ("vs Medium · you play White"). Fallen Pieces becomes a "+N" line with the captured pieces on each player card. The buttons join the Moves card's foot. In vs Liem the foot is Review game (once the game can be reviewed), New game, Flip and Sound; in Two players it is Play, New game (the old Reset), Flip and Sound.
Consequences: The review's foot is Back to game, Flip and Sound.

## 2026-10-19 — New game replays the level and color; Random draws again (agent default — override anytime)
Context: With the setup card gone, New game in vs Liem needed a meaning.
Decision: New game (`replayLiemGame`) starts a new game at the same level and color pick, so Random draws a color again. ← Home is how you change the level or color.
Consequences: To keep the drawn color, pass the last `humanColor` in `replayLiemGame` instead of the pick.

## 2026-10-19 — Review game sits in the Moves card (agent default — override anytime)
Context: With the buttons box gone, Review game needed a place.
Decision: Review game is the first item in the Moves card foot, as the primary button (`a.button.button--play[href="#/review"]`), and shows only once the game can be reviewed.
Consequences: Move it in `src/features/board/Board.tsx`.

## 2026-10-19 — "+N" counts promotions (agent default — override anytime)
Context: The "+N" material line needs a rule for a promoted pawn.
Decision: `materialLine` (`src/features/board/material.ts`) counts material on the board, so a promotion adds the new piece's value and takes away the pawn's. The captured-piece glyphs show only what was taken. At 375 px his card's glyphs can be cut, but "+N" itself never is.
Consequences: Change the counting in `material.ts` and its tests together.

## 2026-10-19 — The review graph sits in the sidebar and shows once (chosen by the human; the phone rules are a default — override anytime)
Context: The human found the full-width review graph "kinda far away from the analysis sideboard".
Decision: The win % graph is an 80 px card at the top of the review sidebar, above the key-moment card, and always shows your side (the "White / You" switch is gone). On phones it is at the top of the bottom sheet. `graphPlacement` (`src/features/review/reviewLayout.ts`) puts it in exactly one place: the sheet while it is open and up, else the sidebar (the sheet is closed, or sits low while you try a move).
Consequences: Change the rule in `graphPlacement` and its test.

## 2026-10-19 — The review's top bar has Play again; Back to game stays in the review (agent default — override anytime) (superseded by "Play again sits in the review's Moves card foot", 2026-10-20)
Context: The review had New game and Back to game in its sidebar.
Decision: The review's New game is replaced by Play again on the right of the top bar (a new game at the same level and color, then `#/play`). Back to game is a link to `#/play` in the Moves card foot, so it is the same as the browser's Back; Forward reopens the review where the pass was.
Consequences: To change what Play again does, edit `playAgain` in `src/features/review/reviewLayout.ts`.

## 2026-10-19 — Phone lines after the refresh (agent default — override anytime) (the card parts are superseded by "His card shows only his book or Thinking…", 2026-10-20; "★ Book" below 768 px stays)
Context: The refresh changed the phone layout that "~2100", "2732 on phones" and the setup card's 14 px line were set for.
Decision: Below 768 px a bot's card reads "Liem's openings" (no rating), his card reads "2732" (the GM tag sits by his name) and the badge reads "★ Book"; screen readers get the whole line. The setup card is gone, so its 14 px line is gone too; nothing on any screen is under 14 px. On home at 375 px the level steps wrap 4 then 3.
Consequences: Change the lines in `src/features/liem/levelView.ts` and the narrow rules in `src/features/board/components/Player.css`; the steps in `src/features/home/Home.css`.

## 2026-10-19 — The game-over notice is a cream card with no scrim (agent default — override anytime) (superseded by "The game-over card dims the board", 2026-10-20)
Context: The old notice sat on a dark overlay that the Look rules out.
Decision: The game-over notice is a `--surface` card with a `--line` border over the board, with no scrim behind it.
Consequences: Change it in `src/features/board/components/GameOver.css`.

## 2026-10-19 — Two players keeps "Le Quang Liem" and "Me" on the cards (agent default — override anytime) (superseded by "Two players cards read White and Black", 2026-10-20)

The two-player board still names its players from `src/game/players.ts`: the top card shows his photo, the GM tag and "Le Quang Liem", the bottom card "Me". The plan didn't change Two players, so this stays. To use neutral names such as "White" and "Black" (or no photo), change `src/game/players.ts`.

## 2026-10-20 — merge target: ui-polish-staging (superseded by "merge target: ui-feel-staging", 2026-10-21: each plan cuts its own staging branch from `main`, and the human merges it into `main` and deletes it)

For plan ui-polish, autopilot merges land on `ui-polish-staging`, cut from `main`, so the staging branch names its feature (the human renamed the last one to `ui-refresh`). The human looks, then moves it to `main`, which deploys to GitHub Pages. (human, 2026-10-20)

## 2026-10-20 — Body text is Quicksand 600 (chosen by the human, plan ui-polish ## Look)
Context: Body text in Quicksand 500 read thin on the cream cards. The human picked option B in draft section 0 (`pod-docs/design-drafts/ui-polish.html`): "Let's do B".
Decision: Body text is Quicksand 600 (`body { font-weight: 600 }`). Headings, buttons, names, clocks and other bold text stay 700. The app ships only the 600 and 700 woff2 files (from `@fontsource/quicksand` 5.3.0); the 500 file and its `@font-face` are gone, and no CSS under `src/` sets 500, 400 or `normal`. This updates "Quicksand is self-hosted" (2026-10-10), which named 500 and 700.
Consequences: Every screen reads a little heavier with the same sizes and layout. To change the body weight, change `src/index.css` (the `body` rule and the 600 `@font-face`) and `tests/theme.test.ts`.

## 2026-10-20 — Resign sits in the Moves card foot, with a 3 s red Confirm (default, recommended and accepted; the one width and the short "Confirm" chosen by the human, plan ui-polish)
Context: The human asked for a resign button ("I need a resign button"). A longer "Confirm resign" label made the button grow onto two lines.
Decision: **Resign** (`button.button.resign-button`) sits in the Moves card foot after New game, in both modes, while `canResign` holds: vs Liem from the first move, Two players only once **Play** starts the clocks. In Two players, Play now hides once the clocks run or the game is over. The first press turns it into a red **Confirm** (`--accent` text and border, `data-confirm="true"`, `aria-label="Confirm resign"`) for 3000 ms; a second press inside that time resigns once, and at 3000 ms it turns back. A new game or the end of the game turns it back; Flip and Sound don't. It is 104 px wide with no wrap, so the foot never moves. vs Liem the loser is you, even on his turn; in Two players it's the side whose clock runs. The feet are: vs Liem in progress New game, Resign, Flip, Sound; vs Liem over Review game (when the game can be reviewed), New game, Flip, Sound; Two players before Play: Play, New game, Flip, Sound; running: New game, Resign, Flip, Sound; over: New game, Flip, Sound. From 992 px up every foot fits one row: the foot's text buttons take 12 px sides and the row doesn't wrap.
Consequences: The press rule is `src/features/board/resignConfirm.ts` (time passed in); `ResignButton.tsx` only owns the timer. The feet are in `src/features/board/Board.tsx`; the width and red ink in `ResignButton.css`; the one-row rule in `BoardSidebar.css`. At 375 px the foot may wrap.

## 2026-10-20 — The game-over card dims the board (chosen by the human: dim the board; the card content is a default, plan ui-polish)
Context: The human asked to "dim the board to make the endgame more prominent". This supersedes "The game-over notice is a cream card with no scrim" (2026-10-19).
Decision: At the end of a game, `.game-over` fills `.squares` with `--game-over-scrim` (`--ink` at 40 %) and takes no clicks, so the final position, the last-move tint and the check glow show through. Inside sits a `--surface` card (`.game-over__card`) with the result ("White wins", "Black wins" or "Draw", in both modes), the reason ("Checkmate", "Stalemate", "On time" or "Resigned") and the actions: **Review game** (only when the game can be reviewed, so only vs Liem) and **New game** (`replayLiemGame` vs Liem, `reset` in Two players). The card waits for a pending promotion pick: until the pick is made it doesn't show, so the picker can still be clicked. On a phone the buttons sit in a row when they fit and stack otherwise.
Consequences: The text and the rule for when it shows are `gameOverView` (`src/features/board/gameOverView.ts`); the look is `src/features/board/components/GameOver.css`.

## 2026-10-20 — A color disc in place of a photo (default, recommended and accepted, plan ui-polish) (the circle is superseded by "Avatars are squares with the 4 px corner", 2026-10-21; the disc stays)
Context: Your card showed a stock photo (`chess-player.png`) while his sparring card showed a ♞ disc, so the two cards didn't match.
Decision: A card with no photo and no glyph shows a disc: `span.player__disc[aria-hidden="true"]` with ♔ for White or ♚ for Black. His ♞ is the same disc (`.player__disc.liem-sparring-avatar`). Every disc is 40 × 40 px, a `--surface-2` circle with an ink glyph. Only his card at the Liem step has a photo. `avatarSrc` returns `null` for an unknown name, and the card then shows the disc; `chess-player.png` is gone.
Consequences: The disc look is `.player__disc` in `src/features/board/components/Player.css`; the markup is `Avatar` in `src/features/board/components/Player.tsx`.

## 2026-10-20 — His card shows only his book or Thinking… (default, recommended and accepted; the fixed clock width chosen by the human, plan ui-polish) (the 56 px height is superseded by "The player row has more room (option C)", 2026-10-21)
Context: Under his name the card read "Plays Liem's openings" or "GM · 2732", then "★ Book · N" or a grey "Stockfish" pill. The plan rules out pills on his card after his book. This supersedes the card lines of "Sparring and Liem labels" (2026-10-18), its Stockfish pill, and the card parts of "Phone lines after the refresh" (2026-10-19).
Decision: His card shows the level's name with the ♞ disc, or at the Liem step his photo, the GM tag and "Le Quang Liem". Under the name there is only "★ Book · N" (`[data-book-games]`, "★ Book" below 768 px) while he's in his book, "Thinking…" while he loads or thinks, and otherwise nothing. No card shows "Plays Liem's openings", "Liem's openings", "GM · 2732" or `[data-engine]`. Every `.board > .player` stays 56 px tall. The clock pill is a fixed 112 px box with tabular figures, so it never changes width.
Consequences: `levelView` no longer has `detail`, `shortDetail`, `detailLead` or `outText`; `rating` ("GM · 2732") stays for home. `liemBadge` returns `null` out of book. The line is `src/features/liem/components/LiemCardDetail.tsx`.

## 2026-10-20 — No out-of-book note (default, recommended and accepted, plan ui-polish)
Context: Once he left his book, the sidebar note turned red and said "Out of his book" with a Stockfish line. The human accepted that this hides that Stockfish plays; the home engine line still says so.
Decision: The book note (`[data-book-state]`) shows `waiting`, `in-book` and `failed` (with Try again) as before. Out of his book there is no note: no `out` state in the DOM and no "Out of his book" text. Below 992 px an empty slot keeps the note's tallest height for the rest of the game, so the page never gets shorter and never scrolls (review fix, PR #92); from 992 px the slot is hidden. A new game clears the slot and brings back `waiting`.
Consequences: `bookNoteView` still returns `{ kind: "out" }`; `BookNote` renders `null` for it. `.liem-note--out` is gone from `src/styles/liem.css`.

## 2026-10-20 — Two players cards read White and Black (agent default from the sprint contract — override anytime)
Context: The two-player board named its sides "Le Quang Liem" (with his photo and GM tag) and "Me". This supersedes the 2026-10-19 entry that kept "Le Quang Liem" and "Me" on the cards.
Decision: In Two players the cards read "White" and "Black" (`src/game/players.ts`), each with its color disc, with no photo and no GM tag. "Thinking…" stays his status vs Liem only.
Consequences: The clock `aria-label`s read "Clock for White" and "Clock for Black".

## 2026-10-20 — The review sidebar is three cards (chosen by the human: key moment above the graph and fewer cards; the merge is a default, plan ui-polish)
Context: From 768 px up the review sidebar held the graph, the key moment, the accuracy panel, the Moves card and a separate "Left his book" card.
Decision: From 768 px up `.review .sidebar` holds exactly three cards: the key-moment card, the summary card (`section.card[data-review-graph]`: the 80 px graph, then the accuracy line "40 % · ?! N · ? N · ?? N" in grade colors, "—" until ready, no book-move count), and the Moves card, whose list starts with the left-book line ("Left his book at move N · he played X in G games", "Left his book at move N", "Stayed in his book the whole game", or no line without his books). `AccuracyPanel` and the left-book card are gone. Below 768 px the sheet holds the key moment and then the summary; `graphPlacement` still decides where the summary goes, so `[data-review-graph]` appears once.
Consequences: Built by slice V1 (sprint polish); the review layout and smoke steps are in `pod-docs/codebase-structure.md`.

## 2026-10-20 — The book note's space stays on phones after he leaves his book (agent default — override anytime)
Below 992 px, once he leaves his book, an empty slot keeps the note's tallest height for the rest of the game, so the page never gets shorter and never scrolls. A new game clears it. To move the note under the Moves card on phones instead, change the order in `src/features/board/Board.tsx`; that still shortens the page when you're scrolled to the bottom.

## 2026-10-20 — The book note may grow, and the Moves card moves down with it (agent default — override anytime)
When the note grows (waiting → in his book, or more book rows later), the Moves card moves down; `scrollY` doesn't change. To stop it, give the note one fixed height for its tallest state in `src/features/liem/components/BookNote.css`, at the cost of more empty space early on.

## 2026-10-20 — On desktop the Moves card moves up when he leaves his book (agent default — override anytime)
From 992 px the empty slot is hidden, so the Moves card moves up by the note's height when he leaves his book; `scrollY` doesn't change. To keep the space on desktop too, drop the `display: none` rule for the slot in `src/features/liem/components/BookNote.css`.

## 2026-10-20 — A key-moment try counts as found when it isn't an inaccuracy (agent default — override anytime)
Any try that loses less than an inaccuracy (10 win-% points) counts as found, so a good move other than Stockfish's (for example 2.a3 when it names 2.d4) shows "You found it". This is the 2026-10-16 grade rule, unchanged. To require Stockfish's move, change the found rule in `src/game/review/`.

## 2026-10-20 — The material line sits under the name, pieces then +N (chosen by the human, plan ui-motion) (the 56 px height is superseded by "The player row has more room (option C)", 2026-10-21)
Context: The human found "+4" before the glyphs on the name's line "reversed" ("Easy +4 ♛♜♝♞♞♟").
Decision: On every player card, in both modes and in the review, `.player__material` is its own line under the name, 4 px below it: the captured pieces first, then "+N" (for example `♛♜♝♞♞♟ +4`). The glyph colors and the counting (`material.ts`) don't change, and "+N" is never cut; the glyphs cut first. Every `.board > .player` stays 56 px. Supersedes the order and place in "The board screen has a top bar and one Moves card", 2026-10-19.
Consequences: The layout lives in `Player.tsx` and `Player.css`; `tests/player-css.test.ts` pins the spacing and what gives way.

## 2026-10-20 — His card's detail shares the material line, material first (agent default — override anytime)
Context: His card already used its second line for "★ Book · N" or "Thinking…", and three lines don't fit the 56 px card.
Decision: The material and his detail share the second line: the material first, the detail at the line's end, so neither moves when the other comes or goes. The other way (detail first) makes the material jump about 70 px each time "Thinking…" comes and goes.
Consequences: To swap them, change the order in `Player.tsx` and its test (`player.test.tsx › with a detail, the material comes first on the second line`). Queued for the human in `handoff-queue.md`.

## 2026-10-20 — The game-over card eases in after a short pause (chosen by the human, plan ui-motion)
Context: The human found the end-of-game notice "too plain".
Decision: After a 300 ms pause, so you see the last move, the scrim fades in over 200 ms, and the card fades in, rises 8 px and scales from 0.96 to 1 over 250 ms, ease-out with no overshoot. It runs once per game end (`data-entrance="animate"`); under `prefers-reduced-motion: reduce`, and on a later mount for the same ended game (such as back from the review), it shows at once (`data-entrance="instant"`). New game during the pause removes the card. Turned down: a bounce, and a king highlight.
Consequences: The timings and the rule live in `src/features/board/gameOverEntrance.ts`; change them there and in its test.

## 2026-10-20 — Pieces move in 150 ms with an ease-out (chosen by the human, plan ui-motion) (the game-board part is superseded by "Game-board pieces move in 200 ms with an ease-in-out", 2026-10-21)
Context: The human found piece movement "quite slow" with Framer Motion's default spring.
Decision: Every piece move on the game board (click, tap, his move, castling's rook, en passant) is `PIECE_MOVE_TRANSITION`, a 0.15 s ease-out tween (`src/features/board/pieceMotion.ts`). The Flip stays instant, and a drag drop lands at once (the drag already carried the piece; castling's rook jumps with it on a drop). With reduced motion every piece jumps (`MotionConfig reducedMotion="user"`).
Consequences: Change the speed in `pieceMotion.ts` and `piece-motion.test.tsx`; the review's one-step slide uses the same value.

## 2026-10-20 — The review animates one-step moves only; jumps snap (chosen by the human, plan ui-motion)
Context: The human: "the playback buttons doesn't play piece movement". Pieces keep their ids across positions, so a jump would sweep every piece across the board.
Decision: `reviewStepMotion(prev, next)` slides only when the step is one ply (◀, ▶, an arrow key, an adjacent move in the list) of the same game at the same flip and square size; opening the review, a jump of 2 or more plies (a far move, First, Last, a key moment), a flip, a resize or another game snaps (`{ duration: 0 }`). Review pieces use the layout ids `review-<gameId>-<piece>`, so they never share a box with the game board's, and each piece has its own element, so a captured piece comes back on its square on ◀. A re-render of the same position (an eval arriving) keeps the step's motion, so a slide isn't cut short.
Consequences: The rule lives in `pieceMotion.ts` (`reviewStepMotion`, `nextReviewStep`) and is tested in `review-board-motion.test.tsx`.

## 2026-10-20 — Play again sits in the review's Moves card foot (chosen by the human, plan ui-motion)
Context: The human: "What is the point of "Back to game" button? It should be the "Play again" button and remove that from the navbar".
Decision: The review's Moves card foot is Play again (`button.button--play`, `playAgain`: a new game at the same level and color, then `#/play`), Flip and Sound. The review's top bar holds only ← Home and the title. There's no Back to game link; the browser's Back still goes to `#/play` with the finished board. Supersedes "The review's top bar has Play again; Back to game stays in the review", 2026-10-19.
Consequences: `TopBar`'s `action` prop and the `.top-bar__action` CSS stay, unused (`tests/review-theme.test.ts` still reads them). To change what Play again does, edit `playAgain` in `src/features/review/reviewLayout.ts`.

## 2026-10-20 — The name stays put on a card with no captures (agent default — override anytime)
Context: plan ui-motion puts the material line under the name. Keeping that line's space on every card means the name never moves at the first capture.
Decision: the second line is always kept, so on a card with no captures and no detail (You, White and Black at the start) the name sits about 12 px above the disc's middle.
Consequences: the other way centers the name until the first capture, then moves it up once. To change it, edit `.player__text` and `.player__sub` in `src/features/board/components/Player.css` and `tests/player-css.test.ts`.

## 2026-10-20 — One `generated` date for the whole baseline file (agent default — override anytime)
Context: fix PR #94 makes `npm run baseline -- --levels <N>` merge into `scripts/ladder/human-baselines.json`.
Decision: the file's `generated` date (and `skipPlies`) comes from the latest run, so a partial run sets it to today even when no other level changed.
Consequences: the other way stores a date for each level. To change it, edit `mergeBaseline` in `scripts/ladder/baseline.ts` and its tests.

## 2026-10-21 — browser: agent-browser
Agents check pages with `agent-browser` again, each in its own session (`--session pod-<name>`), always through the Bash tool and never with its output piped or captured (`| head`, `| tail`, `$(…)`). pod 0.3.0's probe (open and close `about:blank` twice, plain calls through the Bash tool) passed on 2026-10-21 with agent-browser 0.39.0, and a `batch` of `open`, `wait` and `eval` after a `close` returned at once. A piped or captured `open` still hangs (see `pod-docs/known-issues/agent-browser-batch-hang.md`). Supersedes "browser: chrome-devtools-axi" (2026-10-17). (human, 2026-10-21)

## 2026-10-21 — merge target: ui-feel-staging
Plan ui-feel merges into `ui-feel-staging`, cut from `main` after PR #93 merged; the human merges it into `main`. (human, 2026-10-21)

## 2026-10-21 — Game-board pieces move in 200 ms with an ease-in-out (chosen by the human, plan ui-feel)
Context: The human: "The review speed feel really good but normal pieces feel too fast, maybe because of the transition type?" Measured on 2026-10-21: chess.com's analysis board moves a piece in about 155 ms with an ease-in-out curve (6–10 % of the way after the first frames); ours took about 125–150 ms with an ease-out that covered about 20 % in the first frame, so the piece leapt off its square. Lichess's chessground and chessboard.js default to 200 ms.
Decision: Every piece move on the game board (a click, a tap, his move, castling's rook, en passant) is `GAME_MOVE_TRANSITION = { type: "tween", ease: [0.42, 0, 0.58, 1], duration: 0.2 }`, the CSS `ease-in-out` curve as control points: under 5 % of the way after the first 1/60 s frame, no overshoot, halfway at half time. The review's one-ply step keeps its own `REVIEW_STEP_TRANSITION = { type: "tween", ease: "easeOut", duration: 0.15 }` (`transitionFor("slide")`). The old shared `PIECE_MOVE_TRANSITION` is gone. The Flip and a drag drop stay instant (`useInstantLayoutTransition`), and reduced motion still jumps (`MotionConfig reducedMotion="user"` around both boards). When his reply lands mid-move, the piece ends on the store's square: the motion is visual only. Turned down: a speed setting, springs. Supersedes the game-board part of "Pieces move in 150 ms with an ease-out", 2026-10-20.
Consequences: Both values live in `src/features/board/pieceMotion.ts`; `piece-motion.test.tsx` samples the curve, and `tests/motion-wiring.test.ts` pins the instant paths and the old name's removal.

## 2026-10-21 — Avatars are squares with the 4 px corner (chosen by the human, plan ui-feel)
Context: The human: "Change the rounded avatar to square".
Decision: Every avatar is a 40 × 40 px square with `border-radius: var(--radius)` (4 px): your ♔/♚ disc, his ♞ disc (`.player__disc`) and Liem's photo (`.player__avatar`), on every player card, in both modes and in the review. No `50%` is left in `Player.css`. The disc keeps its `--surface-2` fill and ink glyph. Supersedes the circle in "A color disc in place of a photo", 2026-10-20.
Consequences: The look is `.player__disc` and `.player__avatar` in `src/features/board/components/Player.css`; `tests/player-css.test.ts` and `tests/liem-theme.test.ts` pin it.

## 2026-10-21 — The player row has more room (option C) (chosen by the human from the draft, plan ui-feel)
Context: The human: "review the gap in the player row too". Option C of `pod-docs/design-drafts/ui-feel.html` was picked.
Decision: `.player` has `gap: var(--space-4)` (16 px from the name side to the clock) and `padding: var(--space-2) 0` (8 px above and below); `.player__info` has `gap: var(--space-3)` (12 px from the avatar to the name). Every `.board > .player` is 60 px tall (8 + 44 + 8); `.player__text` stays 44 px, and the name line, the material line, the 112 px clock pill and the "+N" and detail rules don't change. Supersedes the 56 px card height in "On phones, his card's long lines are cut with an ellipsis", 2026-10-11, "His card shows only his book or Thinking…", 2026-10-20, and "The material line sits under the name, pieces then +N", 2026-10-20. At 375 and 320 px "+N" and his detail are never cut (the glyphs cut first) and nothing scrolls sideways. `squareSizeFor` reads only the width, so the taller cards don't shrink the board; the board column is 8 px taller.
Consequences: The row is `src/features/board/components/Player.css`; `tests/player-css.test.ts` pins the gaps, the padding and the 60 px card.

## 2026-10-21 — Two players is a full-width button (chosen by the human from the draft, plan ui-feel)
Context: The human: "For the two players, use a button instead of text button, I barely see it". The 48 px option of the draft was picked.
Decision: Home's "Two players on one board →" text link (`a.home__alt`) becomes `<a class="button home__two-players" href="#/two-players">Two players on one board</a>`, with no arrow: the secondary `.button` look (the outline), full width, `min-height: 48px` like Play, `margin-top: var(--space-3)` (12 px) under Play. It stays an `<a>` because it goes to a screen. `.home__alt` is gone.
Consequences: The markup is `src/features/home/Home.tsx`, the look `.home__two-players` in `Home.css`; `home.test.tsx` and `tests/home-css.test.ts` pin it.

## 2026-10-21 — The project is named liem-sparring (chosen by the human)
Context: The app is practice for beating GM Le Quang Liem, with sparring bots that play his openings; "chess-web" no longer says what it is.
Decision: The project is `liem-sparring`: the `package.json` name, the Vite `base` `/liem-sparring/`, the README title "Liem Sparring", the script User-Agents (`liem-sparring-book-import/1.0`, `liem-sparring-baseline/1.0`) and the browser keys (`liem-sparring.sound`, `liem-sparring.reviewOverPlay`). The site moves to `https://iamphduc.github.io/liem-sparring/`; the old Pages URL `https://iamphduc.github.io/chess-web/` won't redirect. Rename the GitHub repo to `iamphduc/liem-sparring` before this merges (GitHub redirects the old repo URL). Pages is a project site of the repo, so it serves at `/<repo>/`: the merge to `main` runs the `deploy` job, and if the repo were still `chess-web`, Pages would serve at `/chess-web/` HTML that loads `/liem-sparring/assets/…`, and the site would be blank; the README and feature-details links to `github.com/iamphduc/liem-sparring` would also 404. If the rename ever comes after a deploy, re-run the `deploy` job right away. The workflow needs no change. A Sound setting saved under the old key is still read until the new key is written.
Consequences: Docs written before 2026-10-21 (plans, archived sprints, reports, research) keep the old name as history. `tests/vite-config.test.ts`, `tests/build.test.ts` and `tests/docs.test.ts` pin the name and path.

## 2026-10-21 — Each plan gets its own staging branch
Context: the human asked for a staging branch named after the feature ("I want something to reflect our new feature", 2026-10-19) instead of one shared `pod-staging`.
Decision: each autopilot plan cuts `<feature>-staging` from `main` (for example `ui-polish-staging`, `ui-feel-staging`), merges into it, and the human merges it into `main`; the branch is then deleted. Fixes made while a plan's staging branch is open may target it, so they ship together.
Consequences: record each plan's branch as a `## <date> — merge target: <branch>` entry. (human, 2026-10-19 to 2026-10-21)

## 2026-10-21 — merge target: tidy-staging
Plan tidy merges into `tidy-staging`, cut from `main` after PR #106 merged; the human merges it into `main`. (human, 2026-10-21)
