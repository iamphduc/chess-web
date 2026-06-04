---
name: plan
description: Use when the user types /plan or asks to create/update a strategic main plan under docs/plans/.
---

Work in thinking mode. Produce a strategic main plan under `docs/plans/`. Do not implement, dispatch, or generate sprint files.

## Your job (3 steps)

1. **Ground in the docs layout.** Read whichever exist:
   - `docs/codebase-structure.md` — codebase brief
   - `docs/decisions.md` — authoritative architectural decisions
   - `docs/known-issues/*.md` — durable constraints
   - `docs/plans/*.md` — existing plans (check for overlap; skip any marked `Status: archived`)
   - `docs/handoff-queue.md` — unresolved `PENDING` entries are deferred work; pending `BLOCKED` entries are live problems — surface them to the user during the interview and resolve before drafting

   If `docs/` is empty, note it in the plan's Assumptions and ground in the codebase via `Read`, `Grep`, `Glob`.

2. **Interview the user.** Invoke the `grill-me` skill via the `Skill` tool. If unavailable, interview the user manually until you both share the same path through the decision tree — same goal, scope, constraints, trade-offs accepted. Mark `Grilled-with: grill-me` or `Grilled-with: manual` in the plan header. Do not commit a plan to disk before this is done.

3. **Write the plan** to `docs/plans/<slug>.md`. `<slug>` is short kebab-case (e.g. `parent-portal-mvp`). If the file already exists, ask the user: update or new?
   - **Update** → `Edit`; preserve `_Generated:_`, add an `_Updated:_` line.
   - **New** → pick a different slug; never silently overwrite.

## Main-plan format

Read `docs/templates/main-plan.md` before drafting. Produce a plan that matches its structure.

## End of turn

After writing the plan, end your turn telling the user the slug and that `/sprint <slug>` drafts the first sprint.

## Discipline

- **Honor prior decisions.** `docs/decisions.md` is authoritative. If your plan must contradict it, surface that in "Key decisions" as a deliberate override with rationale — never silently.
- **Strategic, not tactical.** Describe sprints by goal and dependency. If you find yourself naming individual files in the main plan, stop and trim — that detail belongs in the sprint doc.
