# Sprint: Engine Foundation

_From plan: docs/plans/pure-engine-refactor.md · Slug: engine-foundation · Status: active · Generated: 2026-06-04_

<!-- autopilot-run: started=2026-06-04T09:17:01Z sprints=0 waves=0 -->

## Status board

| Wave | Slice | Title | Difficulty | Agent | Branch | PR | Status | Depends on |
|------|-------|-------|------------|-------|--------|----|--------|------------|
| 1 | harness | Stand up the Jest test harness (setupTests + green smoke test) | 2 | engineer-junior | engine-foundation-harness | — | pending | — |
| 1 | gamestate | Define the immutable `GameState` value/type and initial-state factory | 3 | engineer-senior | engine-foundation-gamestate | — | pending | — |
| 2 | tracer | Tracer-bullet `legalMoves` + `applyMove` for one quiet move, end-to-end | 3 | engineer-senior | engine-foundation-tracer | — | pending | gamestate |

Wave membership lives in the **Wave** column; slices sharing a wave run in parallel and must own disjoint file sets.

## Per-slice detail

### harness: Stand up the Jest test harness (setupTests + green smoke test)
- **Difficulty justification:** Mechanical wiring of already-installed tooling (`react-scripts test`, jest-dom); the only subtlety is making CRA's test runner discover the suite and confirming it exits green with non-zero tests.
- **Scope:** Create `src/setupTests.ts` importing `@testing-library/jest-dom` (the file CRA auto-loads but which does not yet exist). Add one trivial sanity test under the new engine test area (`src/game/engine/__tests__/harness.test.ts`) — e.g. asserting a constant — purely to prove the runner discovers and executes a test green. Do NOT touch any production source, the old engine, or the `GameState` type; do NOT author chess-rule tests here. The deliverable is "a developer can run `CI=true npm test` and see ≥1 passing test, 0 failing."
- **Files owned:** `src/setupTests.ts`, `src/game/engine/__tests__/harness.test.ts`
- **Success criteria:** `CI=true npm test` (or `react-scripts test --watchAll=false`) runs, discovers the suite, reports at least 1 passing test and 0 failures; `tsc --noEmit` stays clean; no production files changed.
- **Depends on:** —

### gamestate: Define the immutable `GameState` value/type and initial-state factory
- **Difficulty justification:** Architecture-defining — this type is the seam the entire plan threads through (`legalMoves`/`applyMove`, future Redux history, hashable positions). Must be presentation-free (no `isEnemyAttacked`) and carry `castling`, `enPassant`, `promotionCount` per the decision record, getting the shape right matters more than the line count.
- **Scope:** Create the new engine module directory `src/game/engine/`. Define the immutable `GameState` type `{ squares, turn, castling, enPassant, promotionCount }`: `squares` is an 8×8 grid of `PieceType | null` (reuse the existing `game/piece-type` enum — do NOT redesign piece identity; the `{ kind, color }` redesign is explicitly quarantined); `turn` is the side to move; `castling` carries both sides' king/queen-side rights; `enPassant` is the optional target square (or null); `promotionCount` quarantines the promotion-id counter (the per-type counter array, mirroring the old `promotionBoardCount` shape). Provide a pure `initialGameState()` factory producing the standard start position (white to move, full castling rights, no en-passant target, zeroed promotion counts) — author this fresh; you may read `src/constants.ts` `initialSquares` as a reference for piece placement but the engine grid must NOT carry the `isEnemyAttacked` presentation flag. Write TDD tests pinning the factory's shape and that it returns a fresh value each call (no shared mutable reference). Do NOT implement move generation or `applyMove` here. Do NOT modify the old engine, `constants.ts`, or `BoardSlice`.
- **Files owned:** `src/game/engine/game-state.ts`, `src/game/engine/__tests__/game-state.test.ts`
- **Success criteria:** `GameState` type exported and compiles under `strict`; `initialGameState()` returns the documented start position; its tests are green; two calls return independent (non-aliased) objects; `tsc --noEmit` and `npm run build` clean; no old-engine file touched.
- **Depends on:** —

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

- **Slices shipped:** <slice-code list>
- **Runtime smoke:** <PR URL | clean> · bugs found+fixed: <N> (runtime regressions static checks missed) · deferred: <M>
- **Reviewer:** <PR URL | clean> · severe findings: <N> (count of `SEVERE:` PENDING entries emitted)
- **Queue entries:** resolved <N>, deferred <M> — link the deferred ones inline
- **Approximate token cost:** <number or rough range>
