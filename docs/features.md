# Features

> How to prove each user-facing feature works on the running app (start it per the brief's `## Smoke recipe`). Agents drive these rows to check their work, and the reviewer runs every command row at plan end, so a feature that quietly breaks later gets caught. Keep to the features a user would miss first.
>
> - **Drive:** a command (preferred — anyone can run it, the reviewer included), or browser steps.
> - **Proof:** what you can observe when it works — a response, a value read back from storage, text on the page. "No errors" isn't proof.
> - A failing row is a bug, unless a plan changed that feature on purpose — then update the row. Never edit a row just to make it pass.

| Feature | User reaches it by | Drive | Proof |
|---|---|---|---|
| Board loads | Open `/chess-web/` | `curl -s http://127.0.0.1:$PORT/chess-web/` for the shell; in a browser, `eval "() => [document.querySelectorAll('.square').length, document.querySelectorAll('.piece').length]"` | `[64, 32]`, both player cards (Le Quang Liem, Me) with avatars, clocks `10:00`, no console errors |
| Move a piece (drag and drop) | Drag a piece onto a highlighted square | Browser: label `.square` piece and target with `role="img"`, `snapshot`, `drag` (see `docs/known-issues/browser-smoke-drag.md`), e2 to e4; or `npx vitest run src/features/board/__tests__/board-slice.test.ts` | Notation reads `1. e4`; tests (a) and (b) pass |
| Legal move hints and check | Pick up a piece; get a king in check | `npx vitest run src/game/engine/__tests__/legal-filter.test.ts src/game/engine/__tests__/engine.test.ts` | Tests pass (illegal moves filtered, possible moves listed) |
| Castling and en passant | Move king two squares; capture a pawn that just double-stepped | `npx vitest run src/game/engine/__tests__/apply-move-special.test.ts` | Castle, rights and en-passant capture tests pass |
| Pawn promotion | Move a pawn to the last rank and pick a piece in the picker | `npx vitest run src/features/board/__tests__/board-slice.test.ts` | Test (c) passes: promotion position set, then promoted id lands |
| Checkmate and stalemate (GameOver overlay) | Mate or stalemate the opponent, with or without the clocks running; or let a clock run out | `npx vitest run src/game/engine/__tests__/game-status.test.ts src/game/engine/__tests__/recorded-game.test.ts src/features/board/__tests__/game-end-stop.test.tsx` | Scholar's mate replay reaches checkmate; stalemate case reported; overlay shows `White Win!` / `Black Win!` / `Draw!`; with the clocks running a stalemate still shows `Draw!` and a flag fall shows the other side as winner |
| Play and clocks | Click **Play** | Browser: click Play, wait 3s, `eval "() => document.body.innerText.match(/\d\d:\d\d/g).join(',')"` | One clock drops below `10:00` (seen `09:55,10:00`) |
| Ticking clock icon and low time | Click **Play**; watch the side to move | Browser: click Play, then twice 1 s apart `eval "() => [...document.querySelectorAll('.player__time')].map(p => p.querySelector('.clock-icon__hand').style.transform + ' ' + p.querySelector('.player__timer').textContent)"`; and `npx vitest run src/features/board/__tests__/clock.test.ts src/features/board/__tests__/player-clock.test.tsx` | Running side: hand turns 90° per second together with the digits (e.g. `rotate(90deg) 09:59` then `rotate(180deg) 09:58`); waiting side unchanged (`rotate(0deg) 10:00`); tests pass (red pill under 20s, tenths `9.8`, `0.0` at zero, one alert at 10s) |
| Reset | Click **Reset** | Browser: after a move, `eval "() => document.querySelectorAll('button')[1].click()"`, then read `.notation` text after a moment | Notation is empty and 32 pieces are back (updates asynchronously) |
| Notation and fallen pieces | Sidebar after each move/capture | `npx vitest run src/features/board/__tests__/board-slice.test.ts` and read `.notation` in browser | Move text appears per ply, e.g. `1. e4` |
| Production base path | `npm run build && npm run preview` | `curl -s http://127.0.0.1:$PORT/chess-web/` | HTTP 200, HTML links `/chess-web/assets/index-*.js`; 32 pieces render, no console errors |
