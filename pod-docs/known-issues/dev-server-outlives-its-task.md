# A backgrounded dev server can outlive its stopped task on Windows

_Seen: 2026-10-21 · ui-feel wave check_

**Symptom:** `npm run dev` started as a background task, then stopped with the task tool, left `node … vite.js --port 3200` running. The port stayed taken, and the worktree folder couldn't be removed ("Device or resource busy" or "Invalid argument").

**Cause:** stopping the task kills the shell and npm, not Vite, which is a grandchild process.

**Workaround:** after stopping a dev server, check the port and stop what still listens on it, for example in PowerShell: `Get-NetTCPConnection -LocalPort 3200 -State Listen | % { Stop-Process -Id $_.OwningProcess }`. Do this before removing the worktree.

**Cost when hit:** a locked worktree folder left behind until the process is found.
