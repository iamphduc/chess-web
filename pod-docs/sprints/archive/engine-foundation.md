# Sprint: Engine Foundation

_From plan: docs/plans/pure-engine-refactor.md · Slug: engine-foundation · Status: archived · Generated: 2026-06-04_

## Status board

| Wave | Slice | Title | Difficulty | Agent | Branch | PR | Status | Depends on |
|------|-------|-------|------------|-------|--------|----|--------|------------|
| 1 | harness | Stand up the Vitest test harness (vitest + config + green smoke test) | 2 | engineer-junior | engine-foundation-harness | #3 merged | done | — |
| 2 | gamestate | Define the immutable `GameState` value/type and initial-state factory | 3 | engineer-senior | engine-foundation-gamestate | #4 merged | done | harness |
| 3 | tracer | Tracer-bullet `legalMoves` + `applyMove` for one quiet move, end-to-end | 3 | engineer-senior | engine-foundation-tracer | #5 merged | done | gamestate |

> Re-sliced 2026-06-04: test runner switched from CRA/Jest to **Vitest** (see `docs/decisions.md` → "Vitest for the engine test suite, over CRA's Jest"). Because `vitest` is not installed until `harness` merges, `gamestate` and `tracer` now depend on `harness`, making the sprint 3 sequential waves.

Wave membership lives in the **Wave** column; slices sharing a wave run in parallel and must own disjoint file sets.

## Per-slice detail

### harness: Stand up the Vitest test harness (vitest + config + green smoke test)
- **Difficulty justification:** Mechanical tooling wiring — add Vitest, a minimal node-environment config, and a `test` script, then confirm it discovers and runs a test green. The only subtlety is pinning a Vitest version compatible with the project's Node and not disturbing the CRA app build.
- **Scope:** Add `vitest` as a dev dependency, a minimal `vitest.config.ts` (`test.environment: 'node'`; `globals` optional — prefer explicit `import { describe, it, expect } from 'vitest'`), and a `"test": "vitest run"` script in `package.json`. Add one trivial sanity test under the new engine test area (`src/game/engine/__tests__/harness.test.ts`) — e.g. asserting a constant — purely to prove the runner discovers and executes a test green. Do NOT remove or rewire CRA/`react-scripts` (the app build/dev server stays on it); do NOT touch any production source, the old engine, or the `GameState` type; do NOT author chess-rule tests here. The deliverable is "a developer can run `npm test` (→ `vitest run`) and see ≥1 passing test, 0 failing."
- **Files owned:** `package.json`, `package-lock.json`, `vitest.config.ts`, `src/game/engine/__tests__/harness.test.ts`
- **Success criteria:** `npm test` (`vitest run`) runs, discovers the suite, reports at least 1 passing test and 0 failures; `npx tsc --noEmit` stays clean; `npm run build` (CRA) still succeeds; no production source changed.
- **Depends on:** —

### gamestate: Define the immutable `GameState` value/type and initial-state factory
- **Difficulty justification:** Architecture-defining — this type is the seam the entire plan threads through (`legalMoves`/`applyMove`, future Redux history, hashable positions). Must be presentation-free (no `isEnemyAttacked`) and carry `castling`, `enPassant`, `promotionCount` per the decision record, getting the shape right matters more than the line count.
- **Scope:** Create the new engine module directory `src/game/engine/`. Define the immutable `GameState` type `{ squares, turn, castling, enPassant, promotionCount }`: `squares` is an 8×8 grid of `PieceType | null` (reuse the existing `game/piece-type` enum — do NOT redesign piece identity; the `{ kind, color }` redesign is explicitly quarantined); `turn` is the side to move; `castling` carries both sides' king/queen-side rights; `enPassant` is the optional target square (or null); `promotionCount` quarantines the promotion-id counter (the per-type counter array, mirroring the old `promotionBoardCount` shape). Provide a pure `initialGameState()` factory producing the standard start position (white to move, full castling rights, no en-passant target, zeroed promotion counts) — author this fresh; you may read `src/constants.ts` `initialSquares` as a reference for piece placement but the engine grid must NOT carry the `isEnemyAttacked` presentation flag. Write TDD tests pinning the factory's shape and that it returns a fresh value each call (no shared mutable reference). Do NOT implement move generation or `applyMove` here. Do NOT modify the old engine, `constants.ts`, or `BoardSlice`.
- **Files owned:** `src/game/engine/game-state.ts`, `src/game/engine/__tests__/game-state.test.ts`
- **Success criteria:** `GameState` type exported and compiles under `strict`; `initialGameState()` returns the documented start position; its tests are green via `npm test` (`vitest run`); two calls return independent (non-aliased) objects; `tsc --noEmit` and `npm run build` clean; no old-engine file touched.
- **Depends on:** harness (vitest must be installed to run the tests)

### tracer: Tracer-bullet `legalMoves` + `applyMove` for one quiet move, end-to-end
- **Difficulty justification:** Establishes the engine's core function signatures and the immutability contract end-to-end; deliberately narrow (one quiet move) but it sets the API shape every later sprint builds on, so the call boundary and return types must be chosen carefully.
- **Scope:** In a new `src/game/engine/engine.ts`, implement the minimal `legalMoves(state, from)` and `applyMove(state, move)` needed to prove the seam for exactly ONE quiet (non-capturing, non-special) move from the start position — e.g. a single pawn or knight push for white. `applyMove` must be pure: it returns a NEW `GameState` (input untouched) with the piece relocated and `turn` flipped. Write TDD tests that drive `initialGameState()` → `legalMoves` (includes the chosen target) → `applyMove` (resulting position correct, source square empty, destination filled, turn flipped, input state structurally unchanged). Keep generality minimal: it is fine for `legalMoves` to handle only the pawn/knight case the tracer exercises — full move generation for all pieces is the next sprint (`move-generation`) and must NOT be attempted here. Do NOT implement captures, castling, en passant, promotion, check, or king-safety. Do NOT wire this into `BoardSlice` or the running app — the old singleton engine stays live (strangler-fig); cutover is the final sprint. Do NOT modify the old engine.
- **Files owned:** `src/game/engine/engine.ts`, `src/game/engine/__tests__/engine.test.ts`
- **Success criteria:** Tests green: `legalMoves(initialGameState(), <from>)` contains the chosen quiet target; `applyMove` yields a `GameState` with the move applied and `turn` flipped; the input `GameState` is verifiably unmutated; `tsc --noEmit` and `npm run build` clean; old engine and live app untouched.
- **Depends on:** gamestate

---

## Field semantics

- **Wave:** the leading column — the parallel batch a slice runs in. Slices sharing a wave run concurrently and **must own disjoint file sets**. Assign waves to **maximize parallel width**: each slice goes in the *earliest* wave where (a) all its `Depends on` slices sit in strictly-earlier waves and (b) its `Files owned` are disjoint from every slice already in that wave. Open a new wave only when a dependency or file conflict forces it — never split independent, non-conflicting slices across waves. **Cap each wave at 5 slices**; eligible overflow spills into the next wave (still respecting deps and disjoint files).
- **Slug:** matches the row in the main plan's Sprint sequence (`docs/plans/pure-engine-refactor.md`).
- **Sprint doc Status:** `active` while in `docs/sprints/`; flipped to `archived` immediately before `mv` to `docs/sprints/archive/`.
- **Slice Status transitions:** `pending` → `pr open` → `done`, with `blocked` as terminal.
- **PR values:** `—` / URL / `blocked` / `skipped — verification failed` / `merged`.
- **Difficulty (1–5):** 1 = trivial; 3 = ordinary; 5 = architecture-touching or ambiguous. Scored per slice; justification belongs in the per-slice detail.
- **Agent:** derived from Difficulty — **1–2 → `engineer-junior`**, **3–5 → `engineer-senior`**. The board is canonical; per-slice detail never re-states the score or agent.
- **Branch naming:** `<sprint-slug>-<slice-code>` (kebab-case, **flat — no `/`** so a slice branch can't D/F-collide with a `<sprint-slug>`-named integration branch used as the merge-target).
- **Files owned:** explicit paths, verified to exist; cross-checked for disjointness within the wave.

## Sprint summary

Appended by the orchestrator after the last wave completes, immediately before archive.

- **Slices shipped:** harness (#3), gamestate (#4), tracer (#5) — all merged to `main` via merge commits (admin-merge; `main` branch protection requires a review the orchestrator can't supply).
- **Runtime smoke:** clean (no smoke PR) · bugs found+fixed: 0 · deferred: 0 — no runtime surface introduced (engine is additive, not wired into `BoardSlice`; strangler-fig keeps the live app on the old engine). Verified by integrated `npm test` (19 passed) + `npm run build` (compiled, 113 kB) on merged `main`. The `## Smoke recipe` stub remains unfilled — harmless this sprint, but will block from `cutover-cleanup` onward.
- **Reviewer:** clean (no PR) · severe findings: 0 — four lenses clean; immutable `GameState`/factory and `applyMove` verified mutation-free, white-pawn `legalMoves` correct, tests non-tautological.
- **Queue entries:** resolved 2 (sprint-draft ack; preflight push→PR), deferred 8 — all PENDING: `GameState` field-shape defaults · vitest tsconfig-alias resolution gap · per-worktree `npm install --legacy-peer-deps` · `@types/node@^16` peer pin · tracer scope-deferrals (full move-gen, special bookkeeping) · worktree teardown needs `--force` (untracked node_modules) · intermittent corrupt first install (npm optional-dep bug) · `castling.black` non-aliasing test nit.
- **Approximate token cost:** ~5 engineer/reviewer subagents + orchestration; rough order ~250–350k tokens across the sprint.
