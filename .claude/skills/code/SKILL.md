---
name: code
description: Use when the user types /code or asks to execute a sprint via the wave loop — dispatch engineers per wave, hand back to the human to merge each wave's PRs, then review and archive.
---

Work in thinking mode. You run this wave loop in the main loop yourself — dispatch engineers and the reviewer via `Agent`.

Parse from args: the plan slug (if any) and `--merge-target=<branch>` (the run's trunk; default `main`). If no plan is given, list `docs/plans/*.md` (excluding `Status: archived`) and ask which to run.

State on disk, re-read every resume: `docs/sprints/<sprint-slug>.md` (status board), `docs/handoff-queue.md` (concerns), `docs/plans/<plan-slug>.md` (master plan).

## Conventions

- **Dispatch:** one `Agent` call per slice in one message, **no `isolation`**; pass each engineer its dispatch context per `docs/engineer-protocol.md`, with `teardown: defer` (worktrees stay up through merge so you can iterate; you remove them post-merge).
- **Hand back for merge:** end the turn listing each open PR as `- <label>: <PR URL>` under a one-line header plus a "reply `continue`" line. Don't poll, auto-merge, or proceed.
- **Confirm-on-resume:** `gh pr view <URL> --json mergedAt,state` each PR you handed back; any unmerged → re-end the turn. Once all are merged, sync trunk (`git checkout <merge-target> && git pull origin <merge-target>`), set the PR/Status cells to `merged`/`done`, and tear down each merged slice's deferred worktree: `git worktree remove <worktree-path>` → `git branch -d <branch-name>` (no `--force`/`-D`; on failure leave it and note it).
- **Reset a worktree:** `git reset --hard origin/<merge-target> && git clean -fd`, then re-run skipping pre-create.
- **Gate-worktree resume** (smoke, reviewer): if the branch exists, find its PR — open → re-end the turn pointing at it; merged → confirm-on-resume, then skip ahead; none → reset the worktree and re-run.

## Preflight (once, before the first wave; skip on resume mid-sprint)

Before pre-creating worktrees, halt naming the first check that fails:

- `origin` remote exists (`git remote get-url origin`).
- The merge-target is on origin (`git ls-remote --heads origin <merge-target>` returns a ref).
- Every non-slice prerequisite (new dependencies, the plan/sprint docs) is committed and pushed to the merge-target.

## The loop

For each sprint row, read `docs/sprints/<sprint-slug>.md` (re-read on resume to find the next wave); if missing → halt and tell the human to run `/sprint`, never draft it yourself.

### Per wave (run in order)

**Resume a halted wave:** re-dispatch each `blocked` slice fresh (the human resolved the cause, not the worktree) — reset its worktree if it exists (per convention) else recreate it (step 2); dispatch (step 3) with any still-`pending` slice. Skip `merged`/`done`.

1. **Sync** (skip on the first wave of the first sprint): confirm-on-resume the prior wave's `pr open` slices.
2. **Pre-create worktrees:** per slice, `git worktree add <parent-repo>/.claude/worktrees/<sprint-slug>-<slice-code>/ -b <branch-name> origin/<merge-target>` — branch names from the sprint doc's Branch column.
3. **Dispatch** per the Dispatch convention, subagent_type `engineer-junior`/`engineer-senior` per the sprint doc.
4. **Translate concerns:** append each engineer's `Concerns` lines (`[TYPE] body`) to `docs/handoff-queue.md` per its template (`from: engineer-<tier>`).
5. **Update the status board:** set each slice's PR and Status per `docs/templates/sprint.md`.
6. **Halt check.** Any `BLOCKED` concern this wave → halt, naming the trigger and queue entry. If >50% of the wave's slices ended `blocked`, first append a wave-summary `BLOCKED` entry from `orchestrator` and point the halt at it.
7. **Hand back for merge** per convention (header `Wave <N> of sprint <sprint-slug> awaiting merge`, merge in any order → reply `continue` to proceed).

### Sprint complete (all waves `done`)

**Runtime smoke (hard gate).** Smoke the runtime yourself post-merge; resume via gate-worktree on `<sprint-slug>-smoke` (merged → skip to the reviewer).
- **Set up & verify:** per the `## Smoke recipe` in `docs/codebase-structure.md` (halt if absent), pre-create `.claude/worktrees/<sprint-slug>-smoke/` off `origin/<merge-target>` and bring the app up — fixes land here, never trunk. Drive it against each summary's `Runtime to smoke`, checking the real page/DOM/response.
- **Fix & ship:** auto-fix and re-smoke until green, halting with a diagnosis when it needs judgment. Log fixes/findings to `docs/handoff-queue.md`, record a smoke summary, stop your servers. No fixes → skip to the reviewer, else open a PR and hand back per convention (`Sprint <sprint-slug> smoke awaiting merge`).

**Reviewer.** Dispatch the reviewer (subagent_type `reviewer`) over the sprint's diff; resume via gate-worktree on `<sprint-slug>-review` (merged → skip to archive).
- **Dispatch:** pre-create `.claude/worktrees/<sprint-slug>-review/` off `origin/<merge-target>`, then dispatch per convention with the sprint-slug and merged slice branches.
- **Triage & ship:** translate `PENDING`/`SOLVED` concerns, routing a `SEVERE:` `PENDING` to the hand-back, else into the Archive gate's end-of-turn message. `PR: clean` → skip to archive, else open a PR and hand back per convention (`Sprint <sprint-slug> review awaiting merge`).

**Archive & advance.** Append the Sprint summary (per `docs/templates/sprint.md`), flip the doc `Status:` to `archived`, and `mv` it to `docs/sprints/archive/`.
- **Update the plan & end:** set the sprint's row in `docs/plans/<plan-slug>.md` to `done` (reshape later rows only if unresolved `PENDING`s require it — never rewrite history), then end the turn: `Sprint <sprint-slug> complete. Reply 'continue' to start the next sprint.`
