# Sprint: King Safety & Endgame

_From plan: docs/plans/pure-engine-refactor.md · Slug: king-safety-endgame · Status: active · Generated: 2026-06-04_

## Status board

| Wave | Slice | Title | Difficulty | Agent | Branch | PR | Status | Depends on |
|------|-------|-------|------------|-------|--------|----|--------|------------|
| 1 | attack-map | Enemy-attack mapping (`isSquareAttacked`), king location + `isInCheck` | 4 | engineer-senior | king-safety-endgame-attack-map | — | pending | — |
| 2 | legal-filter | Filter pseudo-legal moves that leave the mover's own king in check | 4 | engineer-senior | king-safety-endgame-legal-filter | — | pending | attack-map |
| 3 | game-status | Checkmate vs stalemate (and ongoing) detection over all legal moves | 3 | engineer-senior | king-safety-endgame-game-status | — | pending | legal-filter |

Wave membership lives in the **Wave** column; slices sharing a wave run in parallel and must own disjoint file sets.

## Per-slice detail

### attack-map: Enemy-attack mapping + king location + `isInCheck`

- **Difficulty justification:** This is the foundational primitive the whole sprint (and `special-moves`' castling) stands on, and its semantics differ subtly from move generation: **attack** semantics, not **move** semantics. Pawns attack only their two forward diagonals (never the push squares); kings attack their eight neighbours; sliders/knights attack the same squares they move to. It must answer "is square S attacked by colour C?" **independent of whose turn it is** and **without** calling the turn-gated `legalMoves` (which is about to become check-filtered — calling it here would create a circular dependency). Getting the pawn-attack-vs-pawn-move distinction and the turn-independence right is design-defining; every downstream slice inherits a wrong answer.
- **Scope:** Create `src/game/engine/moves/attack.ts`. Provide pure helpers:
  - `isSquareAttacked(state: GameState, target: Position, by: PieceColor): boolean` — true iff any piece of colour `by` attacks `target`. Compute attacks directly from board geometry, reusing `classify.ts`'s `pieceKind`, `colorOf`, `inBounds`, `occupant`, `relationTo` and the `*_DIRS` / `*_OFFSETS` constants. **Attack semantics, not move semantics:** sliders attack along `BISHOP_DIRS`/`ROOK_DIRS`/`QUEEN_DIRS` until blocked (a blocker square is itself attacked; squares beyond it are not); knights attack the eight `KNIGHT_OFFSETS`; kings attack the eight `KING_OFFSETS`; **pawns of colour `by` attack only their two forward diagonals** (White attacks toward row 0 → `y-1, x±1`; Black toward row 7 → `y+1, x±1`) and **never** the push square. Do NOT gate on `state.turn` — this answers for an arbitrary colour. A common, robust approach: scan from `target` outward (knight offsets, king offsets, sliding rays, the two pawn-capture diagonals that would *land on* `target`) and check whether an attacker of the right kind/colour sits there — but a forward scan over all squares of colour `by` is equally acceptable. Pick one and document it.
  - `findKing(state: GameState, color: PieceColor): Position | null` — locate the `color` king on the grid via `pieceKind === "king"` + `colorOf`. Return `null` if absent (defensive — test positions may omit a king; real `GameState`s always have both).
  - `isInCheck(state: GameState, color: PieceColor): boolean` — `findKing(state, color)` is non-null AND `isSquareAttacked(state, kingSquare, opponent(color))`.
  - Do NOT modify `engine.ts`, the four generators, or `classify.ts`. Do NOT do legal-move filtering or game-status here — those are later slices. Do NOT read/write `state.enPassant`, castling rights, or `promotionCount` (en-passant attack geometry and castling's through-check checks are `special-moves`). Pseudo-legal-engine pieces only: handle promoted `PieceType` ids through `pieceKind` (a promoted queen attacks like a queen).
  - Use **relative imports** (`../game-state`, `../engine`, `./classify`) — `vitest.config.ts` does not resolve tsconfig `baseUrl` aliases.
- **Files owned:** `src/game/engine/moves/attack.ts`, `src/game/engine/moves/__tests__/attack.test.ts`
- **Success criteria:** `isSquareAttacked` / `findKing` / `isInCheck` exported and compile under `strict`. Tests green via `npm test` (`vitest run`) pinning: a rook attacks along its rank/file up to and including a blocker but not beyond; a bishop attacks its diagonals; a knight attacks its eight targets and nothing else; **a pawn attacks its two diagonals but NOT the square directly ahead** (both colours); a king attacks its eight neighbours; `findKing` locates each colour's king and returns `null` when absent; `isInCheck` true for a king on a square attacked by an enemy slider/knight/pawn and false otherwise; attack answers are **turn-independent** (same result regardless of `state.turn`). `npx tsc --noEmit` and `npm run build` clean; `engine.ts`, generators, old engine untouched; new engine not wired into `BoardSlice`.
- **Depends on:** —

### legal-filter: Filter pseudo-legal moves that leave one's own king in check

- **Difficulty justification:** This is the slice that turns pseudo-legal generation into **legal** generation, and it owns the shared `engine.ts` seam, so it must land after attack-map and reconcile the whole pipeline. The crux is the filter mechanism — for each pseudo-legal `Move`, apply it with `applyMove`, then ask whether the **mover's own** king is now attacked (`isInCheck(applied, mover)`); drop the move if so. This correctly subsumes three distinct cases with one rule: moving a pinned piece off the pin line, failing to escape an existing check, and a king stepping into an attacked square. The subtlety is that the check is against the *resulting* position's mover (not its `turn`, which `applyMove` has flipped), and that this filter must NOT recurse into itself — it consumes the pseudo-legal generators / the existing dispatch path, never a re-entrant filtered call.
- **Scope:** Modify `src/game/engine/engine.ts` so the public move enumeration returns **legal** moves (pseudo-legal minus self-check). Recommended shape: keep the existing pseudo-legal dispatch (rename it to a private `pseudoLegalMoves(state, from)` or inline it) and make `legalMoves(state, from)` filter its output:
  - For each pseudo-legal `Move m` from `from`: let `mover = colorOf(state.squares[from.y][from.x])` (equivalently `state.turn`, since the dispatcher already gates on turn); compute `applied = applyMove(state, m)`; keep `m` iff `isInCheck(applied, mover) === false`.
  - Import `isInCheck` from `./moves/attack`. Keep `applyMove`, `Move`, `Position` exactly as-is — this sprint does NOT change move application (no capture/special bookkeeping; that is `special-moves`). The off-board / empty / out-of-turn guards stay (a pseudo-legal `[]` filters to `[]`).
  - Update the `legalMoves` doc comment: it now returns legal moves filtered for king safety; note that castling's through/into/out-of-check rule and en-passant are still `special-moves`, and that the filter relies on `applyMove` faithfully relocating the piece (captures already work because `applyMove` overwrites the destination).
  - The existing `engine.test.ts` tracer tests must stay green (e2→e3 is legal from the start position; empty square and out-of-turn still `[]`). Do NOT touch the four generators, `classify.ts`, `attack.ts`, the old engine, `piece-moves.ts`, `BoardSlice.ts`, or `src/game/pieces/*`. Do NOT wire the new engine into `BoardSlice` (strangler-fig — that is `cutover-cleanup`). Relative imports.
- **Files owned:** `src/game/engine/engine.ts`, `src/game/engine/__tests__/legal-filter.test.ts`
- **Success criteria:** `legalMoves` returns king-safe moves only, pinned by tests for the three canonical cases: (1) a **pinned** piece (e.g. a knight in front of its king on a file with an enemy rook behind) cannot move off the pin line, but the king's other pieces still move; (2) while **in check**, only moves that resolve the check (capture the checker, block the ray, or move the king) are returned, and an unrelated move is filtered out; (3) the **king cannot step into** a square attacked by the enemy (including not capturing a defended piece). A position with no escape returns `[]` for every piece. The existing tracer tests in `engine.test.ts` still pass. Full `npm test` suite green; `npx tsc --noEmit` and `npm run build` clean; only owned files changed; new engine not wired into the app.
- **Depends on:** attack-map

### game-status: Checkmate vs stalemate (and ongoing) detection

- **Difficulty justification:** A focused predicate built directly on the now-legal `legalMoves`: enumerate every legal move for the side to move; zero legal moves splits on `isInCheck` into checkmate (in check) vs stalemate (not in check); otherwise the game is ongoing. The logic is small, but the enumeration must scan the whole board for the side-to-move's pieces and route each through the **filtered** `legalMoves`, and the checkmate/stalemate fork is exactly the kind of thing the plan calls out as a correctness target — so it earns careful, hand-authored tests over canonical mate/stalemate positions.
- **Scope:** Create `src/game/engine/game-status.ts` exporting:
  - `hasAnyLegalMove(state: GameState): boolean` (or `allLegalMoves(state): Move[]`) — iterate all 64 squares, and for each square holding a piece whose `colorOf` matches `state.turn`, collect `legalMoves(state, [y, x])`; the side to move has a legal move iff any is non-empty. Reuse `pieceKind`/`colorOf` from `classify.ts` only for the colour/kind filter; the move legality comes entirely from `engine.ts`'s `legalMoves` (do NOT re-implement filtering).
  - `gameStatus(state: GameState): "checkmate" | "stalemate" | "ongoing"` — if the side to move has any legal move → `"ongoing"`; else `isInCheck(state, state.turn)` → `"checkmate"`, otherwise `"stalemate"`. (Choose a clear return type; a small string-union or enum is fine — document it.)
  - Import `legalMoves`/`Move`/`Position` from `./engine` and `isInCheck` from `./moves/attack`. Do NOT modify `engine.ts`, `attack.ts`, the generators, or `classify.ts`. Do NOT implement draw-by-repetition / fifty-move / insufficient-material (explicitly out of scope — threefold repetition is deferred per the plan; only checkmate/stalemate/ongoing here). Relative imports.
- **Files owned:** `src/game/engine/game-status.ts`, `src/game/engine/__tests__/game-status.test.ts`
- **Success criteria:** `gameStatus` / `hasAnyLegalMove` exported and compile under `strict`. Tests green via `npm test` pinning: a back-rank or Fool's-mate-style position with the side to move in check and no legal move → `"checkmate"`; a canonical stalemate (e.g. lone king with no legal move, not in check) → `"stalemate"`; the start position and any position with a legal move → `"ongoing"`; a position that is **in check but has an escape** is `"ongoing"`, not checkmate. `npx tsc --noEmit` and `npm run build` clean; only owned files changed; new engine not wired into `BoardSlice`.
- **Depends on:** legal-filter

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

## Why this is three sequential waves (not wider)

The dependency chain is intrinsic to chess: legal-move filtering needs an attack map, and game-end detection needs filtered legal moves. There is no slice independent of `attack-map`, so W1 cannot be widened; `game-status` consumes the filtered `legalMoves` that `legal-filter` establishes, so it cannot share W2. Each wave is a single, focused slice — narrow but correctly ordered. (If during execution the orchestrator finds a genuinely independent sub-task — e.g. a pure attack-table fixture — it may be added to an earlier wave, but none is forced today.)

## Operational notes (carried from engine-foundation / move-generation)

- **Per-worktree install:** worktrees don't share `node_modules`; each slice must run `npm install --legacy-peer-deps` in its worktree before tests/build (plain `npm install` is blocked by the `@types/node@^16` vs vitest peer conflict). No runtime impact.
- **Corrupt-first-install retry:** if the first install yields a corrupt tree (npm optional-dep extraction bug on Windows — `@rollup/rollup-win32-x64-msvc` invalid), delete `node_modules` and reinstall once.
- **Relative imports under Vitest:** `vitest.config.ts` does NOT resolve tsconfig `baseUrl` aliases. All engine modules use **relative imports** (`../game-state`, `../engine`, `./classify`, `./moves/attack`). This sprint does not add `vite-tsconfig-paths`.
- **Worktree teardown** may need `git worktree remove --force` because per-worktree `node_modules` is untracked.
- **Strangler-fig boundary:** this sprint is additive and pure — `legalMoves` becomes check-filtered and new game-end helpers appear, but **none of it is wired into `BoardSlice`**. The live app stays on the old engine until `cutover-cleanup`. Do NOT touch `piece-moves.ts`, `BoardSlice.ts`, `src/game/pieces/*`, or the old singleton state.
- **Smoke recipe stub:** `docs/codebase-structure.md`'s `## Smoke recipe` is still unfilled. Harmless this sprint (every slice is a pure static slice with no runtime app surface; verified by `npm test` + `tsc` + `npm run build`), but `/code`'s fail-closed runtime-smoke gate will halt from `cutover-cleanup` onward until it's filled.

## Sprint summary

Appended by the orchestrator after the last wave completes, immediately before archive.

- **Slices shipped:** <slice-code list>
- **Runtime smoke:** <PR URL | clean> · bugs found+fixed: <N> (runtime regressions static checks missed) · deferred: <M>
- **Reviewer:** <PR URL | clean> · severe findings: <N> (count of `SEVERE:` PENDING entries emitted)
- **Queue entries:** resolved <N>, deferred <M> — link the deferred ones inline
- **Approximate token cost:** <number or rough range>
