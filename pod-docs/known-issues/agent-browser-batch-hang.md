# agent-browser `open` can hang on Windows

_Seen: 2026-10-16 · game-review L1, A1, W1 and the orchestrator's wave checks · Cause found: 2026-10-20 (web search, not reproduced here)_

**Symptom:** an `agent-browser open` call, alone or inside a `batch` with `wait` and `eval`, hits the 2-minute tool limit and returns nothing. It hangs again after the session is closed and the call is retried, from both Bash and PowerShell. `agent-browser --version` still works, so a version check doesn't catch it.

**Likely cause:** an open upstream Windows bug. The first `open` starts a detached daemon, and the daemon inherits the CLI's stdout and stderr handles. A caller that captures output, such as an agent's shell tool, never sees the end of the output, so the call never returns.
- [Issue #1407](https://github.com/vercel-labs/agent-browser/issues/1407): the cause, traced to Rust's default handle inheritance on Windows.
- [PR #1781](https://github.com/vercel-labs/agent-browser/pull/1781): a proposed fix (merge status unknown on 2026-10-20).
- [Issue #1821 (fork)](https://github.com/265866/agent-browser/issues/1821): `open` still never returns on Windows, even when the native binary is run directly.

**Workaround:** use `npx -y chrome-devtools-axi` (the project's browser since 2026-10-17, see `pod-docs/decisions.md` → "browser: chrome-devtools-axi"). It has worked on every page check since.

**To try agent-browser again:** update it (0.39.0 was installed on 2026-10-20), start the dev server, and run `agent-browser open http://127.0.0.1:<port>/chess-web/` with a time limit. If it returns, record the switch in `pod-docs/decisions.md`.

**Cost when hit:** about 5 minutes per agent (L1 ~5 min, A1 ~5 min, W1 ~4.5 min).
