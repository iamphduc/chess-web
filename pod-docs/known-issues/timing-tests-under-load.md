# Timing tests fail when parallel slices load the machine

_Seen: 2026-10-20 · polish sprint, wave 1 (L1 and E1)_

**Symptom:** with three slices running their suites and dev servers at once (about 37 node processes on 6 cores), a full `npm test` can fail on timing tests that pass alone:

- `src/features/board/__tests__/new-game-clock.test.tsx`, for example "expected 598 to be less than or equal to 597".
- A 5 s timeout in `src/game/opponent/__tests__/human-move.test.ts`.
- `vite-config › ignores an invalid PORT`.

**What to do:** rerun the failing file alone, or the whole suite with `npx vitest run --maxWorkers=2`. A failure that only shows under load and passes both ways is this issue, not your change. Say so in your report.
