# Research: Animating the running chess clock (icon and digits) per second

_Generated: 2026-10-04 · Depth: standard · Searches: 11 · Pages read: 12_

**Assumptions:** The repo code was not read. I took the brief at face value: React + TS + Vite, `BsClockHistory` icon, `setInterval` at 1s, state in Redux Toolkit. "Active side" means the player whose turn it is. Only CSS approaches have fetched evidence; SMIL and animation libraries were not verified.

## What exists
For a technical question, this lists approaches, not products.

| Approach | Link | What it does | Alive? | License | How close to the idea |
|---|---|---|---|---|---|
| CSS `@keyframes` + `steps()` on a clock hand | [cssanimation.rocks](https://cssanimation.rocks/clocks/) | `animation: rotate 60s infinite steps(60)` makes a hand jump once per second | Article dated 2015-02-25 (possibly stale, CSS is stable) | n/a | Very close: a ticking second hand |
| CSS animation on an SVG child with `transform-box: fill-box` | [MDN transform-box](https://developer.mozilla.org/en-US/docs/Web/CSS/transform-box) | Spins an SVG part around its own box centre instead of the canvas centre | MDN, current | n/a | Needed if you split a hand from the icon |
| Whole-icon CSS animation via className | [web.dev guide](https://web.dev/articles/animations-guide) | Toggle a class on the `<svg>`; animate only `transform`/`opacity` | web.dev, current | n/a | Easiest fit for a react-icons icon |
| Low-time display change (chess.com) | [Codeberg PR 6, 2026-07-03](https://codeberg.org/TheUllernProject/chesscom-enhancer-extension/pulls/6) | Below 10s chess.com changes `M:SS` to a no-colon decimal like `9.8` | PR dated 2026-07-03 (third-party extension, not chess.com docs) | not checked | Shows the urgency pattern |
| Third-party low-time warning extension | [Chrome Web Store](https://chromewebstore.google.com/detail/felggchimnddpdmkhdcappeknkkffmke) | "When reaching 30 seconds a flame outline will start popping, in 10 seconds it goes faster" | Store page, undated | not checked | Shows two-step escalation (30s, then 10s) |
| Lichess (lila) | [GitHub](https://github.com/lichess-org/lila) | Open source; TypeScript + Snabbdom front end, Sass | 18.8k stars, 80k commits | AGPL-3.0 | Reference only; I could not confirm how its clock animates |

## Gaps and angles
- Per-second tick animation looks uncommon: the chess examples I could verify use urgency (decimals, a speed-up) and not a ticking icon. The lila `_clock.scss` summary showed only size, colour and opacity states (berserk, moretime). That was a summary of part of the file, so I make no claim about the rest of lichess. — [source](https://raw.githubusercontent.com/lichess-org/lila/master/ui/round/css/_clock.scss)
- `steps(60)` examples are built around a 60s loop of a full dial. A countdown icon only needs a 1s cycle. — [source](https://cssanimation.rocks/clocks/)
- Rotating an SVG part needs `transform-box: fill-box`, or the origin is the SVG canvas, not the part. — [source](https://developer.mozilla.org/en-US/docs/Web/CSS/transform-box)
- Countdown correctness: decrementing a counter in `setInterval` drifts and is throttled in background tabs. Computing `endTime - Date.now()` stays right "even if your timer fires late". — [OpenReplay](https://blog.openreplay.com/holiday-countdown-timer-javascript/), [dev.to](https://dev.to/wdsega/component-deep-dive-59-countdown-timer-setinterval-pitfalls-and-requestanimationframe-precision-4al) (dev.to date shown as "July 13", year unclear)

## Best practices
- Animate only `transform` and `opacity` to stay on the compositing stage and avoid layout and paint. Use `will-change` "sparingly, and only if you encounter a performance issue". — [web.dev](https://web.dev/articles/animations-guide)
- Honour `prefers-reduced-motion: reduce`. MDN: Baseline, widely available since January 2020; replace motion with static or less triggering alternatives. — [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- Do not announce every tick. `role="timer"` has an implicit `aria-live="off"`. MDN's example switches the role to `alert` at 10 seconds to force one announcement, then back after about 1 second. — [MDN timer role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/ARIA_timer_role)
- WCAG 2.2.2: motion that starts automatically, lasts over 5 seconds and sits next to other content needs a way to pause, stop or hide it, unless essential. The page lists "games with real-time competitive elements" as an essential example. A clock tick is arguably essential, but an off switch is cheap insurance. — [W3C](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)
- Derive time from a fixed end time (`Date.now()`), not a decremented counter. `setInterval` or `requestAnimationFrame` only triggers the re-render; with rAF, time "auto-aligns on return" after a hidden tab. — [dev.to](https://dev.to/wdsega/component-deep-dive-59-countdown-timer-setinterval-pitfalls-and-requestanimationframe-precision-4al)
- Escalate urgency in steps (chess.com 10s decimals; extension example 30s then 10s). — [Codeberg PR 6](https://codeberg.org/TheUllernProject/chesscom-enhancer-extension/pulls/6), [Chrome Web Store](https://chromewebstore.google.com/detail/felggchimnddpdmkhdcappeknkkffmke)

### Sync: tied to React state or independent? (my analysis, not sourced)
| Option | Pros | Cons |
|---|---|---|
| CSS animation, 1s loop, runs while a `running` class is on | No re-render per frame; smooth; trivial code | Phase may differ slightly from the digit change; restarts when the class toggles |
| Re-trigger on each tick (change `key` on the icon) | Lined up with the digit change | Remounts the SVG every second |
| Drive rotation angle from React state | Full control | Re-render each tick |

My read: an independent CSS loop plus a `Date.now()` based clock fits a small app.

## Ideas to consider
- Minimal: add class `clock-running` to the active icon only; CSS tilts or rotates it on a 1s loop, wrapped in `@media (prefers-reduced-motion: no-preference)`. Grows from [web.dev](https://web.dev/articles/animations-guide) and [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion).
- Swap in an inline SVG with a separate hand ticking via `steps()` and `transform-box: fill-box`. Grows from [cssanimation.rocks](https://cssanimation.rocks/clocks/) and [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/transform-box).
- Low-time stages: under 20s tint the icon, under 10s speed up the animation and show tenths. Grows from [Codeberg PR 6](https://codeberg.org/TheUllernProject/chesscom-enhancer-extension/pulls/6).
- Fix the drift: store `turnStartedAt` and `remainingAtTurnStart`, compute remaining with `Date.now()`. Grows from [OpenReplay](https://blog.openreplay.com/holiday-countdown-timer-javascript/).
- Accessibility pass: `role="timer"` with a label, no live updates, one announcement at 10s. Grows from [MDN timer role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/ARIA_timer_role).
- `font-variant-numeric: tabular-nums` on the digits so they do not shift width each second. `(own idea; not verified in this run)`
- A setting "Clock animation: on / off / follow system". `(own idea)`
- Bold: a depleting bar or ring around the clock (animate `transform: scaleX`), so time left is visible at a glance. `(own idea)`

## Questions for the plan
- Tick every second, or steady slow motion? — why it matters: `steps()` ticks match "counting down"; continuous motion is more distracting ([WCAG](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)) — options: tick / smooth spin / pulse.
- Animate only the icon, or also the digits? — why it matters: moving digits can hurt readability — options: icon only / icon + low-time digit effect.
- Keep the react-icons icon or use a custom SVG with a separate hand? — why it matters: whole-icon rotate is trivial; a separate hand needs `transform-box` ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/transform-box)) — options: keep / custom.
- Fix drift now or later? — why it matters: sources say a decremented counter drifts and is throttled in background tabs — options: now with `Date.now()` / defer.
- Low-time thresholds and what changes at each? — why it matters: chess.com uses 10s; the extension example uses 30s and 10s — options: 10s only / 20s + 10s / 30s + 10s.
- OS reduced-motion only, or an in-app toggle too? — why it matters: MDN supports the OS setting; WCAG has a games exception — options: OS only / toggle.
- Should screen readers hear anything? — why it matters: `timer` is silent by default; MDN shows a 10s alert pattern — options: silent / one alert at 10s / on request only.
- Will there be online play? — why it matters: lag and server time would make client-only timing insufficient (no fetched evidence; my reasoning) — options: local only / server-authoritative later.

## No evidence found
- How lichess animates its clock per second (only a partial SCSS summary).
- chess.com's own documentation of its low-time animation (only third-party extension pages).
- SMIL vs CSS vs JS library benchmarks for this use.
- A fetched source for `tabular-nums` and for online chess clock sync.

## Sources
- How to create high-performance CSS animations — https://web.dev/articles/animations-guide — undated, current
- ARIA: timer role — https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/ARIA_timer_role — current
- prefers-reduced-motion — https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion — current
- transform-box — https://developer.mozilla.org/en-US/docs/Web/CSS/transform-box — current
- Countdown timer JavaScript (OpenReplay) — https://blog.openreplay.com/holiday-countdown-timer-javascript/ — undated
- Countdown Timer: setInterval pitfalls (dev.to) — https://dev.to/wdsega/component-deep-dive-59-countdown-timer-setinterval-pitfalls-and-requestanimationframe-precision-4al — July 13 (year unclear)
- lichess-org/lila — https://github.com/lichess-org/lila — fetched 2026-10-04
- lila `_clock.scss` — https://raw.githubusercontent.com/lichess-org/lila/master/ui/round/css/_clock.scss — fetched 2026-10-04
- Codeberg PR 6, chesscom-enhancer-extension — https://codeberg.org/TheUllernProject/chesscom-enhancer-extension/pulls/6 — 2026-07-03
- Chesscom Low Time Warning — https://chromewebstore.google.com/detail/felggchimnddpdmkhdcappeknkkffmke — undated
- cssanimation.rocks clocks — https://cssanimation.rocks/clocks/ — 2015-02-25 (possibly stale)
- WCAG 2.2.2 Pause, Stop, Hide — https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html — current
