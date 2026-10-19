# Removing a slice worktree: no `--force`, and usually no cleanup needed

Every slice worktree runs `npm install` and `npm run build`, so it holds `node_modules/` and `dist/`. Both are git-ignored, and on this repo (2026-10-05, git for Windows) a plain `git worktree remove <path>` removes such a worktree without complaint. It refuses only when there are untracked files that are *not* ignored, or uncommitted changes.

**Don't** reach for `git worktree remove --force`: pod's no-force rule forbids it, because it throws away real uncommitted work.

**Do**, from the parent repo, once your work is committed and pushed:

```bash
git -C .claude/worktrees/<branch> status --short   # must show nothing
git worktree remove .claude/worktrees/<branch>
git branch -d <branch>
```

If removal refuses, read what `git status --short` lists: commit it, or report it. `git clean -fdX` (ignored files only) is safe in principle, but the permission system has refused it in autopilot runs, so don't rely on it. Never force.
