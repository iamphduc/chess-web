# Autonomous mode policy

## Auto-merge criteria

Invoking `/autopilot` is standing consent to merge PRs that clear the bar below, overriding a general "confirm each merge" preference for the run's duration. (If `CLAUDE.md` hard-forbids unattended merges, add an autopilot carve-out there, or run `/code` for the supervised flow.)

A PR is **mechanically mergeable** only if **all** hold:

- `gh pr checks <url>` reports every required check as `pass` (no `pending`, no `fail`).
- `gh pr view <url> --json mergeable,mergeStateStatus` returns `mergeable: MERGEABLE` and `mergeStateStatus: CLEAN`.
- No reviews marked `CHANGES_REQUESTED`.
- No unresolved review threads — `gh api graphql -f query='{repository(owner:"<owner>",name:"<repo>"){pullRequest(number:<n>){reviewThreads(first:100){nodes{isResolved}}}}}'` returns no node with `isResolved: false`.

**Precondition.** The merge target's branch protection must **not** require a human approving review. If approval is required `mergeStateStatus` stays `BLOCKED` and every PR halts at gate 4 until the rule is relaxed or an approval is supplied.

**Escalation valve.** Even when mechanically mergeable, **withhold the merge and halt for human review (gate 8)** if the PR carries a risk signal:

- the slice's engineer summary reported `Confidence: low`, or
- (smoke PR) the smoke gate's fix was **non-trivial** — touched logic, data, or multiple files rather than a localized wiring/config fix.

Otherwise merge with a **merge commit** (not squash): `gh pr merge <url> --merge --delete-branch`. Update the sprint doc's PR cell to `merged` and Status to `done`. Any merge failure → halt + notify (gate 4).

## Halt gates

| # | Name | Trigger | Queue type |
|---|---|---|---|
| 1 | blocked-concern | `BLOCKED` concern from any engineer or from you | `BLOCKED` |
| 2 | sprint-draft | Sprint-draft review — after `sprint-planner` writes a new doc | `PENDING` |
| 3 | severe-finding | Reviewer finding prefixed `SEVERE:` | `PENDING` |
| 4 | auto-merge-fail | Auto-merge fails per criteria above | `BLOCKED` |
| 5 | inter-wave-verify | Inter-wave verification fails | `BLOCKED` |
| 6 | safety-bound | Safety bound hit | `PENDING` |
| 7 | runtime-smoke | Runtime smoke fails and can't be auto-fixed, or no smoke recipe exists | `BLOCKED` |
| 8 | escalation-valve | A mechanically-mergeable PR carries a risk signal; withheld for human review | `PENDING` |
| 9 | plan-complete | Plan complete — the next-sprint check finds no `planned` rows left in the main plan | `PENDING` |

**All gates halt the same way** — end the turn. `Queue type` is only the label/urgency on the handoff-queue entry (`BLOCKED` = resolve before resuming, `PENDING` = a checkpoint the human can ack); it does **not** decide whether the gate halts. So a `PENDING`-typed gate still stops the run.

Runtime smoke (`/code`'s smoke gate) **auto-fixes** what it can and halts per gate 7 only when a failure needs a human.

On halt: append a one-line `docs/handoff-queue.md` entry from `orchestrator` describing the gate and pointing at the artifact, then `PushNotification`, then end the turn. Resume via human re-invoking `/autopilot`.

## Inter-wave verification

After trunk sync, before dispatching the next wave: run the project's verification command in the parent repo. A `Verification:` line in `docs/codebase-structure.md` → fall back to detecting the test command from repo files. Non-zero exit → halt + notify (gate 5).

## Safety bounds

Parsed from `/autopilot` args:

- `--max-sprints=<N>` — cap on sprints completed this run. Default: unlimited (run until plan has no `planned` rows).
- `--max-waves=<N>` — emergency cap on total waves dispatched this run. Default: `20`.
- `--max-runtime=<duration>` — wall-clock cap (`30m`, `4h`, etc). Default: `4h`.

Bounds are independent halt gates: hitting any → halt cleanly per gate 6.
