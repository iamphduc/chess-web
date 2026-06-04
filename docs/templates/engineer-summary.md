# Engineer summary template

Engineers end their turn with this structured summary inline in their response (free-form prose gets truncated when relayed to the orchestrator).

- **Slice:** <slice-code>
- **Changed files:** path → one-line description per file
- **PR:** URL — or `blocked` — or `skipped — verification failed` — or `clean` (no change warranted)
- **Concerns:** list each as `[TYPE] one-line body`, or `none`
- **Static checks:** commands run and their results — or `no harness found` — or `failed — see concerns` (static only: tests / typecheck / lint / build; you did NOT run the app)
- **Runtime to smoke:** runtime-observable behaviors your slice introduces for the main-loop smoke gate to verify (e.g. `/guide hard-loads`, `Nunito renders`, `locale switch persists`) — or `none — pure static slice`
- **Cleanup:** `done` / `partial — see concerns` / `skipped — blocked` / `deferred — worktree <path> retained` (teardown left to the orchestrator post-merge)
- **Confidence:** high / medium / low — and why
