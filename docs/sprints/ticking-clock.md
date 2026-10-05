# Sprint: Ticking clock

_From plan: docs/plans/animated-clock.md · Slug: ticking-clock · Status: active · Generated: 2026-10-05_

<!-- autopilot-run: started=2026-10-05T07:34:17Z sprints=0 waves=0 -->

## Status board

| Wave | Slice | Title | Branch | PR | Status | Confidence | Depends on |
|------|-------|-------|--------|----|--------|------------|------------|
| 1 | L1 | Look: clock color tokens and Quicksand 700 | ticking-clock-L1 | — | pending | — | — |
| 1 | T1 | Pure clock math: drift-free countdown, format, stage, hand angle, tick cadence, alert | ticking-clock-T1 | — | pending | — | — |
| 2 | C1 | Ticking clock UI: inline SVG icon, low-time pill, timer role, Player rewrite, features row | ticking-clock-C1 | — | pending | — | L1, T1 |

Plan branch: `animated-clock`. Wave heads: `ticking-clock-w1`, `ticking-clock-w2`.

Why this split: the time math (T1) and the theme (L1) don't touch each other and run in parallel; C1 is the only UI slice and needs both. All `Player.tsx` / `Player.css` work is in C1 so nothing overlaps.

## Shared contract

**Time unit.** All clock math is in whole milliseconds; the time source is `Date.now()`, passed in as `now`. Pure functions never read the clock themselves.

**Module `src/features/board/clock.ts`** (T1 owns, C1 calls). Exports:

```ts
export const TOTAL_MS: number;        // DEFAULT_TIME * 1000 (600000)
export const LOW_TIME_MS = 20_000;
export const TENTHS_MS = 10_000;
export interface ClockState { remainingMs: number; startedAt: number | null } // null = not running
export type ClockPhase = "reset" | "running" | "paused";
export function initialClock(): ClockState;                          // { remainingMs: TOTAL_MS, startedAt: null }
export function remainingMs(clock: ClockState, now: number): number;
export function startClock(clock: ClockState, now: number): ClockState;
export function pauseClock(clock: ClockState, now: number): ClockState;
export function formatClock(ms: number): string;
export function clockStage(ms: number): "normal" | "low" | "critical";
export function handAngle(ms: number): 0 | 90 | 180 | 270;
export function clockPhase(isPlaying: boolean, isActive: boolean, gameContinues: boolean): ClockPhase;
export function tickInterval(phase: ClockPhase, ms: number): 1000 | 100 | null;
export function lowTimeAlert(ms: number): string;
```

Rules and their edges:
- **Countdown.** `remainingMs` = `remainingMs` when `startedAt` is `null`; else `remainingMs - (now - startedAt)`. Never below 0. If `now < startedAt` (clock moved back), elapsed counts as 0. Late ticks don't matter: the value depends only on `now`. Time spent paused (the waiting side) never counts.
- **Start / pause repeat.** `startClock` on a running clock returns it unchanged (does not restart the turn). `pauseClock` on a paused clock returns it unchanged. `pauseClock` stores the remaining time at `now` and sets `startedAt: null`. Neither mutates its input.
- **Format.** `ms >= 10000` → `MM:SS`, both parts two digits, seconds floored (`600000` → `10:00`, `599999` → `09:59`, `19999` → `00:19`, `10000` → `00:10`). `ms < 10000` → `S.t`, tenths floored, no leading zero (`9999` → `9.9`, `9800` → `9.8`, `99` → `0.0`, `0` → `0.0`). Negative → `0.0`.
- **Stage.** `ms >= 20000` → `normal`; `10000 <= ms < 20000` → `low`; `ms < 10000` → `critical` (includes 0). Red starts the moment the digits read `00:19`.
- **Hand angle.** `((600 - floor(ms / 1000)) mod 4) * 90`, always one of 0/90/180/270 (never negative). It uses the same floored whole seconds as the digits, so hand and digits change on the same render: `600000` → 0, `599999` → 90, `599000` → 90, `598000` → 180, `597000` → 270, `596000` → 0. Under 10s it still steps once per whole second, not per tenth. Negative `ms` is treated as 0.
- **Phase.** `!isPlaying && gameContinues` → `reset` (before Play and after Reset: show 10:00). `isPlaying && gameContinues && isActive` → `running`. Everything else → `paused` (the waiting side; and after the game ends or a flag falls, so the final time, e.g. red `0.0`, stays on screen instead of jumping back to 10:00).
- **Tick interval.** `running` and `ms >= 10000` → `1000`; `running` and `ms < 10000` → `100`; `reset` / `paused` → `null` (no timer). The component's timer effect depends only on this value, so the timer is created at turn start, replaced once when crossing 10s, and cleared at turn end — never recreated every second, and the waiting side runs none.
- **Alert.** `lowTimeAlert(ms)` → `"10 seconds left"` when `ms < 10000`, else `""` (`10000` → `""`). C1 renders it inside a `role="alert"` element whose text goes from empty to the message once per clock per game; it doesn't change again at 0, and Reset empties it so the next game can alert again.
- **Flag fall.** When a tick reads `remainingMs <= 0` on the running side, the component dispatches `stop()` once. Game over while playing still dispatches `stop()`, as today.

**Theme tokens** (L1 owns, in `src/index.css` `:root`; C1 uses them, no other colors in the clock):

| Token | Value | Used for |
|---|---|---|
| `--clock-waiting-bg` | `#474747` | waiting pill |
| `--clock-waiting-ink` | `#FFFFFF` | waiting digits + icon |
| `--clock-running-bg` | `#FFFFFF` | running pill |
| `--clock-running-ink` | `#1C1C1C` | running digits + hand + face |
| `--clock-low-bg` | `#D9534F` | running pill under 20s |
| `--clock-low-ink` | `#FFFFFF` | its digits + icon |

The icon draws in `currentColor`, so it follows the pill's ink. Existing variables (`--background`, `--text`, `--dark-*`) stay as they are.

**Contrast.** Waiting (≈9.3:1) and running (≈17:1) pairs pass 4.5:1. The human-chosen low pair `#FFFFFF` on `#D9534F` is ≈3.96:1: it passes only as WCAG large text (the digits are 24 px at weight 700, which counts as large) and as a non-text icon (3:1). So the low pair may only be used for the 1.5rem/700 digits and the icon, never for normal-size text.

**Font.** Quicksand stays on the existing Google Fonts `@import`; it now loads weights 500 (body) and 700 (clock digits). Self-hosting was cut by the orchestrator: not in the plan, and it needs a network download mid-build.

## Per-slice detail

### L1: Look: clock color tokens and Quicksand 700
- **Scope:** Add the six clock tokens above to `src/index.css` `:root`. Change the existing Google Fonts `@import` to load Quicksand weights 500 and 700 (`wght@500;700`); nothing else about fonts changes (no self-hosting, no npm package). Base control styles: none — the only control styled this sprint is the clock pill, which C1 builds from these tokens; the Play/Reset buttons and the rest of the page don't change (plan: other restyling out of scope). No other slice edits `src/index.css`. Update `docs/codebase-structure.md` Stack & conventions with one line: clock colors are the `--clock-*` tokens in `src/index.css`.
- **Files owned:** `src/index.css`, `tests/theme.test.ts` (new), `docs/codebase-structure.md`
- **Success criteria:**
  - `[test] each --clock-* token has its contract value (hex compared case-insensitively) — tests/theme.test.ts › clock tokens have the Look values`
  - `[test] waiting and running ink/bg pairs reach 4.5:1, computed from the token values with the WCAG formula — tests/theme.test.ts › normal clock pairs meet 4.5:1 contrast`
  - `[test] the low pair reaches 3:1 (large digits and icon only) and is below 4.5:1 as documented — tests/theme.test.ts › low-time pair meets large-text contrast`
  - `[test] the Quicksand @import requests weights 500 and 700 — tests/theme.test.ts › quicksand loads 500 and 700`
  - `[manual] page text still renders in Quicksand with no visual change, at desktop and 375 px — load /chess-web/ in the dev server`
- **Depends on:** —
- **One-way door:** none

### T1: Pure clock math
- **Scope:** Create `src/features/board/clock.ts` with exactly the exports and rules in the Shared contract (`TOTAL_MS` from `DEFAULT_TIME` in `src/constants.ts`). Pure functions only: no React, no `Date.now()` inside, no timers. Don't touch `Player.tsx` (C1 wires it).
- **Files owned:** `src/features/board/clock.ts` (new), `src/features/board/__tests__/clock.test.ts` (new)
- **Success criteria:**
  - `[test] initialClock is 600000 ms, not running — clock.test.ts › initial clock is 10 minutes and paused`
  - `[test] remaining after a start is exact at simulated late ticks (start at t, read at t+1000, t+2350, t+7999) with no accumulated drift — clock.test.ts › countdown has no drift across late ticks`
  - `[test] start → pause → (waiting gap) → start keeps the paused value; time while paused isn't counted — clock.test.ts › turn switch does not count waiting time`
  - `[test] startClock on a running clock and pauseClock on a paused one return it unchanged; inputs are not mutated — clock.test.ts › start and pause are idempotent and pure`
  - `[test] remaining never goes below 0 and treats now < startedAt as 0 elapsed — clock.test.ts › remaining clamps at zero and ignores a clock moving back`
  - `[test] format: 600000→10:00, 599999→09:59, 19999→00:19, 10000→00:10, 9999→9.9, 9800→9.8, 99→0.0, 0→0.0, -5→0.0 — clock.test.ts › formats minutes, seconds and tenths`
  - `[test] stage: 20000 normal, 19999 low, 10000 low, 9999 critical, 0 critical — clock.test.ts › stage thresholds at 20s and 10s`
  - `[test] hand angle: 600000→0, 599999→90, 599000→90, 598000→180, 597000→270, 596000→0, 9800 and 9100 equal (same whole second), negative→same as 0 — clock.test.ts › hand steps a quarter turn per whole second`
  - `[test] hand angle changes exactly when formatClock's whole seconds change, for every ms in a sampled range — clock.test.ts › hand and digits change together`
  - `[test] phase: not playing + continues→reset; playing + active + continues→running; playing + waiting→paused; game over (playing or not)→paused — clock.test.ts › phase covers reset, running and paused`
  - `[test] tickInterval: running at 10000→1000, running at 9999→100, reset/paused→null at any ms — clock.test.ts › tick interval is 1s, 100ms under 10s, none when not running`
  - `[test] lowTimeAlert: 10000→"", 9999→"10 seconds left", 0→"10 seconds left" — clock.test.ts › alert text appears under 10s`
- **Depends on:** —
- **One-way door:** none

### C1: Ticking clock UI
- **Scope:**
  - New presentational `PlayerClock` (`src/features/board/components/PlayerClock.tsx`), props `{ remainingMs: number; isActive: boolean; playerName: string }`, no hooks or store. It renders the existing `.player__time` pill with: class `player__time--running` when `isActive`; class `player__time--low` when `isActive` and `clockStage` isn't `normal` (the waiting pill never turns red); `role="timer"` and `aria-label="Clock for <playerName>"` on the pill; an inline SVG `.clock-icon` (`aria-hidden="true"`, round face, one hand `.clock-icon__hand` with inline `transform: rotate(<handAngle>deg)` about the face center); digits `.player__timer` showing `formatClock`. A visually hidden sibling of the pill (not inside it) with `role="alert"` holds `lowTimeAlert(remainingMs)`.
  - Rewrite `Player.tsx` to keep a `ClockState` and drive it with `clockPhase` / `startClock` / `pauseClock` / `initialClock` and `Date.now()`, a timer effect keyed only on `tickInterval(...)` (see contract), and the flag-fall / game-over `stop()` rule. Remove `toTime` and the `BsClockHistory` import (leave `react-icons` in `package.json`; see note below). Render `PlayerClock`. Keep Reset, Play, stop at 0 and stop at game over working.
  - `Player.css`: clock colors only via the `--clock-*` tokens (waiting → waiting pair, running → running pair, low → low pair); digits weight 700 and `font-variant-numeric: tabular-nums`, 1.5rem as today; the hand has no `transition` or `animation` (crisp jump, no sweep or bounce); `@media (prefers-reduced-motion: reduce)` sets `.clock-icon__hand { transform: none !important; }`. Follow the plan's Look; nothing else on the page changes.
  - Docs: add a clock row to `docs/features.md` (drive: browser sample of both `.clock-icon__hand` transforms and digits across 2 s after Play, plus `npx vitest run src/features/board/__tests__/clock.test.ts src/features/board/__tests__/player-clock.test.tsx`; proof: running hand moves 90° per second with the digits, waiting hand and digits unchanged, tests pass), and keep the "Play and clocks" row true. In `docs/codebase-structure.md` add `clock.ts` and `PlayerClock` to Layout, and note under Tests that components may be tested in the node environment with `react-dom/server`'s `renderToStaticMarkup` (no jsdom).
- **Files owned:** `src/features/board/components/Player.tsx`, `src/features/board/components/Player.css`, `src/features/board/components/PlayerClock.tsx` (new), `src/features/board/__tests__/player-clock.test.tsx` (new), `src/features/board/__tests__/player.test.tsx` (new), `tests/player-css.test.ts` (new), `docs/features.md`, `docs/codebase-structure.md`
- **Success criteria:**
  - `[test] pill has role="timer", aria-label "Clock for Me", digits 10:00 at 600000 — player-clock.test.tsx › renders a labelled timer`
  - `[test] running class only when isActive; low class at 19999 active, not at 20000 active, not at 5000 waiting — player-clock.test.tsx › low-time red only on the running pill under 20s`
  - `[test] digits read 9.8 at 9800 and 0.0 at 0, with the low class still on when active — player-clock.test.tsx › shows tenths under 10s and 0.0 at zero`
  - `[test] hand style is rotate(0deg) at 600000 and rotate(90deg) at 599000; icon is an inline svg with aria-hidden — player-clock.test.tsx › hand angle follows the whole seconds`
  - `[test] role="alert" sibling is empty at 10000 and reads "10 seconds left" at 9999, and is not inside the timer — player-clock.test.tsx › one low-time alert outside the timer`
  - `[test] Player rendered with the real store shows 10:00 in a role="timer" with exactly one .clock-icon svg (no react-icons icon) — player.test.tsx › player renders the new clock at start`
  - `[test] Player.css clock rules (.player__time*, .clock-icon*) use only var(--clock-*) colors, no hex/rgb literals — tests/player-css.test.ts › clock styles use only the tokens`
  - `[test] digits have tabular-nums and weight 700; hand rule has no transition/animation; reduced-motion media rule sets the hand's transform to none — tests/player-css.test.ts › hand jumps crisply and stays still with reduced motion`
  - `[manual] after Play, the running side's hand jumps a quarter turn each second in step with the digits, with no sweep or bounce; the waiting side's icon is still; after a move the ticking moves to the other side and the first side keeps its time — browser at desktop and 375 px`
  - `[manual] with prefers-reduced-motion: reduce emulated, the hand doesn't move while digits keep counting — DevTools rendering emulation`
  - `[manual] waiting pill #474747/white, running pill white/#1C1C1C, icon left of digits, layout unchanged at desktop and 375 px; Reset brings both clocks back to 10:00 and Play starts again — browser`
- **Depends on:** L1, T1
- **One-way door:** none

Note for C1: after this slice `react-icons` has no importer left. Removing it changes `package.json` and the lockfile and is outside the plan, so leave it and add a PENDING suggesting the cleanup. The low-time 0.0 and red pill can't be reached in a real 10-minute browser run; the `player-clock` tests cover them (plan risk).
