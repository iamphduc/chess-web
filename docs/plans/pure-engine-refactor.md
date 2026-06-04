# Plan: Pure Engine Refactor & Test Suite

_Generated: 2026-06-04 · Status: active · Grilled-with: grill-me_

## Goal
Replace the leaking mutable-singleton chess engine with a pure, testable engine built around an immutable `GameState` value, and grow a trustworthy hand-authored test suite that encodes correct chess. Built test-first, strangler-fig style, so the live app keeps working at every commit until a single late cutover.

## Why
The current rules live in module-level singletons (`whiteKing`, `whitePawn`, `pieceMoves`) holding mutable state — castling rights, en-passant target, king positions, a promotion counter. That state leaks across games (`reset` never clears it), and the rules cannot be tested in isolation. The codebase also ships **zero tests** despite the test libraries being installed, and carries a real bounds-check bug (`toX < 8` written as `toY < 8`, in three places) that no test would currently catch.

**Success criteria for the whole plan:**
- The chess engine is pure functions over an immutable `GameState`; no module-level mutable game state remains.
- `reset` fully clears state across consecutive games (verified by test).
- The bounds bug is fixed and pinned by a named regression test.
- An enumerated chess edge-case checklist is green, plus external anchors (perft + one recorded game).
- The running app plays a full game (castle, en passant, promotion, checkmate) with no console errors after cutover.
- `tsc` and `npm run build` are clean; the old singleton state is deleted.

**Constraints:** Solo developer on `main`, deployed via `gh-pages`. Land via feature branch + PR, milestone-per-green commits, no auto-deploy. Methodology is TDD (red→green→refactor) throughout.

## Scope
**In scope:**
- A new pure engine module centred on an immutable `GameState` (`{ squares, turn, castling, enPassant, promotionCount }`).
- Stateless piece classes — castling rights and en-passant target threaded as arguments, not stored on instances.
- Hand-authored correctness tests covering the canonical chess edge cases.
- Fixing the `toX < 8` bounds bug as a red→green regression test.
- External ground-truth anchors: perft node counts (depth 2–3) and one recorded short game.
- Cutting `BoardSlice` over to the new engine; a thin layer of reducer-wiring tests; deleting the old singleton state.
- An authoritative decision record for the promotion-id quarantine (already written to `docs/decisions.md`).

**Out of scope:**
- The `{ kind, color }` piece-identity redesign — quarantined; counter moved into `GameState`, deeper redesign deferred to a future effort.
- Threefold repetition (README TODO) — a new feature, not a weakness fix. Enabled by hashable positions but not implemented.
- Rewriting notation generation or `lastMoves` tracking — these stay in the reducer/adapter layer; only their wiring is re-verified.
- Any deploy.

## Sprint sequence

| Sprint | Goal | Status | Depends on |
|--------|------|--------|------------|
| engine-foundation | Establish the `GameState` value and a tracer-bullet vertical slice (`legalMoves` + `applyMove` for one quiet move) proving the engine seam end-to-end; stand up the test harness | planned | — |
| move-generation | Stateless move generation for all pieces (sliding, knight, pawn), test-first, including the bounds-bug regression | planned | engine-foundation |
| king-safety-endgame | Enemy-attack mapping, legal-move filtering for king safety, and checkmate-vs-stalemate detection | planned | move-generation |
| special-moves | Castling (rights threaded through `GameState`), en passant (target in `GameState`), promotion (counter quarantined in `GameState`) | planned | king-safety-endgame |
| external-anchors | Perft node-count tests (depth 2–3 from start + one tactical position) and a recorded short game replayed move-for-move | planned | special-moves |
| cutover-cleanup | Flip `BoardSlice` to the new engine, add thin reducer-wiring tests, smoke-test the running app, delete old singleton state, verify `reset` clears across games | planned | external-anchors |

Status values: `planned` / `active` / `done`. The orchestrator only flips its row's Status.

The `Depends on` column is the **only** cross-sprint dependency signal. Wave ordering and per-slice deps live inside each sprint doc.

## Key decisions
- **Pure functional engine over an immutable `GameState`.** Pieces stay polymorphic but stateless. See `docs/decisions.md` → "Pure functional chess engine over an immutable GameState".
- **Quarantine the promoted-piece identity scheme.** Move the counter into `GameState`; defer the `{ kind, color }` redesign. See `docs/decisions.md` → "Quarantine the promoted-piece identity scheme".
- **Tests encode correct chess, not old-engine parity.** Bounds bug becomes a red→green test; external anchors give ground truth. See `docs/decisions.md` → "Tests encode correct chess, not old-engine parity".
- **Strangler-fig cutover, built test-first in parallel.** Tracer-bullet slice then dependency-ordered fill-in; single late cutover commit; feature branch + PR; no auto-deploy. See `docs/decisions.md` → "Strangler-fig cutover; build the engine test-first in parallel".
- **Engine boundary excludes presentation.** Notation strings, `lastMoves` highlights, and the fallen-pieces list stay reducer/UI-side; the engine answers only "legal moves" and "resulting position".

## Known risks
- **Hand-authoring chess rules risks encoding our own misunderstanding.** Mitigation: the external-anchors sprint cross-checks against published perft counts and a recorded game — ground truth independent of our beliefs.
- **The promotion-id quarantine constrains `applyMove`'s design.** Mitigation: the counter lives in `GameState` and the unique-id enum is untouched; the awkwardness is contained and documented, not spread.
- **Cutover may reveal a behavioural gap the engine suite missed** (e.g. a reducer-only concern like turn derivation or notation). Mitigation: cutover is a single revertable commit guarded by a running-app smoke test and the thin reducer-wiring tests; the old engine is one `git revert` away.
- **Transient duplication** of both engines in the tree during the build. Accepted as intentional — it is what enables the reference-and-parity approach.

## Open questions
- None blocking. (The `{ kind, color }` identity redesign and threefold repetition are deliberately deferred, not unresolved.)

## Verification
The whole plan succeeds when:
1. The enumerated chess edge-case checklist is green — sliding-piece blocking, pawn double-step/capture, en-passant timing, castling (rights lost, blocked, through/into/out of check), promotion, pinned-piece moves, check, checkmate vs stalemate.
2. The bounds-bug regression test passes (red on old logic, green on new).
3. External anchors pass — perft node counts at depth 2–3 and a recorded game replayed move-for-move.
4. After cutover, the running app plays a full sample game (castle, en passant, promotion, deliver checkmate) with no console errors.
5. `reset` is proven to fully clear state across two consecutive games.
6. The old singleton state is deleted; `tsc` and `npm run build` are clean with no remaining imports of the old engine internals.
