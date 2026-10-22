# Timing tests fail when parallel slices load the machine

_Seen: 2026-10-20 · polish sprint, wave 1 (L1 and E1)_

**Symptom:** with three slices running their suites and dev servers at once (about 37 node processes on 6 cores), a full `npm test` can fail on timing tests that pass alone:

- ~~`src/features/board/__tests__/new-game-clock.test.tsx`~~ (fixed: it now uses vitest fake timers for `setTimeout`, `clearTimeout` and `Date`, so it no longer depends on real time. It once failed with "expected 598 to be less than or equal to 597").
- A 5 s timeout in `src/game/opponent/__tests__/human-move.test.ts`.
- `vite-config › ignores an invalid PORT` (`tests/vite-config.test.ts`): it starts Vite under the default 5 s Vitest timeout; first seen 2026-10-10 (liem-opponent wave 2), never in CI so far. Fix later: give it a longer timeout.

**What to do:** rerun the failing file alone, or the whole suite with `npx vitest run --maxWorkers=2`. A failure that only shows under load and passes both ways is this issue, not your change. Say so in your report.

**Writing a clock test:** fake only `setTimeout`, `clearTimeout` and `Date` (`vi.useFakeTimers({ toFake: [...] })`), so React's scheduler keeps running on the real loop. Let React settle before you move time, as `new-game-clock.test.tsx` does.
