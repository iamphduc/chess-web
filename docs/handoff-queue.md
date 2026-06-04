# Handoff Queue

Inter-agent communication. **The human is the ultimate arbiter** — `BLOCKED` entries halt the orchestrator until acknowledged. **One line per entry** so the queue is graspable at a glance; never break an entry across multiple lines.

Format: `` - `[YYYY-MM-DD · TYPE · from → to · sprint: <slug> · slice: <code>]` <body> **Resolution:** pending `` (or `**Resolution:** <YYYY-MM-DD> — <what changed> [optional link to docs/decisions.md#anchor]`).

Entries are **date-keyed and append-only** (newest at the tail) — reference one by its `[date · from → to]` header plus a few words of its body, never by position (a same-day header can repeat; the body disambiguates). Glance at the tail to judge whether prune is due (>100 entries). `from` / `to` may be any of `engineer-junior` / `engineer-senior` / `orchestrator` / `sprint-planner` / `planner` / `human` — anyone can address anyone. Omit `slice:` for sprint-wide entries; omit `sprint:` for project-wide entries.

Types: `BLOCKED` halts · `PENDING` defers (defaults taken, knowingly-incomplete spots, scope-creep opportunities) · `SOLVED` informational, only emitted alongside a `BLOCKED` or `PENDING` to mark a related thing resolved inline.

Resolve inline (do not delete prematurely); if decision-worthy, write a one-liner to `docs/decisions.md` and link from the Resolution line. At sprint end the orchestrator drops the oldest **resolved** entries beyond 100 (by date) — no renumbering; unresolved entries (`Resolution: pending`) are never pruned.

---

- `[2026-06-04 · PENDING · sprint-planner → human · sprint: engine-foundation]` Sprint draft written to `docs/sprints/engine-foundation.md` (3 slices, 2 waves: W1 harness+gamestate, W2 tracer) — sprint-draft gate; review then re-invoke `/autopilot` to execute. **Resolution:** 2026-06-04 — human reviewed and re-invoked `/autopilot`; sprint execution authorized.
- `[2026-06-04 · PENDING · sprint-planner → human]` `docs/codebase-structure.md` `## Smoke recipe` is still an unfilled stub; harmless for engine-foundation (no runnable app surface; verified by tsc+build+Jest) but `/code`'s fail-closed runtime-smoke gate will halt a later sprint until it's filled. **Resolution:** pending
- `[2026-06-04 · BLOCKED · orchestrator → human]` Preflight blocked: workflow docs committed locally (`1dcd05a`) but pushing to `origin/main` was denied by the permission classifier; engineers branch off `origin/main` and need the protocol/templates there. Push `1dcd05a` (e.g. `! git push origin main`) or authorize main pushes, then re-invoke `/autopilot`. **Resolution:** 2026-06-04 — human chose PR-based merge; infra landed on `main` via PR (branch `chore/workflow-infra`) instead of a direct push.
