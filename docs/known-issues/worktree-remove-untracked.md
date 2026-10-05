# `git worktree remove` refuses a worktree that has `node_modules`

Every slice worktree runs `npm install` and `npm run build`, so it holds untracked `node_modules/` and `dist/` (both git-ignored). Plain `git worktree remove <path>` then refuses with "contains modified or untracked files".

**Don't** reach for `git worktree remove --force` — pod's no-force rule forbids it, because it also throws away real uncommitted work if there is any.

**Do**, from inside the worktree once your work is committed and pushed:

```bash
git status --short          # must show nothing (ignored files aren't listed)
git clean -fdX              # capital X: deletes only ignored files (node_modules, dist)
cd <parent-repo> && git worktree remove .claude/worktrees/<branch>
```

`git clean -fdX` touches only git-ignored files, so it can't delete uncommitted work. If removal still refuses, stop and report it — don't force it. On Windows, long paths inside `node_modules` need `git config core.longpaths true` (set at preflight).
