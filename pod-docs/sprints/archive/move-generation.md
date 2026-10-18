# Sprint: Move Generation

_From plan: docs/plans/pure-engine-refactor.md · Slug: move-generation · Status: archived · Generated: 2026-06-04_

## Status board

| Wave | Slice | Title | Difficulty | Agent | Branch | PR | Status | Depends on |
|------|-------|-------|------------|-------|--------|----|--------|------------|
| 1 | geometry | Shared piece classification + board-geometry helpers (kind/color, `inBounds`, ray/offset walkers) | 3 | engineer-senior | move-generation-geometry | merged | done | — |
| 2 | sliding | Stateless sliding-piece generator (bishop / rook / queen) with blocker stops | 3 | engineer-senior | move-generation-sliding | merged | done | geometry |
| 2 | knight | Stateless knight generator (eight L-offsets, own-piece blocking) | 2 | engineer-junior | move-generation-knight | merged | done | geometry |
| 2 | king-step | Stateless king single-step generator (eight neighbours; NO castling) | 2 | engineer-junior | move-generation-king-step | merged | done | geometry |
| 2 | pawn | Stateless pawn generator (single/double push, diagonal captures; NO en-passant/promotion) | 3 | engineer-senior | move-generation-pawn | merged | done | geometry |
| 3 | dispatch | Generalize `legalMoves` to a per-kind dispatcher + named bounds-bug regression test | 3 | engineer-senior | move-generation-dispatch | merged | done | sliding, knight, king-step, pawn |

Wave membership lives in the **Wave** column; slices sharing a wave run in parallel and must own disjoint file sets.

## Per-slice detail

### geometry: Shared piece classification + board-geometry helpers

- **Difficulty justification:** This is the shared seam every generator and the dispatcher import — it fixes the generator-interface shape and the on-board predicate that the bounds-bug regression hinges on. Getting the classification of the quarantined promoted `PieceType` ids right (e.g. `WhiteQueenPromoted2` → queen/white) and choosing offset/ray representations that the four downstream generators can all reuse is design-defining, not mechanical. Wrong here and every Wave 2 slice inherits the mistake.
- **Scope:** Create `src/game/engine/moves/classify.ts`. Provide pure helpers the generators and dispatcher share:
  - `pieceKind(piece: PieceType): "pawn" | "knight" | "bishop" | "rook" | "queen" | "king"` — must classify the **promoted** ids too (`*KnightPromoted*` → knight, `*BishopPromoted*` → bishop, `*RookPromoted*` → rook, `*QueenPromoted*` → queen). Reuse `colorOf` semantics already in `engine.ts` (prefix `WHITE_`/`BLACK_`) — export a `colorOf(piece: PieceType): PieceColor` here so the dispatcher/generators stop duplicating it.
  - `inBounds(y: number, x: number): boolean` — `y` and `x` each in `[0, 8)`. This is the **canonical** on-board predicate; the old engine's `toX < 8`-written-as-`toY < 8` bug must be impossible to reproduce because every generator checks `x` and `y` through this one function. Add a doc comment noting it exists to prevent that class of bug.
  - A small occupancy helper, e.g. `occupant(state, y, x): PieceType | null` and/or `relationTo(mover: PieceColor, target: PieceType | null): "empty" | "friendly" | "enemy"`, so each generator decides stop/capture uniformly.
  - Offset/direction constants the generators consume: e.g. `BISHOP_DIRS`, `ROOK_DIRS`, `QUEEN_DIRS` (= bishop ∪ rook), `KNIGHT_OFFSETS`, `KING_OFFSETS` as `readonly [dy, dx][]`. Keep them `readonly`.
  - Decide and document the **generator function signature** all four Wave-2 slices implement (e.g. `(state: GameState, from: Position) => Move[]`, importing `Move`/`Position` from `../engine`). Pin it in the file's doc comment so parallel slices don't diverge.
  Use **relative imports** (`../game-state`, `../../piece-type`, `../engine`) — `vitest.config.ts` does not resolve tsconfig `baseUrl` aliases (handoff-queue, gamestate slice). Do NOT implement any per-piece move generation here, do NOT touch `engine.ts`'s `legalMoves`, do NOT do king-safety/check filtering. Write TDD tests pinning `pieceKind` for a representative base piece and a promoted piece of each kind, `colorOf` for both colours, and `inBounds` at all four edges plus the off-board cases (`-1`, `8`) for **both** axes (the off-by-axis case `inBounds(0, 8) === false` is the regression seed).
- **Files owned:** `src/game/engine/moves/classify.ts`, `src/game/engine/moves/__tests__/classify.test.ts`
- **Success criteria:** `pieceKind`/`colorOf`/`inBounds`/occupancy helpers + direction constants exported and compile under `strict`; tests green via `npm test` (`vitest run`); `inBounds(0, 8)` and `inBounds(8, 0)` both `false`; promoted ids classify to their base kind; `npx tsc --noEmit` and `npm run build` clean; `engine.ts` and the old engine untouched.
- **Depends on:** —

### sliding: Stateless sliding-piece generator (bishop / rook / queen)

- **Scope:** Create `src/game/engine/moves/sliding.ts` exporting a generator (the signature `geometry` pins) for bishop, rook and queen. Walk each direction ray from `from` via the `*_DIRS` constants until off-board (`inBounds` false) or blocked: a **friendly** piece stops the ray and is NOT a target; an **enemy** piece is a capture target and then stops the ray; empty squares are quiet targets and the ray continues. Generate **pseudo-legal** moves only — do NOT filter for leaving one's own king in check (that is the `king-safety-endgame` sprint). Determine kind via `geometry`'s `pieceKind` (so it handles promoted rooks/bishops/queens). Use **relative imports**. Do NOT modify `engine.ts`, do NOT handle pawns/knights/king, no castling, no captures bookkeeping beyond producing the capture `Move` endpoints. TDD: bishop on an open board reaches all four diagonals to the edge; a rook stops before a friendly piece and includes an enemy as a capture but not the square beyond it; a queen equals bishop ∪ rook from the same square; a ray correctly stops at the board edge (no off-board square emitted) — exercise a ray heading toward the `x === 8` and `y === 8` edges so an axis-confused bound would surface.
- **Files owned:** `src/game/engine/moves/sliding.ts`, `src/game/engine/moves/__tests__/sliding.test.ts`
- **Success criteria:** generator exported with the agreed signature; bishop/rook/queen rays stop on blockers, include enemy captures, exclude friendly-occupied and beyond-blocker squares, emit no off-board square; tests green via `npm test`; `tsc --noEmit` + `npm run build` clean; only owned files changed.
- **Depends on:** geometry

### knight: Stateless knight generator

- **Difficulty justification:** Fixed eight-offset jump with a single friendly/off-board filter — the simplest generator, no ray walking, no special cases.
- **Scope:** Create `src/game/engine/moves/knight.ts` exporting the agreed generator. For each of `geometry`'s `KNIGHT_OFFSETS`, the target is legal iff `inBounds` and not friendly-occupied (enemy = capture, empty = quiet). Pseudo-legal only (no check filtering). Handle promoted knight ids via `pieceKind`. Relative imports. Do NOT touch `engine.ts` or other piece modules. TDD: a centre knight yields all eight targets; a corner knight yields exactly two and emits no off-board square (covers the bounds case on both axes); friendly-occupied targets are excluded; an enemy-occupied target is included as a capture.
- **Files owned:** `src/game/engine/moves/knight.ts`, `src/game/engine/moves/__tests__/knight.test.ts`
- **Success criteria:** generator exported; centre = 8 moves, corner = 2 with no off-board square; friendly excluded, enemy included; tests green; `tsc --noEmit` + `npm run build` clean; only owned files changed.
- **Depends on:** geometry

### king-step: Stateless king single-step generator

- **Difficulty justification:** Eight neighbour offsets with the same friendly/off-board filter as the knight; the only subtlety is the explicit non-scope (no castling, no self-check filtering) which must be respected, not implemented.
- **Scope:** Create `src/game/engine/moves/king.ts` exporting the agreed generator. For each of `geometry`'s `KING_OFFSETS` (the eight adjacent squares), the target is legal iff `inBounds` and not friendly-occupied. **Castling is explicitly out of scope** — it is the `special-moves` sprint; generate single steps only. Pseudo-legal only — do NOT exclude squares attacked by the enemy or filter for self-check (that is `king-safety-endgame`). Relative imports. Do NOT touch `engine.ts` or other piece modules. TDD: a centre king yields all eight neighbours; a corner king yields exactly three and emits no off-board square (covers bounds on both axes); friendly-occupied neighbours excluded; an enemy neighbour included as a capture; assert that NO two-square (castling) move is produced.
- **Files owned:** `src/game/engine/moves/king.ts`, `src/game/engine/moves/__tests__/king.test.ts`
- **Success criteria:** generator exported; centre = 8, corner = 3, no off-board or two-square move; friendly excluded, enemy included; tests green; `tsc --noEmit` + `npm run build` clean; only owned files changed.
- **Depends on:** geometry

### pawn: Stateless pawn generator (push + diagonal capture)

- **Difficulty justification:** Pawns are direction-dependent on colour, mix quiet pushes with capture-only diagonals, and gate the double-step on the start rank — the most rule-laden generator. The off-by-axis bounds bug originally manifested on pawn diagonal captures, so the edge handling here is load-bearing. The hard part is staying inside the no-en-passant / no-promotion boundary while still producing correct ordinary captures.
- **Scope:** Create `src/game/engine/moves/pawn.ts` exporting the agreed generator, **generalizing the tracer's white-pawn-push logic to both colours**. White moves toward row 0 (`y - 1`), Black toward row 7 (`y + 1`). Single push to the square ahead iff empty; double push from the start rank (White row 6, Black row 1) iff **both** the intervening and landing squares are empty. Diagonal captures: the two forward diagonals are targets **only** when occupied by an enemy piece (`inBounds` first — a file-edge pawn has only one diagonal, and the missing one must be dropped via `inBounds`, not allowed to wrap or overflow). Generate **pseudo-legal** moves only. **Explicitly out of scope:** en-passant target consumption (the diagonal-onto-empty-via-`enPassant` case) and promotion (a push/capture onto the last rank emits an ordinary `Move`, NOT a promotion-typed one) — both belong to the `special-moves` sprint; do NOT read `state.enPassant` or touch `promotionCount`. Handle the quarantined promoted-pawn case defensively only if `pieceKind` ever returns `"pawn"` for one — base pawns are `*PawnA..H`; promoted pieces are never pawns, so promoted ids never reach this generator. Relative imports. Do NOT touch `engine.ts` or other piece modules. TDD: white start-rank pawn yields single + double push; after one push (off start rank) only single push; push blocked by a piece directly ahead yields no push (and double push blocked if the intervening square is occupied); diagonal capture included only when an enemy sits there, excluded when empty or friendly; a Black pawn mirrors all of the above in the `+y` direction; an a-file / h-file pawn drops the off-board diagonal (bounds, both axes); a pawn reaching the last rank emits a plain `Move` (no promotion field) — pin this so `special-moves` can later extend it.
- **Files owned:** `src/game/engine/moves/pawn.ts`, `src/game/engine/moves/__tests__/pawn.test.ts`
- **Success criteria:** generator exported; both colours push correctly (single always when clear, double only from start rank with a clear path); diagonal captures only onto enemies; edge-file diagonals dropped with no off-board square; no en-passant or promotion behaviour present; tests green; `tsc --noEmit` + `npm run build` clean; only owned files changed.
- **Depends on:** geometry

### dispatch: Generalize `legalMoves` to a per-kind dispatcher + bounds-bug regression

- **Difficulty justification:** This is the integration seam — it rewrites the tracer's white-pawn-only `legalMoves` into a real dispatcher over all six kinds and both colours, and it owns the required bounds-bug regression. It is the one slice that touches the shared `engine.ts`, so it must land last and reconcile every generator's contract; getting the turn/empty/off-board guards and the regression framing right is the crux of the whole sprint.
- **Scope:** Rewrite `legalMoves` in `src/game/engine/engine.ts` to: return `[]` for an off-board `from`, an empty `from`, or a piece whose `colorOf` (now imported from `moves/classify.ts`) does not match `state.turn`; otherwise classify via `pieceKind` and delegate to the matching generator (`sliding` for bishop/rook/queen, `knight`, `king`, `pawn`). Replace the tracer's local `WHITE_PAWNS`/`inBounds`/`colorOf` with the shared `classify.ts` versions (remove the now-dead tracer pawn logic; the `pawn` generator subsumes it). Keep `applyMove`, `Move`, `Position` exactly as-is (this sprint does not change move application — captures already work because `applyMove` overwrites the destination; special-move bookkeeping is a later sprint). The existing tracer tests in `engine.test.ts` must stay green (e2→e3 still produced, empty square and out-of-turn still empty). Pseudo-legal output is the contract — state in a code comment that king-safety/check filtering arrives in `king-safety-endgame`. **Bounds-bug regression (required):** add `src/game/engine/__tests__/bounds-regression.test.ts` with a named test — e.g. `it("bounds bug regression: never generates a move with an off-board destination", ...)` — that drives `legalMoves` for pieces positioned at board edges/corners (a corner knight, an h-file pawn, a bishop/rook on an edge heading off-board, a corner king) and asserts **every** returned `Move.to` satisfies `0 <= y < 8 && 0 <= x < 8` on **both** axes. The test must fail against the old engine's `toY < 8`-for-`toX` logic and pass against the shared `inBounds`. Reference the bug in the test's doc comment (old `piece-moves.ts:69`/`:98`, `BoardSlice.ts:92` wrote the x-bound as `toY < 8`). Do NOT modify the old engine, `piece-moves.ts`, `BoardSlice.ts`, or any `src/game/pieces/*`; do NOT wire the new engine into `BoardSlice` (strangler-fig). Relative imports. The other Wave-2 generator files are read-only inputs here — do not edit them.
- **Files owned:** `src/game/engine/engine.ts`, `src/game/engine/__tests__/bounds-regression.test.ts`
- **Success criteria:** `legalMoves` dispatches all six kinds for both colours from arbitrary positions, returns `[]` for off-board/empty/out-of-turn `from`; the named bounds-regression test is present and green; the existing `engine.test.ts` tracer tests still pass; full `npm test` suite green; `npx tsc --noEmit` and `npm run build` clean; old engine, `pieces/*`, `piece-moves.ts`, `BoardSlice.ts` untouched; new engine not wired into the app.
- **Depends on:** sliding, knight, king-step, pawn

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

## Operational notes (carried from engine-foundation)

- **Per-worktree install:** worktrees don't share `node_modules`; each slice must run `npm install --legacy-peer-deps` in its worktree before tests/build (plain `npm install` is blocked by the `@types/node@^16` vs vitest peer conflict). No runtime impact.
- **Corrupt-first-install retry:** if the first install yields a corrupt tree (npm optional-dep extraction bug on Windows — `@rollup/rollup-win32-x64-msvc` invalid), delete `node_modules` and reinstall once.
- **Relative imports under Vitest:** `vitest.config.ts` does NOT resolve tsconfig `baseUrl` aliases. All engine modules use **relative imports** (`../game-state`, `../../piece-type`, `../engine`). This sprint does not add `vite-tsconfig-paths` — it would be a config-owning slice with no functional payload and is not worth a wave here.
- **Worktree teardown** may need `git worktree remove --force` because per-worktree `node_modules` is untracked.

## Sprint summary

- **Slices shipped:** geometry (#8), sliding (#12), knight (#10), king-step (#11), pawn (#9), dispatch (#13) — all merged to `main` via merge commits (admin-merge; `main` branch protection requires a review the orchestrator can't supply). Three waves: W1 geometry seam → W2 sliding/knight/king-step/pawn (4-wide parallel) → W3 dispatch + bounds regression.
- **Runtime smoke:** clean (no smoke PR) · bugs found+fixed: 0 · deferred: 0 — no runtime surface introduced (pseudo-legal generators + `legalMoves` dispatcher are additive, NOT wired into `BoardSlice`; strangler-fig keeps the live app on the old engine). Verified by integrated `npm test` (67 passed, 9 files) + `npm run build` (compiled) on merged `main`. The `## Smoke recipe` stub remains unfilled — harmless this sprint (every slice `none — pure static slice`), but will block from `cutover-cleanup` onward when the engine is wired in.
- **Reviewer:** clean (no PR) · severe findings: 0 — four lenses clear over `7fd436f..a91c128` (12 files, +1423/−58): pseudo-legal generation correct (ray stop/capture, offset filtering, pawn direction-by-colour + double-push gating, edge-file diagonal dropped via `inBounds`), both axes route through `inBounds`, bounds regression genuinely pins off-board destinations on both axes, scope discipline holds (no check filtering/castling/en-passant/promotion), tests non-tautological, no security surface.
- **Queue entries:** resolved 2 (sprint-draft ack; dispatch working-tree bookkeeping note), deferred 5 — all PENDING: geometry generator-signature pin · `occupant` off-board folds-in (gate on `inBounds`) · reviewer cosmetic trio (`slidingMoves` dead null-guard · `pieceKind` doc prose imprecise · `pawn` defensive non-pawn guard inconsistency).
- **Approximate token cost:** ~6 engineer + 1 reviewer subagents + orchestration; rough order ~250–350k tokens across the sprint.
