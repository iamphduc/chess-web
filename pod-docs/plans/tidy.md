# Plan: Tidy — break the import loops, drop dead code, close the engine and script nits

_Generated: 2026-10-21 · Status: active · Grilled-with: pod (fast)_
Port base: 3200

## Goal
Clear the code-only items left in the handoff queue in one pass. Nothing a player sees changes: the import loops in `src` go away and a test keeps them gone, dead code is removed, `PositionEval` is declared once, the June engine nits are closed, and the ladder baseline's merge step gets a test.

## Why
The human asked to "fix them all at once" (2026-10-21) after a review of what is still open. Each item is small and harmless alone, but they pile up in the queue and the loops make module load order fragile.

Success:
- No import cycle anywhere in `src`, checked by a test.
- The listed dead code is gone and every test still passes.
- The matching handoff-queue entries are resolved.

Constraints: no visible behavior change, no new dependencies, static GitHub Pages site under `/liem-sparring/`.

## Scope
**In scope:**
- **Import loops:** move the `PiecePromoted` enum out of `src/features/board/components/Promotion.tsx` into its own file (as `gameOverType.ts` did for `GameOverType`), breaking `BoardSlice.ts`/`engineAdapter.ts` → `Promotion.tsx` → `BoardSlice.ts`. Break `review/components/MoveList.tsx` ↔ `LeftBookNote.tsx` and `game/engine/engine.ts` ↔ `moves/*`. Add a test that walks the relative imports under `src` and fails on any cycle (type-only imports count too, unless the engineer shows they are erased and says so in the test).
- **Dead code:** remove `newLiemGame` (update the tests that call it: `board-modes`, `board-new-position`, `liem-actions`), `PieceDragPreview.previewSize` (use `squareSizeFor`), `ButtonType.Undo`, and `BoardSlice.fallenPieces`; drop the `?? 0` fallbacks for required fields in `scripts/calibrate/measure.ts`.
- **One `PositionEval`:** declared once (in `src/game/review/types.ts`), imported by `reviewSlice.ts` and `analysis-runner.ts`.
- **Engine nits from June:** `game-state.test.ts` also asserts `castling.black` non-aliasing; drop the redundant `piece === null` check in `slidingMoves`; fix the `pieceKind` doc in `classify.ts` to describe the priority-ordered match; make the defensive kind guard consistent across `pawn.ts`, `knight.ts` and `king.ts` (drop it from `pawn.ts`, since moves are dispatched by kind).
- **Ladder baseline:** move `main`'s read-merge-write step in `scripts/ladder/baseline.ts` into an exported function that takes read and write functions, and test it. After a partial `--levels` run, the summary marks which levels this run measured, so an old level's line doesn't look fresh.
- **Timing test:** a longer timeout on `tests/vite-config.test.ts` "ignores an invalid PORT" (and on the `human-move` test that hit 5 s under load).
- **Docs:** resolve the matching `pod-docs/handoff-queue.md` entries; update `pod-docs/known-issues/timing-tests-under-load.md`, `pod-docs/codebase-structure.md` and `pod-docs/feature-details/human-baselines.md` where they describe what changed.

**Out of scope** (each needs a human decision; stays queued):
- Review search noise at 500 ms.
- Adding jsdom.
- The promotion cap of 4 per type (the 5th clamps to `*Promoted4`).
- The overlap below 300 px.
- The legacy Sound key fallback and the `reviewOverPlay` history marker.
- The baseline header (`generated`, `skipPlies`) coming from the latest run.
- The 11 agent defaults in `pod-docs/decisions.md`.

## Sprint sequence

| Sprint | Goal | Status | Depends on |
|--------|------|--------|------------|
| tidy | No import loops, dead code gone, one `PositionEval`, engine nits closed, baseline merge tested | done | — |

Status values: `planned` / `active` / `done`. The orchestrator only flips its row's Status — it does not rewrite Goal/Depends-on retroactively.

The `Depends on` column is the **only** cross-sprint dependency signal. Wave ordering and per-slice deps live inside the sprint doc and are opaque from here.

## Look
none — no UI change. The app must look and behave exactly as on `main`.

## Key decisions
- **One sprint of code-only cleanup, no visible change** (human, "go", 2026-10-21).
- **Ships in `tidy-staging`, cut from `main` at f5d8e13** (human, per "Each plan gets its own staging branch").
- **The cycle test covers all of `src`** (default), so new loops fail CI.
- **`PositionEval` lives in `src/game/review/types.ts`** (default): the pure game layer owns it and features import from there.
- **The kind guard goes from `pawn.ts`** rather than being added to `knight.ts` and `king.ts` (default): dispatch is by kind, and the queue entry calls it defensive only.

## Known risks
- **Moving an enum can change the order modules load in.** Mitigation: the build, the full test run and a browser smoke of a game with a promotion.
- **Removing `fallenPieces` may touch saved state.** Mitigation: check nothing persists it; if something does, keep reading old data without it.

## Open questions
- None.

## Verification
- `npm run build && npx vitest run --maxWorkers=2` pass.
- The new cycle test passes and fails when a cycle is added back (shown once by the engineer).
- `grep` finds no `newLiemGame`, `previewSize`, `ButtonType.Undo`, `fallenPieces` or `mistakeChance ?? 0` in `src`/`scripts`, and one `PositionEval` declaration.
- The baseline merge test fails if `main` writes only the new run instead of the merged file.
- **Browser:** home, a game with a promotion and a castle, and the review behave as on `main` at 1400 and 375 px.
- The handoff-queue entries for these items are resolved.
