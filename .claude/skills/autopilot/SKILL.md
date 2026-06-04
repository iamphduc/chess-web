---
name: autopilot
description: Use when the user types /autopilot or asks to run the workflow autonomously across a plan. Also the resume command after a halt.
---

**You run this in the main loop yourself** — dispatching engineers / reviewer / sprint-planner and notifying on halt.

Run the **`/code` wave loop** (`.claude/skills/code/SKILL.md`) with the deltas below, under `docs/autonomous-policy.md` — read it at the start of every turn. Args: optional plan slug plus the policy's `--max-*` bounds.

## Teardown

Override the `/code` dispatch convention: dispatch engineers with `teardown: immediate`, not `defer`. There's no human iterating on the worktree here, so engineers tear down at ship time as usual; you don't do the post-merge worktree removal that `/code`'s confirm-on-resume does.

## Auto-merge

Don't hand back the wave, smoke, or reviewer PRs. For each, apply the policy's auto-merge criteria + escalation valve: merge the clean ones; a failed criterion or risk-flagged PR halts (merge the wave's others first).

## Sprint-draft gate (between sprints)

Don't end with "reply continue" — run one sprint per turn:

1. `--max-sprints` reached → halt at the safety-bound gate (policy gate 6).
2. No `planned` row left in the plan → halt at the plan-complete gate (policy gate 9).
3. Else dispatch the `sprint-planner`, then halt at the sprint-draft gate (policy gate 2).

## Safety counters

Persist a `<!-- autopilot-run: started=<ISO8601> sprints=<N> waves=<N> -->` line — in the active sprint doc during a sprint, the plan doc between sprints (move it on start/archive; re-inject after `sprint-planner` writes a fresh doc). Re-derive the counters each turn, and check all three bounds (safety-bound gate) before each wave and after each archive.
