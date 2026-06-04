---
name: fix
description: Use when the user types /fix <task> or asks for an ad-hoc code change outside the sprint workflow.
---

Dispatch the `engineer-senior` subagent via the Agent tool, passing the user's task description as the prompt. The agent handles its own worktree and context setup per its standalone-invocation section, and **defers teardown** — its worktree stays up through merge.

From its summary, capture the **worktree path**, **branch**, and **PR URL**.

- **Hand back for merge:** end the turn with the PR URL and a note that the worktree is retained — the human can merge it, or ask for follow-up fixes, then reply `continue`.
- **Follow-up fixes (before merge):** re-dispatch `engineer-senior` with the retained **worktree path** and **branch** as explicit dispatch context so it reuses the worktree (no recreate) and updates the same PR.
- **Confirm-on-resume:** `gh pr view <URL> --json mergedAt,state`; unmerged → re-end the turn. Merged → tear down: `cd "<parent-repo>" && git worktree remove <worktree-path> && git branch -d <branch>` (no `--force`/`-D`; on failure, leave it and tell the human).
