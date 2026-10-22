# Sprint: Tidy

_From plan: pod-docs/plans/tidy.md · Slug: tidy · Status: done · Generated: 2026-10-21_

<!-- autopilot-run: started=2026-10-21T00:00:00Z sprints=0 waves=1 -->

## Status board

| Wave | Slice | Title | Branch | PR | Status | Confidence | Depends on |
|------|-------|-------|--------|----|--------|------------|------------|
| 1 | C1 | Import loops broken, a cycle test over all of `src`, `fallenPieces` gone, engine nits | tidy-C1 | #107 | merged | medium | — |
| 1 | D1 | Dead code out (`newLiemGame`, `previewSize`, `ButtonType.Undo`), one `PositionEval` | tidy-D1 | #107 | merged | high | — |
| 1 | S1 | Baseline save step tested, kept levels marked in the summary, `?? 0` fallbacks, timing-test timeouts | tidy-S1 | #107 | merged | medium | — |

Plan branch `tidy`; wave head `tidy-w1`. Merge target `tidy-staging` (`pod-docs/decisions.md` → "merge target: tidy-staging").

## Shared contract

Nothing a player sees changes. Every slice keeps `npm run build && npx vitest run --maxWorkers=2` green on its own branch.

- **No import cycle in `src` (owned by C1).** `tests/import-cycles.test.ts` fails when any `.ts` or `.tsx` file under `src/` reaches itself through imports.
  - **Edges:** every static `import … from "x"`, `export … from "x"` and side-effect `import "x"`, single-line or multi-line, where `x` is relative or starts with one of the tsconfig alias prefixes (`app/`, `assets/`, `features/`, `game/`, `hooks/`) and resolves to a file under `src/` as `x.ts`, `x.tsx`, `x/index.ts` or `x/index.tsx`.
  - **Not edges:** `import type …` and `export type …` (always erased by TypeScript); an import whose every named specifier is marked `type`, as in `import { type A, type B }` (erased because `tsconfig.json` has `isolatedModules` and no `verbatimModuleSyntax`; the test says so in a comment); dynamic `import()` (it loads later, so it doesn't set load order); npm packages; non-TS targets (`.css`, `.svg`, `.png`, `.json`).
  - **Counted:** a mixed list such as `import { type A, b }`, and a plain `import { Move }` even when `Move` is only a type.
  - **Failure output:** each cycle as a file path chain, for example `src/a.ts → src/b.ts → src/a.ts`.
- **Moved declarations (owned by C1; D1 and S1 never import them):**
  - `PiecePromoted` (same four members and string values) is declared only in `src/features/board/piecePromoted.ts` (new). `Promotion.tsx` imports it and doesn't re-export it.
  - `Move` and `Position` are declared only in `src/game/engine/move.ts` (new). `moves/*` import them from there. `engine.ts` keeps `export type { Move, Position } from "./move"`, so every other `from ".../engine/engine"` import still works.
  - `moveNumber` moves out of `MoveList.tsx` into `src/features/review/moveNumber.ts` (new). `GRADE_MARK` stays in `MoveList.tsx`.
- **`BoardState` has no `fallenPieces` (owned by C1).** Nothing saves the board store (a reload loses it, see `codebase-structure.md` → Screens), so no saved data needs reading. The captured glyphs and "+N" come from `materialLine` as before.
- **One `PositionEval` (owned by D1).** It's declared only in `src/game/review/types.ts`, as it is now. `reviewSlice.ts`, `analysis-runner.ts`, `reviewActions.ts` and their tests import it from there (`game/review/types` or a relative path under `src/game/`). No re-exports.
- **Baseline summary marks (owned by S1; C1 documents it in `codebase-structure.md` → Human baselines → Output).** After `npm run baseline`, each summary line for a level the file kept from an earlier run ends with ` (kept from the saved file)`. That covers a level outside `--levels`, and a level in `--levels` whose run kept no games, so its old entry stayed. A level this run wrote has no mark. A full run (all six levels) marks nothing. `${level}: no baseline` lines are unchanged.
- **Ports for the smoke recipe:** C1 uses `PORT=3201`, D1 `PORT=3202`, and S1 needs no server. Browser: `agent-browser` with `--session pod-<slice>`, plain Bash calls, never piped or captured.
- **Handoff queue:** the orchestrator resolves the matching `pod-docs/handoff-queue.md` entries at sprint end. These are the 10 entries this plan names: the four 2026-06-04 engine nits (not the promotion cap), `PositionEval`, the `measure.ts` fallbacks, the refresh leftovers, the baseline merge step, the partial-run summary, and the `src` cycles. No slice owns that file. Engineers still append new entries as usual.

## Per-slice detail

### C1: Import loops broken, a cycle test over all of `src`, `fallenPieces` gone, engine nits
- **Scope:**
  - **Break the three loops** using the moved declarations in the Shared contract. These are `BoardSlice.ts`/`engineAdapter.ts` → `components/Promotion.tsx` → `BoardSlice.ts`, `MoveList.tsx` ↔ `LeftBookNote.tsx`, and `engine.ts` ↔ `moves/*`. Point every test that imports `PiecePromoted` at `piecePromoted.ts`.
  - **Add the cycle test.** Keep the graph logic in a small pure module, `tests/import-graph.ts`. It reads a source's import edges, resolves a specifier against the set of `src` files, and finds cycles in a graph. `tests/import-cycles.test.ts` tests it on inline fixtures, then runs it on the real `src` tree, read with `node:fs`. If the walk finds a cycle beyond these three, break it the same way when its files are in this slice's Files owned. Otherwise, stop and raise a `BLOCKED` entry naming the cycle. Once, add a cycle back by hand, see the `src` test fail, and say so in your report.
  - **Drop `BoardSlice.fallenPieces`.** Remove the state field, its two `addFallenPiece` calls, and the then-unused `FallenPiece` and `addFallenPiece` in `src/game/piece-notation.ts`. Tests that asserted on `fallenPieces` now assert the capture another way: the piece is gone from the projected board, or through `materialLine`.
  - **Engine nits:**
    - `game-state.test.ts` also asserts that `castling.black` isn't shared between calls.
    - Drop the second `piece === null` check in `sliding.ts`'s `directionsFor`, which takes a non-null piece. `slidingMoves` keeps its own guard, since it's exported and called on empty squares.
    - Rewrite the `pieceKind` doc in `classify.ts` to describe the real rule: a priority-ordered `includes` match, PAWN → KNIGHT → BISHOP → ROOK → QUEEN → else king.
    - Drop the kind guard from `pawn.ts`, keeping its null check. That makes it like `knight.ts` and `king.ts`, which need no edit unless their docs claim otherwise.
  - **Docs:** update `pod-docs/codebase-structure.md` where it describes what changed. That covers `BoardSlice` ("fallen pieces"), the engine's `move.ts`, the `PiecePromoted` file, the review's `moveNumber.ts`, a **Tests** line for the cycle test, and the baseline summary mark from the contract. Also drop the stale "`fallenPieces` is still filled" line from `pod-docs/feature-details/moves-card-and-material.md`.
  - **Out of scope:** no behavior change. The `PromotionBoard` cap stays (out of scope in the plan). Don't touch `no-gameover-cycle.test.ts`.
- **Files owned:**
  - `src/features/board/piecePromoted.ts` (new), `src/features/board/components/Promotion.tsx`, `src/features/board/BoardSlice.ts`, `src/features/board/engineAdapter.ts`, `src/game/piece-notation.ts`
  - `src/features/review/moveNumber.ts` (new), `src/features/review/components/MoveList.tsx`, `src/features/review/components/LeftBookNote.tsx`
  - `src/game/engine/move.ts` (new), `src/game/engine/engine.ts`, `src/game/engine/moves/attack.ts`, `src/game/engine/moves/king.ts`, `src/game/engine/moves/knight.ts`, `src/game/engine/moves/pawn.ts`, `src/game/engine/moves/sliding.ts`, `src/game/engine/moves/classify.ts`, `src/game/engine/__tests__/game-state.test.ts`
  - Tests in `src/features/board/__tests__/`: `board-slice.test.ts`, `click-to-move.test.ts`, `opponent-move.test.ts`, `move-sound.test.ts`, `game-end.test.ts`, `game-over-card.test.tsx`, `moves-after-game-over.test.tsx`, `game-over-view.test.ts`, `promotion-clock.test.tsx`, `resign.test.ts`
  - `tests/import-graph.ts` (new), `tests/import-cycles.test.ts` (new)
  - `pod-docs/codebase-structure.md`, `pod-docs/feature-details/moves-card-and-material.md`
- **Success criteria:**
  - `[test]` A two-file loop and a three-file loop are each reported as a path chain — `tests/import-cycles.test.ts › finds two- and three-file cycles`
  - `[test]` An acyclic graph, and a file importing a module that imports nothing back, give no cycle — `tests/import-cycles.test.ts › returns no cycle for an acyclic graph`
  - `[test]` `import type`, `export type` and all-`type` lists aren't edges. `import { type A, b }` and a plain `import { Move }` are — `tests/import-cycles.test.ts › skips only type-only imports`
  - `[test]` Multi-line imports, `export … from` and side-effect imports are edges. Dynamic `import()`, npm packages and `.css`/`.svg`/`.json` targets aren't — `tests/import-cycles.test.ts › reads every static import form`
  - `[test]` Relative and alias specifiers resolve to `.ts`, `.tsx` and `index` files under `src` — `tests/import-cycles.test.ts › resolves relative and alias paths`
  - `[test]` The real `src` tree has no cycle, and the walk read more than 100 files — `tests/import-cycles.test.ts › src has no import cycle`
  - `[test]` `PiecePromoted` keeps its four values, imported from `piecePromoted.ts`, and a pick still promotes — `src/features/board/__tests__/board-slice.test.ts › promotePawn with PiecePromoted from its own module`
  - `[test]` A fresh and a reset board state have no `fallenPieces` key — `src/features/board/__tests__/board-slice.test.ts › reset returns a fresh state with no fallenPieces`
  - `[test]` A capture, an en passant and a capture-promotion still remove the taken piece and still sound as a capture. The existing tests are kept by name, with their `fallenPieces` checks replaced — `src/features/board/__tests__/move-sound.test.ts`, `click-to-move.test.ts`, `opponent-move.test.ts` › their capture tests
  - `[test]` `castling.black` isn't shared between calls either — `src/game/engine/__tests__/game-state.test.ts › does not share castling / promotionCount references between calls`
  - `[test]` The whole engine suite (perft counts, the replayed game, pawn, knight, king and sliding) passes unchanged — `src/game/engine/__tests__/*`
  - `[manual]` No change at 1400 and 375 px on `npm run dev` (`PORT=3201`), with no console errors. In Two players, castle, play en passant, capture (the glyph and "+N" show), then promote with each picker choice. In vs Liem, finish a game and open the review: the left-book line reads "Left his book at move N …" with the right move number, and the list numbers match.
- **Depends on:** —
- **One-way door:** none. `fallenPieces` is never saved.
- **Model:** opus

### D1: Dead code out (`newLiemGame`, `previewSize`, `ButtonType.Undo`), one `PositionEval`
- **Scope:**
  - **`newLiemGame`:** remove it from `liemActions.ts`. Its callers in `liem-actions.test.ts`, `board-modes.test.tsx` and `board-new-position.test.tsx` switch to `goHome`, which does the same in vs Liem. The `describe("newLiemGame")` block becomes `goHome` coverage, or is dropped where `goHome` is already tested the same way.
  - **`previewSize`:** remove it. `PieceDragPreview` gets its size from `squareSizeFor(useMediaQuery(WIDE_768), useMediaQuery(WIDE_1200))` (`boardSize.ts`). Drop the `previewSize` tests, since `squareSizeFor` already has its own in `board-size.test.ts`.
  - **`ButtonType.Undo`:** remove the member and anything that only handled it.
  - **`PositionEval`:** follow the contract. Delete the copies in `reviewSlice.ts` and `analysis-runner.ts`, and keep the `types.ts` doc comment as the one doc. Point `reviewActions.ts` and the tests at `game/review/types`.
  - **Docs:** drop the `newLiemGame` line from `pod-docs/feature-details/new-game.md`.
  - **Out of scope:** don't touch any file owned by C1 or S1.
- **Files owned:** `src/features/liem/liemActions.ts`, `src/features/liem/__tests__/liem-actions.test.ts`, `src/features/board/__tests__/board-modes.test.tsx`, `src/features/board/__tests__/board-new-position.test.tsx`, `src/features/board/components/PieceDragPreview.tsx`, `src/features/board/__tests__/piece-drag-preview.test.tsx`, `src/features/board/components/Button.tsx`, `src/features/board/__tests__/button-type.test.ts` (new), `src/features/review/reviewSlice.ts`, `src/features/review/reviewActions.ts`, `src/features/review/__tests__/review-slice.test.ts`, `src/features/review/__tests__/review-actions.test.ts`, `src/game/review/types.ts`, `src/game/review/analysis-runner.ts`, `src/game/review/__tests__/analysis-runner.test.ts`, `src/game/review/__tests__/position-eval.test.ts` (new), `pod-docs/feature-details/new-game.md`
- **Success criteria:**
  - `[test]` `liemActions` exports no `newLiemGame`, and `goHome` from a vs-Liem game resets the board and opens home — `src/features/liem/__tests__/liem-actions.test.ts › exports no newLiemGame; goHome ends the game`
  - `[test]` The board-modes and new-position tests that called `newLiemGame` pass with `goHome` and keep their expectations — `src/features/board/__tests__/board-modes.test.tsx`, `board-new-position.test.tsx` › the same test names
  - `[test]` The preview module exports `PieceDragImage` and `PieceDragPreview` and no `previewSize` — `src/features/board/__tests__/piece-drag-preview.test.tsx › preview module has no size helper of its own`
  - `[test]` `ButtonType` is exactly Play, Reset, Flip and Sound — `src/features/board/__tests__/button-type.test.ts › ButtonType lists Play, Reset, Flip and Sound only`
  - `[test]` Exactly one `interface PositionEval` or `type PositionEval =` exists in `src` (non-test sources), and it's in `src/game/review/types.ts`. It uses `import.meta.glob` raw sources, as `no-gameover-cycle.test.ts` does — `src/game/review/__tests__/position-eval.test.ts › PositionEval is declared once, in game/review/types.ts`
  - `[test]` The review slice, review actions and analysis runner suites pass with the one type — `review-slice.test.ts`, `review-actions.test.ts`, `analysis-runner.test.ts` › all
  - `[manual]` No change on `npm run dev` (`PORT=3202`). At 1400 px the Moves card feet read as before (New game, Resign, Flip, Sound in a vs-Liem game). At 375 px, a touch drag (`pod-docs/known-issues/browser-smoke-touch.md`) shows the dragged piece at the square size, 39 px.
- **Depends on:** —
- **One-way door:** none
- **Model:** sonnet

### S1: Baseline save step tested, kept levels marked in the summary, `?? 0` fallbacks, timing-test timeouts
- **Scope:**
  - **Baseline save step:** move `main`'s read-merge-write step in `scripts/ladder/baseline.ts` into an exported function: `saveBaseline(measured: BaselineFile, levels: readonly number[], io: { read(): Promise<string | null>; write(text: string): Promise<void> }): Promise<BaselineFile>`. It returns the file it wrote.
    - When `levels` is all six sparring levels, it writes `serializeBaseline(measured)` and never calls `read`.
    - Otherwise it reads, parses with `parseExistingBaseline` (a missing or broken file means no existing file), merges with `mergeBaseline`, and writes the merged file once.
    - A rejected `write` rejects `saveBaseline`. `main` then prints no summary and exits non-zero, as it does now.
    - `main` calls it with the real file functions, and prints the summary from the returned file.
  - **Summary marks:** `summaryLines(file, measured?: readonly LevelKey[])` adds the contract's ` (kept from the saved file)` to each level line not in `measured`. `main` passes the keys of the run's own `measured.levels`. With no second argument, nothing is marked.
  - **Fallbacks:** drop the `?? 0` from the four band fields in `profileLine` (`scripts/calibrate/measure.ts`) and in `bandPick` (`src/game/opponent/human-move.ts`). They're required in `StepProfile`. Fix the `profileLine` doc ("missing = 0").
  - **Timeouts:** give `tests/vite-config.test.ts › ignores an invalid PORT` a 30 000 ms timeout. Find the slowest tests in `src/game/opponent/__tests__/human-move.test.ts`, the sampling loops, by timing the file alone, and give the ones over about 1 s a 30 000 ms timeout too.
  - **Docs:**
    - `pod-docs/feature-details/human-baselines.md`: in Watch out, say the summary marks kept levels, add a History line.
    - `pod-docs/known-issues/timing-tests-under-load.md`: strike the two fixed items as the clock test's is, naming the timeouts.
  - **Out of scope:** the baseline header (`generated`, `skipPlies`) still comes from the latest run (plan Out of scope). No change to how levels are measured or merged.
- **Files owned:** `scripts/ladder/baseline.ts`, `scripts/ladder/__tests__/baseline.test.ts`, `scripts/calibrate/measure.ts`, `scripts/calibrate/__tests__/measure.test.ts`, `src/game/opponent/human-move.ts`, `src/game/opponent/__tests__/human-move.test.ts`, `tests/vite-config.test.ts`, `pod-docs/feature-details/human-baselines.md`, `pod-docs/known-issues/timing-tests-under-load.md`
- **Success criteria:**
  - `[test]` A partial run reads the saved file once and writes the merged file once, keeping unmeasured levels. It fails if only the run is written — `scripts/ladder/__tests__/baseline.test.ts › saveBaseline writes the merged file on a partial run`
  - `[test]` A run of all six levels writes the run alone and never reads — `scripts/ladder/__tests__/baseline.test.ts › saveBaseline writes a full run whole without reading`
  - `[test]` A missing (`null`) or broken saved file on a partial run writes just the run's levels — `scripts/ladder/__tests__/baseline.test.ts › saveBaseline starts empty when the saved file is missing or broken`
  - `[test]` A failing write rejects with that error — `scripts/ladder/__tests__/baseline.test.ts › saveBaseline rejects when the write fails`
  - `[test]` Levels outside the run end in " (kept from the saved file)", and measured ones don't — `scripts/ladder/__tests__/baseline.test.ts › summaryLines marks levels this run didn't measure`
  - `[test]` A level in `--levels` whose run kept no games, so its old entry stayed, is marked — `scripts/ladder/__tests__/baseline.test.ts › summaryLines marks an old level the run kept no games for`
  - `[test]` No second argument, or a full run, gives no mark, and missing levels still read "no baseline" — `scripts/ladder/__tests__/baseline.test.ts › summaryLines marks nothing after a full run`
  - `[test]` Every step's profile line prints its own `mistakeChance`, `blunderChance`, `blunderMaxCp` and `hangWeight`, and Liem's prints 0 for each — `scripts/calibrate/__tests__/measure.test.ts › profileLine prints the band fields of every step`
  - `[test]` The band pick is unchanged, with the existing band and rate tests passing — `src/game/opponent/__tests__/human-move.test.ts`, `chooser-rates.test.ts` › all
  - `[test]` The PORT test runs with a 30 000 ms timeout and passes — `tests/vite-config.test.ts › ignores an invalid PORT`
- **Depends on:** —
- **One-way door:** none. `npm run baseline` isn't run in this sprint, and the committed `human-baselines.json` is untouched.
- **Model:** opus

## Sprint summary

- **Synced with merge-target:** up to date
- **Slices shipped:** C1, D1, S1 (wave PR #107)
- **Queue entries:** resolved 10, deferred 0
- **Slice log:**
  - C1: opus · medium · test-first yes · runtime two-player castle, en passant, all four promotions at 1400 and 375 px, a vs-Liem game into the review · 3 NOTEs (branched off `tidy` as dispatched; `Piece.getWeight()` now unused; cycle-test limits) · time lost none
  - D1: sonnet · high · test-first yes · runtime vs-Liem Moves card at 1400 px, touch drag at 375 px (39 px preview) · 0 NOTEs · time lost none
  - S1: opus · medium · test-first partly — the `?? 0` removal and the full-run summary can't go red, since behavior didn't change · runtime `saveBaseline` on a scratch copy of the baselines file, the CLI flag error · 5 NOTEs · time lost none
  - Wave check: build and 1266 tests pass; a two-player game to mate in the browser. No wave fix.
- **Agent context at hand-back:** 365k (each agent's final context size, not tokens billed)
