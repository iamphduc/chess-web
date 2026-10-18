# Sprint: external-anchors

_From plan: docs/plans/pure-engine-refactor.md · Slug: external-anchors · Status: archived · Generated: 2026-06-04_

Anchors the hand-authored engine against **external ground truth** independent of our own beliefs — the mitigation the plan names for the "hand-authoring chess rules risks encoding our own misunderstanding" risk. Two anchors: published **perft** node counts (start position depth 1-3 + one tactical position) and one **recorded short game** replayed move-for-move ending in checkmate. This sprint is **test-only / additive** — it adds no engine behaviour, only ground-truth tests (plus, optionally, a tiny test-only position-builder helper). It must NOT wire anything into `BoardSlice` (that is `cutover-cleanup`).

## Status board

| Wave | Slice | Title | Difficulty | Agent | Branch | PR | Status | Depends on |
|------|-------|-------|------------|-------|--------|----|--------|------------|
| 1 | perft-start | Perft harness + start-position node counts (depth 1-3) | 3 | engineer-senior | external-anchors-perft-start | merged | done | — |
| 1 | recorded-game | Replay a famous decisive miniature move-for-move to checkmate | 2 | engineer-junior | external-anchors-recorded-game | merged | done | — |
| 2 | perft-tactical | Perft on one tactical position (Kiwipete) depth 1-3 | 3 | engineer-senior | external-anchors-perft-tactical | merged | done | perft-start |

Wave membership lives in the **Wave** column; slices sharing a wave run in parallel and must own disjoint file sets.

## Per-slice detail

### perft-start: Perft harness + start-position node counts (depth 1-3)
- **Difficulty justification:** The perft recursion itself is small, but it is the load-bearing ground-truth harness — it must mirror the `allLegalMoves`/`hasAnyLegalMove` board scan exactly (count `legalMoves` across every side-to-move piece, recurse via `applyMove`) and the promotion fan-out must be left as-is so each promotion choice counts as a distinct node. Getting the counting contract right is the crux for both perft slices.
- **Scope:**
  - Add a perft test file under `src/game/engine/__tests__/`. Define a local `perft(state, depth)` helper that, at `depth === 0`, returns `1`; otherwise scans all 64 squares, and for each square holding a piece whose colour matches `state.turn`, sums `perft(applyMove(state, move), depth - 1)` over every `move` in `legalMoves(state, [y, x])`. This is the same board scan as `game-status.ts`'s `allLegalMoves` — mirror it; do NOT import or re-export from `game-status.ts` (keep the harness self-contained and test-only so it cannot couple the engine to the test runner).
  - Assert published start-position counts from `initialGameState()`: **depth 1 = 20, depth 2 = 400, depth 3 = 8902.** (Optionally a depth-1 sanity sub-assert that the move list length equals 20 directly.)
  - Do NOT promote the helper into a non-test `src/` module — perft is needed only by tests; keeping it test-local avoids shipping dead engine code. (If `perft-tactical` wants to share it, see its Depends-on note — the shared helper, if extracted, lives in a test-only file under `__tests__/`, never in the engine proper.)
  - Use **relative imports** (`../engine`, `../game-state`) — Vitest does not resolve the tsconfig `baseUrl` alias. Import from `vitest`.
  - Do NOT touch any engine source, `BoardSlice`, or `docs/plans/`.
- **Files owned:**
  - `src/game/engine/__tests__/perft-start.test.ts` (new)
  - `src/game/engine/__tests__/perft-helper.ts` (new, optional — the shared test-only `perft()` + position-builder, importable by `perft-tactical`; if the engineer keeps perft inline in the test file instead, this file is simply not created and `perft-tactical` defines its own — flag the choice in a PENDING)
- **Success criteria:**
  - `vitest run` green; perft start-position asserts pass at depth 1/2/3 with the exact published counts (20 / 400 / 8902).
  - A wrong-count assertion (e.g. asserting 401 at depth 2) would fail — the test is non-tautological (it counts real recursion, not a hardcoded echo).
  - `npx tsc --noEmit` clean.
- **Depends on:** —

### recorded-game: Replay a famous decisive miniature move-for-move to checkmate
- **Difficulty justification:** Mechanically straightforward — a fixed list of moves replayed through `applyMove`, asserting each is legal and the end state is checkmate. The only care needed is transcribing the chosen game's coordinates correctly into the engine's `[y, x]` convention (row 0 = Black back rank) and providing the right `promotion` field if the game promotes (a short mate normally does not).
- **Scope:**
  - Add a test that starts from `initialGameState()` and replays a famous decisive miniature **move-for-move**. Recommended: **Scholar's mate** (1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6?? 4. Qxf7#) — short, no promotion, ends in checkmate, easy to hand-verify. Légal's mate or another documented sub-15-move master miniature is an acceptable substitute; the engineer picks and documents the source/line in a header comment.
  - For each ply: assert the move is present in `legalMoves(state, from)` for the side to move (i.e. the engine *accepts* it as legal — match on `to` and, if applicable, `promotion`), then advance via `applyMove`. After the final move, assert `gameStatus(finalState) === "checkmate"`.
  - Translate algebraic coordinates to the engine grid (`[y, x]`, row 0 = Black back rank, row 7 = White; file a..h = x 0..7; rank 1..8 = y 7..0). A small local `algebraic(square)` helper inside the test file is fine; do NOT add a non-test parser.
  - Do NOT replay a drawn or unfinished game — the anchor's value is the terminal checkmate verdict. Do NOT touch engine source, `BoardSlice`, or `docs/plans/`.
  - Use **relative imports** and import from `vitest`.
- **Files owned:**
  - `src/game/engine/__tests__/recorded-game.test.ts` (new)
- **Success criteria:**
  - `vitest run` green; every ply of the chosen game is accepted by `legalMoves` and applied; the final `gameStatus` is `"checkmate"`.
  - An illegal intermediate move (if one were inserted) would fail the per-ply `legalMoves` membership assertion — the replay genuinely checks legality at each step, not just the final position.
  - `npx tsc --noEmit` clean.
- **Depends on:** — (disjoint files from `perft-start`; both start from `initialGameState()` with no shared writable surface, so they run in parallel in Wave 1)

### perft-tactical: Perft on one tactical position (Kiwipete) depth 1-2
- **Difficulty justification:** Reuses the perft recursion from `perft-start`, but the crux is **constructing the tactical position by hand** without a FEN parser: ~32 pieces placed into a sparse grid plus castling rights, where a hand-transcription slip would silently change the expected count. The position-construction risk is the whole reason this slice is scored 3, not 1.
- **Scope:**
  - Add a perft test for one published tactical position. Recommended: **Kiwipete** `r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -`, with published counts **depth 1 = 48, depth 2 = 2039** (depth 3 = 97862 is optional — only add it if the run stays fast). Assert at least depth 1 and depth 2.
  - Build the position with a test-only sparse builder that accepts `turn`, `placements` (`[y, x, PieceType]`), **`castling`**, and **`enPassant`** — Kiwipete needs full `KQkq` castling rights, so the builder MUST expose castling (the `game-status.ts` test's `makeState` hardcodes rights to `false` and is therefore insufficient; mirror instead the richer `stateWith(squares, overrides)` pattern in `apply-move-special.test.ts`). En-passant is `-` (null) for Kiwipete.
  - Piece-id assignment: `pieceKind` keys only on the id's kind substring, so any distinct `WhitePawnA..H` / `BlackPawnA..H` id may stand for any pawn regardless of its file, and the two rooks/knights/bishops per side map to their `QueenX`/`KingX` ids. Kiwipete uses exactly one queen per side (`WhiteQueen`/`BlackQueen`). Each occupied square gets a distinct, kind-correct `PieceType`. Document the FEN→grid transcription in a header comment so it is auditable.
  - Reuse the perft helper: import it from `perft-start`'s `perft-helper.ts` if that file was created; otherwise define a local `perft()` identical in contract (count `legalMoves` over all side-to-move pieces, recurse via `applyMove`, depth 0 → 1).
  - If, in practice, building Kiwipete by hand proves too error-prone or the FEN tooling it wants is out of scope, **fall back to a simpler documented tactical position** with published perft (e.g. a position with far fewer pieces) and record the substitution + its source in a PENDING — the anchor requirement is "one tactical position with published counts", not Kiwipete specifically.
  - Do NOT add a general FEN parser to non-test `src/` — a hand-built `GameState` (or a test-only builder) is the intended path; a parser is out of scope for this test-only sprint. Do NOT touch engine source, `BoardSlice`, or `docs/plans/`.
  - Use **relative imports** and import from `vitest`.
- **Files owned:**
  - `src/game/engine/__tests__/perft-tactical.test.ts` (new)
- **Success criteria:**
  - `vitest run` green; the tactical position's published counts pass at depth 1 and depth 2 (48 / 2039 for Kiwipete, or the documented counts of the substitute position).
  - The transcribed position's depth-1 move count matches the published value (a transcription error would surface here as a wrong depth-1 count), making the hand-built board self-checking against ground truth.
  - `npx tsc --noEmit` clean.
- **Depends on:** perft-start (reuses the perft recursion / shared `perft-helper.ts`; sequenced into Wave 2 so the helper contract is settled before this slice builds on it)

---

## Operational notes (carry to every slice dispatch)

- **Runner:** Vitest (`npx vitest run`), `environment: 'node'`. Import test API from `vitest`.
- **Imports:** **relative only** inside engine/test files — the tsconfig `baseUrl: ./src` alias does not resolve under Vitest (long-standing PENDING). No `game/...` imports.
- **Per-worktree install:** each engineer worktree must run `npm install --legacy-peer-deps` before tests/build (plain `npm install` is blocked by the `@types/node@^16` vs vitest peer conflict). **Retry-on-corrupt:** if the first install yields a corrupt partial tree (Windows npm optional-dep bug, `@rollup/rollup-win32-x64-msvc` invalid), delete `node_modules` and reinstall once.
- **Worktree teardown:** orchestrator should expect to `--force`-remove worktrees (they accumulate untracked per-worktree `node_modules`).
- **Strangler-fig:** test-only / additive sprint. Do **not** wire the engine or perft into `BoardSlice` — that is `cutover-cleanup`.
- **Branch naming:** flat `external-anchors-<slice-code>` (no `/`).
- **Smoke gate:** `docs/codebase-structure.md` `## Smoke recipe` is still a stub. This sprint adds **no runnable app surface** (pure additive tests), so — exactly as for `engine-foundation` — it is verified by `vitest run` + `tsc`, and the fail-closed runtime-smoke gate does not apply here. The stub still blocks `cutover-cleanup`; not this sprint's job to fill.

## Sprint summary

- **Slices shipped:** perft-start (#24), recorded-game (#23), perft-tactical (#25) — all merged to `main` via merge commits (admin-merge). Two waves: W1 `perft-start` ∥ `recorded-game` (parallel/disjoint) → W2 `perft-tactical` (reuses perft-start's `perft-helper.ts`).
- **Runtime smoke:** clean (no smoke PR) · bugs found+fixed: 0 · deferred: 0 — test-only/additive sprint, no app surface (nothing wired into `BoardSlice`). Verified by integrated `npm test` (160 passed, 17 files) + `npm run build` (compiled) on merged `main`.
- **Ground-truth result:** the hand-authored engine matches **all published perft counts on first run** — start position 20/400/8902 (depth 1–3) and Kiwipete 48/2039/97862 (depth 1–3) — plus a recorded Scholar's-mate replayed move-for-move to `gameStatus==="checkmate"`. **No engine bug surfaced.** This retires the plan's headline risk ("hand-authoring chess rules risks encoding our own misunderstanding").
- **Reviewer:** clean (no PR) · severe findings: 0 — four lenses clear over `5770c15..579fe0c`; hand-verified `perft()` is a faithful non-cheating board scan, counts are real published values asserted against genuine recursion, Kiwipete transcription exact, the recorded game checks per-ply legality + terminal checkmate, scope test-only.
- **Queue entries:** resolved 2 (sprint-draft ack; **smoke-recipe stub — filled by the orchestrator at this archive**, unblocking `cutover-cleanup`'s runtime-smoke gate), deferred 0 new. Earlier `special-moves` PENDINGs (5th-promotion clamp; promotion-id-table divergence risk re-pointed at cutover) remain open.
- **Approximate token cost:** ~3 engineer + 1 reviewer subagents + orchestration; rough order ~150–200k tokens across the sprint.
