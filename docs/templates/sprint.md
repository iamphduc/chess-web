# Sprint: <name>

_From plan: docs/plans/<plan-slug>.md · Slug: <sprint-slug> · Status: <active | archived> · Generated: <YYYY-MM-DD>_

## Status board

| Wave | Slice | Title | Difficulty | Agent | Branch | PR | Status | Depends on |
|------|-------|-------|------------|-------|--------|----|--------|------------|
| 1 | <slice-code> | <one-line> | 1–5 | engineer-senior \| engineer-junior | <branch-name> | — | pending | — |

Wave membership lives in the **Wave** column; slices sharing a wave run in parallel and must own disjoint file sets.

## Per-slice detail

### <slice-code>: <title>
- **Difficulty justification:** <one line — why 1–5>
- **Scope:** what to do; what NOT to do
- **Files owned:** explicit paths (disjoint within the same wave)
- **Success criteria:** concrete checks
- **Depends on:** <slice codes or —>

---

## Field semantics

- **Wave:** the leading column — the parallel batch a slice runs in. Slices sharing a wave run concurrently and **must own disjoint file sets**. Assign waves to **maximize parallel width**: each slice goes in the *earliest* wave where (a) all its `Depends on` slices sit in strictly-earlier waves and (b) its `Files owned` are disjoint from every slice already in that wave. Open a new wave only when a dependency or file conflict forces it — never split independent, non-conflicting slices across waves. **Cap each wave at 5 slices**; eligible overflow spills into the next wave (still respecting deps and disjoint files).
- **Slug:** matches the row in the main plan's Sprint sequence (`docs/plans/<plan-slug>.md`).
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
