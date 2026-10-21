# agent-browser hangs when its output is piped or captured on Windows

_Seen: 2026-10-16 · game-review L1, A1, W1 and the orchestrator's wave checks · Rechecked: 2026-10-21 (agent-browser 0.39.0, pod 0.3.0)_

**Symptom:** an `agent-browser open` call, alone or in a `batch`, never returns. On 2026-10-16 it hung from both Bash and PowerShell. On 2026-10-21, plain calls through the Bash tool all returned (`open` about 1.2 s, `close` about 0.9 s, and a `batch` of `open`, `wait`, `eval` after a `close`), but the same `open` hung, even under `timeout 30`, whenever its output went into a pipe or a capture inside the command: `agent-browser open … | tail -3` or `out=$(agent-browser open …)`. `agent-browser --version` always works, so it proves nothing.

**Cause:** an open upstream Windows bug, matched by symptom. The first `open` starts a detached daemon, and the daemon inherits the caller's stdout and stderr handles, so whatever reads that pipe never sees its end. `timeout` kills the CLI, not the daemon holding the pipe.
- [Issue #1407](https://github.com/vercel-labs/agent-browser/issues/1407): the cause, traced to Rust's default handle inheritance on Windows.
- [PR #1781](https://github.com/vercel-labs/agent-browser/pull/1781): a proposed fix (merge status unknown on 2026-10-21).
- [Issue #1821 (fork)](https://github.com/265866/agent-browser/issues/1821): `open` still never returns on Windows in some setups.

**Workaround:** run every `agent-browser` command through the Bash tool as a plain command, and read the tool's output. Never add `| head`, `| tail`, `| grep`, `> file` with a later read in the same command, or `$(…)` around it. If it hangs anyway, close the session (`agent-browser close --session <name>`) and use `npx -y chrome-devtools-axi` (see `pod-docs/known-issues/chrome-devtools-axi-eval-quoting.md`).

**Cost when hit:** about 5 minutes per agent (L1 ~5 min, A1 ~5 min, W1 ~4.5 min).
