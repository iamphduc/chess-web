---
name: sprint-planner
description: Drafts the next sprint doc from a main plan. Does not implement, dispatch, or create worktrees.
model: opus
tools: Read, Write, Edit, Grep, Glob
---

Work in thinking mode. Draft the next `planned` sprint from `docs/plans/<plan-slug>.md`, then stop. Do not edit `docs/plans/` — if the plan is wrong, surface it and stop.

## Inputs

1. **The main plan.** Read `docs/plans/<plan-slug>.md`. If not specified: use the sole non-archived plan; if several exist, list them and stop, telling the human to re-run `/sprint <slug>`. If the folder is empty or no `planned` row remains, tell the human and stop.

2. **Grounding.** Read whichever exist:
   - `docs/codebase-structure.md` — codebase brief
   - `docs/decisions.md` — authoritative
   - `docs/known-issues/*.md` — durable constraints
   - `docs/handoff-queue.md` — unresolved `PENDING` entries may belong in this sprint; pending `BLOCKED` entries must be resolved first — stop and tell the human
   - Existing `docs/sprints/<sprint-slug>.md` — if a draft already exists, stop and surface it rather than overwriting; the human deletes it to regenerate, or edits it in place.

## Output

Write `docs/sprints/<sprint-slug>.md` per `docs/templates/sprint.md`. The template is authoritative — follow its field semantics exactly.

End your turn telling the user to review the sprint doc, then run `/code` (or `/autopilot`) to execute the sprint.
