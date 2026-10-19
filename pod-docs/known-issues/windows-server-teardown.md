# Stopping a dev/preview server on Windows can leave it running

_Found: 2026-10-04 · vite-switch_

Stopping the shell that ran `npm run dev` / `npm run preview` (or `npx react-scripts start`) kills the `npm` wrapper but can leave the child `node …/vite.js` process holding the port.

- **Check:** `Get-NetTCPConnection -LocalPort <port> -State Listen` (PowerShell) after stopping.
- **Fix:** confirm the owning process's command line points into your own worktree (`Get-CimInstance Win32_Process -Filter "ProcessId=<pid>"`), then `Stop-Process -Id <pid>`.
- Port `3000` on this machine is often held by an unrelated project — never stop a process that isn't from this repo's worktrees.
- `git worktree remove` can fail with "Permission denied" while a shell's working directory is inside the worktree; the worktree is still unregistered, and the leftover empty folder can be removed with `rmdir` once nothing is inside it.
