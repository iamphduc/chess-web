# Review: how pod split the vite-migration plan into PRs

_Written: 2026-10-05 · Plan: `docs/plans/vite-migration.md` · Sprints: `docs/sprints/archive/vite-switch.md`, `docs/sprints/archive/ci-deploy.md`_

## Question

The plan moved the app from CRA to Vite and moved deploy to GitHub Actions. It produced **5 wave PRs** plus the final plan PR. Was that split worth it, or was it too fine for a plan this size?

## What happened

Plan: 2 sprints, 5 slices, 5 waves, all run one after another (no parallel slices).

| PR | Sprint · wave · slice | What it did | Size | Kind |
|---|---|---|---|---|
| #33 | vite-switch · 1 · A1 | Replace webpack-only `require()` avatar lookup with a static map | +90 / -2 | code (prep) |
| #34 | vite-switch · 2 · V1 | CRA → Vite 8 + Vitest 5, config, `index.html`, tsconfig paths, lockfile | +2664 / -30390 | code (the real change) |
| #35 | vite-switch · 3 · D1 | Rewrite `docs/codebase-structure.md`, decisions entry, `tests/docs.test.ts` | +124 / -16 | docs |
| #36 | ci-deploy · 1 · C1 | `pod-ci.yml` workflow, remove `gh-pages`, package becomes ESM | +230 / -509 | code |
| #37 | ci-deploy · 2 · D1 | CI section in docs, decisions entry, stale comment fix, +6 docs tests | +68 / -7 | docs |
| #38 | plan PR | `vite-migration` → `main` | all of the above | final merge |

Branch history (`main..vite-migration`): about 36 commits, of which about 12 are code/test, 10 are merges (slice → wave head → plan branch), and 14 are orchestrator docs commits (sprint docs, "wave N merged", archive, halt notes).

Autopilot halted twice: once at gate 5 (max runtime) during ci-deploy, once at gate 3 (final PR needs review).

## Findings

**1. Splitting CI/deploy from the Vite swap was worth it.**
Deploy touches the live site and needs a manual step (Pages Source → GitHub Actions). Proving Vite locally first (#34) and adding CI after (#36) kept each risk separate. #36's own PR checks were the first real Linux run of the workflow.

**2. The prep slice A1 (#33) could have been part of V1 (#34).**
The sprint doc says A1 goes first because `require()` would break under Vite. That is a real order constraint, but not a reason for its own PR: it is 90 lines, has no risk of its own, and V1 needed it to pass anyway. It cost one extra wave (worktree, wave head, merge, PR, wave check).

**3. The docs waves (#35, #37) were the biggest overhead.**
Each sprint ended with a docs-only wave that waits for the code wave to merge. Both were small (+124, +68). The engineer who wrote the code already knows what to document, so docs could ship in the same slice. Two of the five waves exist only for docs.

**4. Docs got their own tests.**
`tests/docs.test.ts` pins doc text (11 tests today, added in #35 and #37). This makes doc edits slower and is part of why docs became their own slice with "red → green" steps. Worth asking whether doc content needs test coverage at all, or only a smoke check that the recipe runs.

**5. Process commits outnumber code commits.**
14 docs commits and 10 merge commits against 12 code/test commits. Each extra wave adds about 3–4 of these. Fewer waves would cut most of them.

**6. A smaller split would have worked.**
About 2 waves would have been enough:
- Wave 1: avatar fix + Vite swap + its docs (A1 + V1 + D1)
- Wave 2: CI/deploy + its docs (C1 + D1)

Same safety (CI still separate from the Vite swap), 3 fewer PRs, fewer merges and halts.

## Things pod did well

- Shared contracts in the sprint docs were precise (ports, base path, install rule, workflow triggers), which made each slice easy to check.
- V1 caught a real bug in-slice (Vite inlined small SVGs, which blanked all pieces) and pinned it with a test.
- Wave PR bodies are clear: what changed, notes, wave check, look check.

## Suggested changes to pod

1. **Docs ship with the code slice by default.** Only make a separate docs slice when the docs cover several slices from different engineers, or are large on their own.
2. **Fold small prep slices into the slice that needs them** when the prep is under ~150 lines, has no visible change, and only one later slice depends on it.
3. **Add a minimum-size rule for waves.** If a wave is one small slice that only exists to unblock the next wave, merge it into the next wave.
4. **Don't add tests for doc text by default.** Prefer running the smoke recipe as written.
5. **Let the plan say how fine to split.** For example, a plan key decision such as "docs ship with the code slice" or "max 2 waves per sprint", which the sprint-planner must follow.

## How to re-evaluate with pod

Run the sprint-planner again on the same plan with the suggestions above, and compare:

- Number of waves and PRs (target: about 2 instead of 5)
- Number of orchestrator docs and merge commits
- Whether any safety is lost (CI still separate from the Vite swap? SVG bug still caught?)
- Total autopilot runtime and number of halts

Useful commands:

```
gh pr list --state merged --base vite-migration --json number,title,additions,deletions
git log --oneline origin/main..vite-migration
grep -cE "^\s*(it|test)\(" tests/docs.test.ts
```
