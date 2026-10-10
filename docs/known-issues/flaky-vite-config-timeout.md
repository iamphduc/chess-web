# `vite-config` test can time out under load

`tests/vite-config.test.ts › ignores an invalid PORT` starts Vite and has the default 5 s Vitest timeout. When the machine is busy (for example a full `npm test` right after `npm run build`, or several worktrees testing at once), it can time out once. It passes when run again or alone.

- **Seen:** 2026-10-10, sprint `liem-opponent` wave 2, by two engineers; never in CI so far.
- **What to do:** rerun the suite, or run `npx vitest run tests/vite-config.test.ts`. A failure that repeats is real.
- **Fix later:** give that test a longer timeout.
