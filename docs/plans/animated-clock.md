# Plan: Animated clock

_Generated: 2026-10-05 · Status: active · Grilled-with: grilling (fast)_

## Goal
Make the running player's clock visibly tick: replace the static `BsClockHistory` icon with a small clock face whose hand steps forward once a second, in a chess.com-like style, with low-time warnings. Fix the countdown so it stays accurate, so the icon and the digits never fall out of step.

## Why
The clock looks frozen even while time is running, so it's easy to miss whose clock is ticking. Research (`docs/research/animated-clock.md`) found that chess sites focus on low-time warnings (chess.com shows tenths under 10s), and that the current countdown approach drifts.

Success: the running side's icon ticks once per real second; idle, waiting and finished clocks stay still; low time is obvious; time stays correct across turn switches and background tabs; reduced-motion users see no movement; screen-reader users hear one alert at 10s.

Constraint: keep the app's current look (dark page, white pill for the side to move, Quicksand, green Play / red Reset). No new runtime dependencies; plain CSS + an inline SVG.

## Scope
**In scope:**
- Accurate countdown in `Player.tsx`: remaining time computed from `Date.now()` (time at turn start + remaining at turn start), not by subtracting 1 each `setInterval` tick. `setInterval` (or rAF) only triggers re-renders. Behaviour stays the same: 10:00 per side, reset on Reset, `stop()` at 0 or game over.
- Cheap ticking: only the running side's clock runs a timer (the waiting side runs none); the timer isn't recreated every second; it updates once per second, and every 100 ms only while tenths are shown (under 10s).
- Custom inline SVG clock icon (round face, one hand) replacing `BsClockHistory`.
- Hand ticks one step per second on the running side only, in step with the digits changing.
- Low-time stages: under 20s and under 10s (see Look); tenths shown under 10s (`9.8`).
- `prefers-reduced-motion: reduce` → icon stays still (digits and colors still update).
- `role="timer"` with a label per player, no live announcements, except one alert at 10s left.
- `tabular-nums` on the digits so they don't shift width each second.
- Tests for the time math (drift-free countdown, formatting incl. tenths) and an updated row in `docs/features.md` for the clock.

**Out of scope:**
- An in-app motion on/off setting (OS setting only).
- Sounds.
- Animating the digits themselves (beyond the low-time color and tenths).
- Time controls other than 10:00, increments, online/server time.
- Other UI restyling.

## Sprint sequence

| Sprint | Goal | Status | Depends on |
|--------|------|--------|------------|
| ticking-clock | Drift-free countdown plus the chess.com-style ticking icon, low-time stages, reduced motion and the screen-reader alert | planned | — |

Status values: `planned` / `active` / `done`. The orchestrator only flips its row's Status — it does not rewrite Goal/Depends-on retroactively.

The `Depends on` column is the **only** cross-sprint dependency signal. Wave ordering and per-slice deps live inside the sprint doc and are opaque from here.

## Look
The human's pick, in their words: **"I prefer the chess.com style."** They chose this over the three drafted directions. The concrete reading below follows draft direction A (closest to chess.com) plus the one chess.com behaviour the research confirmed (tenths under 10s). Anything marked *(reading)* is our interpretation, not a verified copy of chess.com.

- **Thesis:** a plain, sporty game clock: a small round clock face beside bold digits, its hand clicking forward each second on the side to move.
- **Palette:** page `#333333` (background, unchanged) · waiting pill `#474747` with text `#FFFFFF` · running pill `#FFFFFF` with ink `#1C1C1C` · hand `#1C1C1C` *(reading: same as ink, no colored accent)* · low time `#D9534F` (the app's Reset red).
- **Type:** digits Quicksand 700, `tabular-nums`, 1.5rem as today; text Quicksand 500 (already loaded).
- **Layout:** unchanged: icon on the left of the digits inside the existing `.player__time` pill; same on phone width.
- **Signature detail:** the hand has only four positions (12, 3, 6, 9 o'clock) and jumps a quarter turn (90°) each second, so it goes all the way round every 4 seconds. A crisp jump with no sweep and no bounce. *(human, from memory of chess.com)*
- **Low time:** under 20s the running pill turns red `#D9534F` with white digits and icon *(reading)*; under 10s digits switch to tenths (`9.8`) *(chess.com, confirmed)* and the red stays. At 0 the pill stays red showing `0.0`.
- **Rules out:** colored second hands, bounce/overshoot, pulsing or breathing, flip digits, decorative effects on the waiting clock.
- **Draft:** `docs/design-drafts/look-directions.html`. None of A, B or C was picked as-is; A is the base for the reading above.

## Key decisions
- Tick, not pulse or smooth spin: it matches a countdown and is least distracting during play (research: WCAG 2.2.2 notes). Quarter-turn steps (4 positions, 90° per second), as the human recalls chess.com doing; easier to see at icon size than 6° steps.
- Icon moves; digits only change color and switch to tenths at low time. Moving digits hurt readability.
- Fix the countdown drift in this plan: a ticking icon makes drift visible, and tenths need accurate time. Remaining = `remainingAtTurnStart - (Date.now() - turnStartedAt)` (research: OpenReplay, dev.to sources).
- The hand's step is driven by the same tick that updates the digits, so the two can't drift apart (not an independent CSS loop).
- Custom inline SVG instead of `BsClockHistory`: a ticking hand needs its own element (research: MDN `transform-box`). Animate `transform` only.
- Motion off only via OS `prefers-reduced-motion` (default) (research: WCAG lists real-time games as essential; an in-app toggle needs a settings UI the app lacks).
- Screen readers: `role="timer"`, silent, one alert at 10s (research: MDN timer role pattern).
- Low-time thresholds 20s and 10s (default).
- Local play only; no server time (fact: the app has no online play).

## Known risks
- `Player.tsx` keeps the timer in component state and two effects; the rewrite could break Reset, the stop at 0, or game-over stopping. Mitigation: unit-test the time math as pure functions; smoke Play → move → Reset → Play again.
- Background-tab throttling: the tick can be late, so the hand may jump several steps when you come back. Acceptable, as long as the digits are right.
- The chess.com look is a reading, not a verified copy (research could not confirm chess.com's icon motion). Mitigation: human reviews it at the go check and on the final PR.
- Browser smoke can't easily drive time down to 20s/10s in a real 10-minute game. Mitigation: make the low-time states testable (pure functions for stage + format), and smoke the icon tick and a turn switch in the browser.

## Open questions
- None blocking. If the human corrects the *(reading)* items in Look, apply them before the sprint is drafted.

## Verification
- `npm run build && npm test` pass, including new tests for the countdown math (no drift across simulated late ticks and turn switches) and time formatting (`10:00`, `00:19`, `9.8`, `0.0`).
- In the running app, after Play: the side to move shows a clock icon whose hand jumps a quarter turn (90°) per second in step with the digits; the waiting side's icon is still; switching turns moves the ticking to the other side.
- With `prefers-reduced-motion: reduce` emulated, the hand doesn't move while digits keep counting.
- Each player's clock has `role="timer"` and an accessible label; an alert fires once at 10s left.
- `BsClockHistory` is no longer used in `Player.tsx`; no new runtime dependency in `package.json`.
- `docs/features.md` has a clock row that proves the tick and the countdown.
