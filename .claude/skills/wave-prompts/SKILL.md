---
name: wave-prompts
description: Use when the user types /wave-prompts or asks to emit per-wave dispatch prompts to run engineers in separate Claude Code sessions (session fan-out instead of subagent dispatch).
---

Read-only and one-shot: read the sprint doc and emit one paste-ready dispatch prompt per slice in the requested wave, then stop. Do **not** dispatch subagents, create worktrees, write the status board / handoff-queue, or merge PRs — the engineers and the human do that.

Parse from args: the sprint slug (if any), the wave number (default `1`), and `--merge-target=<branch>` (default `main`). If no slug is given, use the sole non-archived `docs/sprints/*.md`; if several exist, list them and stop; if none exist, tell the human to run `/sprint` and stop.

## Inputs

- `docs/sprints/<slug>.md` — status board (Wave / Slice / Branch columns) + per-slice detail (scope, files owned, success criteria).
- `docs/engineer-protocol.md` — the Required dispatch context fields each prompt must carry.

## Preflight (read-only)

Check `origin` exists (`git remote get-url origin`) and the merge-target is on origin (`git ls-remote --heads origin <merge-target>`). On failure, print a warning banner atop your output — do not halt.

## Emit

Select the requested wave's slices (grouped by the **Wave** column). If that wave has no slices, say so and stop. Otherwise:

1. Print a header: the wave number; the slices in it, each tagged with its `Agent` tier + difficulty from the status board; and the reminder — *launch one session per block **at the project root**, paste it, merge the PRs when green, then re-run `/wave-prompts <slug> <next-wave>`.*
2. Print one fenced block per slice, filled from the sprint doc (if a slice lacks scope, files owned, or success criteria, flag it in the header instead of emitting a blank field):

   ```
   You are implementing one slice of sprint `<slug>`. Read and follow docs/engineer-protocol.md exactly.

   - sprint slug:      <slug>
   - slice code:       <code>
   - branch:           <slug>-<code>
   - merge-target:     <merge-target>
   - parent-repo:      <absolute project root>
   - worktree:         <parent>/.claude/worktrees/<slug>-<code>/
   - scope:            <from per-slice detail>
   - files owned:      <paths>
   - success criteria: <criteria>
   - teardown:         defer

   Create your worktree per the protocol, then ship a PR. Leave the worktree
   intact (teardown: defer) so this session can apply follow-up fixes to the
   same branch/PR; it gets removed after the PR is merged.
   ```

   `<absolute project root>` is your cwd; `branch` is the sprint doc's Branch column.

Then end your turn — there is no state to resume.
