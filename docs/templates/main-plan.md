# Plan: <plan name>

_Generated: <YYYY-MM-DD> · Status: <active | archived> · Grilled-with: <grill-me | manual>_

## Goal
<2–3 sentences: what we're accomplishing>

## Why
<motivation, success criteria for the whole plan, constraints>

## Scope
**In scope:**
- ...

**Out of scope:**
- ...

## Sprint sequence

| Sprint | Goal | Status | Depends on |
|--------|------|--------|------------|
| <slug> | <one-line> | planned | — |
| <slug> | <one-line> | planned | <previous slug> |

Status values: `planned` / `active` / `done`. The orchestrator only flips its row's Status — it does not rewrite Goal/Depends-on retroactively.

The `Depends on` column is the **only** cross-sprint dependency signal. Wave ordering and per-slice deps live inside the sprint doc and are opaque from here.

## Key decisions
- <decision and rationale; link to docs/decisions.md entry if one exists or should be created>

## Known risks
- <risk: mitigation>

## Open questions
- <unresolved after grilling; flag as risks for orchestrator>

## Verification
How we'll know the whole plan succeeded — top-level criteria only, not per-sprint.
