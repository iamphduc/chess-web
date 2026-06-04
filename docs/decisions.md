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
