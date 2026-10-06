# Sprint: Sound and touch drag

_From plan: docs/plans/board-feel.md · Slug: sound-and-touch-drag · Status: active · Generated: 2026-10-06_

<!-- autopilot-run: started=2026-10-06T11:36:12Z sprints=1 waves=3 -->

## Status board

| Wave | Slice | Title | Branch | PR | Status | Confidence | Depends on |
|------|-------|-------|--------|----|--------|------------|------------|
| 1 | S1 | Move sounds, Sound toggle, and the plan's closing docs | sound-and-touch-drag-S1 | — | pending | — | — |
| 1 | T1 | Touch drag through `react-dnd-multi-backend` | sound-and-touch-drag-T1 | — | pending | — | — |

Why this split: sound and touch drag share no files and no state, so they run side by side in one wave, with at most two dev servers at once. Sound stays one slice: the rules, the setting, the player and the button are small, and the button and the hook can't be built without the other three. The plan's closing docs go in S1, which owns `docs/codebase-structure.md`. The Look foundation is already in place from `board-interaction` (L1), so this sprint has no `L1`.

## Shared contract

**Board coordinates, `pickUp`, `clickSquare` and `movePiece` are unchanged** (see `docs/sprints/archive/board-interaction.md` → Shared contract). Neither slice changes their behavior. T1 doesn't edit `Piece.tsx` or `Square.tsx`.

**Sound kinds** (S1, `src/features/board/sound.ts`): `type SoundKind = "game-end" | "check" | "promote" | "castle" | "capture" | "move"`.
- `pickSound({ gameEnd, check, promotion, castle, capture }: boolean flags) → SoundKind` returns the first true flag in the order game end > check > promotion > castle > capture, and `"move"` when none is true.
- `gameEnd` means the position after the ply is checkmate or stalemate (the engine's verdict on that position, not `state.board.gameOver`). `check` means the side to move after the ply is in check. En passant counts as a capture. A capturing promotion is `"promote"`. A castle that gives check is `"check"`.

**Move sound in the board state** (S1, `BoardSlice.ts`): `state.board.moveSound: { kind: SoundKind } | null`.
- It starts `null`, and `reset` sets it back to `null`.
- Each completed ply stores a **new object**, even when the kind is the same as the last ply. That's how a repeated kind plays again.
- A ply is complete when `movePiece` or `clickSquare` plays a move that isn't a promotion, or when `promotePawn` finishes a promotion. The pawn reaching the last rank (picker open) leaves `moveSound` as it was, so the sound plays once, on the pick.
- `stop()` (flag fall or Play/stop) and `selectPiece`, `pickUp`, and `clickSquare` select or deselect calls leave it as it was. A flag fall plays no sound.
- A promotion picked after a flag fall stores the kind for that ply (by the rules above), so it's `"promote"` unless the promotion mates or checks.
- Moves before Play store sounds too, the same as moves after Play.

**Sound setting** (S1):
- `state.view.soundOn: boolean`. `toggleSound()` inverts it. The board `reset` doesn't change it, and `toggleFlip` doesn't either.
- The storage key is `chess-web.sound` in `localStorage`, with the value `"on"` or `"off"`. `src/features/board/soundSetting.ts` exports `loadSoundOn(getStorage)` and `saveSoundOn(getStorage, on)`. `getStorage` returns a `Storage`-like object, or it may throw or return `undefined`.
- Load: a missing key, any value other than `"off"`, a throwing `getItem`, a throwing `getStorage` or no storage all give `true` (the default is on). Only `"off"` gives `false`.
- Save: it writes `"on"` or `"off"`. A throwing `setItem` or no storage is swallowed: nothing is thrown or logged, and the in-memory setting still changes.
- The view slice's initial `soundOn` comes from `loadSoundOn` with the real `localStorage`, accessed inside the try/catch (Node test runs may have no `localStorage`).

**Playing** (S1, `src/features/board/soundPlayer.ts`, `createSoundPlayer(deps)`; the browser deps are injected so the tests use fakes):
- Each `SoundKind` has one file in `public/sounds/`, listed in a `SOUND_FILES` map in `sound.ts` and loaded from `${import.meta.env.BASE_URL}sounds/<file>`.
- **No `AudioContext` exists before the first user gesture.** `install(target)` fetches every file and adds listeners for `pointerdown`, `pointerup`, `keydown` and `touchend`. It's idempotent: a second call (React StrictMode) adds no more listeners and doesn't fetch again. On a gesture, the player creates the context (once), calls `resume()`, and decodes the fetched files. Listeners stay until the context reports `running`, so a failed or ignored resume is tried again on the next gesture.
- `play(kind)` starts that kind's decoded buffer through a fixed gain node. It does nothing when there's no context yet, when that buffer isn't decoded (a failed fetch or decode, or decoding still running), or when Web Audio isn't supported. It never throws, and no fetch or decode rejection is left unhandled. A new sound doesn't stop one that's still playing.
- Each sound that actually starts sets `data-last-sound="<kind> <n>"` on `<html>`, where `n` counts the sounds started since load. This is so browser smoke runs can see the sound play.
- `soundToPlay(prev, next, soundOn) → SoundKind | null` (in `sound.ts`) returns `next.kind` only when `next` is not `null`, `next !== prev` (by reference), and `soundOn` is true. The hook keeps the `moveSound` it saw last, starting with the one at mount, so mounting, toggling sound on, or re-rendering never replays an old move.

**Touch drag** (T1):
- `src/index.tsx` uses `DndProvider` from `react-dnd-multi-backend` with `options={HTML5toTouch}` from `rdndmb-html5-to-touch` (both `^9.0.0`), in place of the `react-dnd` provider with `HTML5Backend`.
- The tree keeps a single `react-dnd` and `dnd-core` copy. Mouse uses the HTML5 backend as before. The first `touchstart` switches to the touch backend.
- A touch-only drag preview draws the dragged piece at the square size. Desktop shows none.

**Feature rows** (the orchestrator writes them in `docs/features.md`):
- **Move sounds:** drive with `npx vitest run src/features/board/__tests__/sound.test.ts src/features/board/__tests__/move-sound.test.ts`, and in the browser read `document.documentElement.dataset.lastSound` after each kind of move. To prove mute, toggle Sound, reload, and read `localStorage['chess-web.sound']`.
- **Touch drag:** drive with T1's CDP touch run.

## Per-slice detail

### S1: Move sounds, Sound toggle, and the plan's closing docs
- **Scope:**
  - Build everything in the contract's Sound kinds, Move sound, Sound setting and Playing sections.
  - Pick a small CC0 pack that has move, capture, check, castle, promote and game-end sounds (the plan's open question). If a kind is missing, use another CC0 sound or a distinct short tone for it.
    - Every file must decode in Chrome, Firefox and Safari, so use `.mp3` or `.wav`, not `.ogg` only. Keep each file under 100 KB.
    - Record the pack name, author, source URL, licence (CC0), and which file is which kind in `public/sounds/CREDITS.md`.
  - Add a `useMoveSound` hook, mounted once in `Board.tsx`. It installs the app's single player on mount and plays `soundToPlay(...)` when `moveSound` changes. `soundOn` is read without being an effect dependency.
  - Add a **Sound** button (`ButtonType.Sound`) in the `.buttons` row, right after Flip.
    - It's `button button--icon` with `aria-label="Sound"`, `title="Sound"`, `type="button"`, and `aria-pressed` equal to `soundOn`.
    - When sound is on, it also has `button--sound-on`, whose background is `var(--board-sound-on)` in `Button.css`. When sound is off, it keeps the default dark surface.
    - The inline SVG icon is a speaker with sound waves when on, and a speaker with a cross when off. Like Flip, it uses `currentColor`, `aria-hidden`, and `focusable="false"`.
    - A click dispatches `toggleSound()` and saves the new value with `saveSoundOn`.
    - Use only the existing tokens and follow the plan's `## Look`: no new colors, and no change to Play, Reset, Flip or the `.button--icon` size.
  - Don't edit `src/index.tsx`, `Piece.tsx` or `Square.tsx` (T1 owns `index.tsx`), and don't add an npm dependency.
  - **Docs:**
    - Update `docs/codebase-structure.md`:
      - **Layout:** the sound modules, `soundOn` in `viewSlice.ts`, and the `index.tsx` provider. That's `react-dnd-multi-backend`'s `DndProvider` with the `HTML5toTouch` preset plus a touch-only drag preview. Name T1's preview file in prose, not as a backticked `src/` path, because `tests/docs.test.ts › layout paths exist` runs on this branch without T1's files.
      - **Stack & conventions:** sounds live in `public/sounds/` with `CREDITS.md`.
      - **Smoke recipe, "What you see":** add the Sound button.
      - **Smoke recipe, new "Sound" step:** give one real-gesture click first (the tool's `click`, since page-JS clicks don't unlock audio), then play a move, a capture, castling, a check, a promotion and a mate, reading `data-last-sound` after each. Toggle Sound off, play a move and see `data-last-sound` unchanged, then reload and see `aria-pressed="false"`.
      - **Phone step:** add a pointer to the touch drag run in `docs/known-issues/browser-smoke-touch.md`.
    - Update `docs/roadmap.md`: add a **Done** section with "Move to Vite" and "Better board feel". Remove them from "Up next" and "Approved, order not set", and renumber "Up next".
- **Files owned:**
  - `src/features/board/sound.ts` (new)
  - `src/features/board/soundSetting.ts` (new)
  - `src/features/board/soundPlayer.ts` (new)
  - `src/features/board/useMoveSound.ts` (new)
  - `src/features/board/BoardSlice.ts`
  - `src/features/board/viewSlice.ts`
  - `src/features/board/Board.tsx`
  - `src/features/board/components/Button.tsx`
  - `src/features/board/components/Button.css`
  - `public/sounds/` (new: one file per kind, plus `CREDITS.md`)
  - `src/features/board/__tests__/sound.test.ts` (new)
  - `src/features/board/__tests__/move-sound.test.ts` (new)
  - `src/features/board/__tests__/sound-setting.test.ts` (new)
  - `src/features/board/__tests__/sound-player.test.ts` (new)
  - `src/features/board/__tests__/sound-button.test.tsx` (new)
  - `src/features/board/__tests__/view-slice.test.ts`
  - `tests/sound-files.test.ts` (new)
  - `docs/codebase-structure.md`
  - `docs/roadmap.md`
- **Success criteria:**
  - `[test]` Each flag alone gives its kind, no flags give `"move"`, and every pair of flags gives the higher-priority kind (all 15 pairs) — `sound.test.ts` › `pickSound follows the priority`
  - `[test]` `soundToPlay` returns the kind only for a new non-null object with sound on. It returns `null` for the same object, for `null`, and with sound off — `sound.test.ts` › `soundToPlay plays each new ply once`
  - `[test]` 1.e4 stores `"move"`, a capture stores `"capture"`, an en passant capture stores `"capture"`, and O-O and O-O-O store `"castle"` — `move-sound.test.ts` › `quiet, capture, en passant and castle sounds`
  - `[test]` A checking move stores `"check"`, and the Qh4# mate (1.f3 e5 2.g4 Qh4#) stores `"game-end"` — `move-sound.test.ts` › `check and checkmate sounds`
  - `[test]` A stalemating move stores `"game-end"` — `move-sound.test.ts` › `stalemate sound`
  - `[test]` A pawn reaching the last rank leaves `moveSound` unchanged (same reference). The pick then stores `"promote"`, or `"check"` when the promoted piece gives check — `move-sound.test.ts` › `promotion sounds on the pick`
  - `[test]` Two quiet moves in a row store two different objects, both `"move"`. Moves played by `clickSquare` store the same kinds as `movePiece` — `move-sound.test.ts` › `each ply stores a new sound`
  - `[test]` `reset` sets `null`. `stop()`, `pickUp`, `clickSquare` select/deselect and `selectPiece` keep the same reference. A promotion picked after a flag fall stores `"promote"` — `move-sound.test.ts` › `no sound without a completed ply`
  - `[test]` Load gives `true` for a missing key, `"on"`, a junk value, a throwing `getItem`, a throwing `getStorage` and `undefined` storage. It gives `false` only for `"off"` — `sound-setting.test.ts` › `loadSoundOn defaults to on`
  - `[test]` Save writes `"on"` and `"off"`. A throwing `setItem` and no storage don't throw and log nothing — `sound-setting.test.ts` › `saveSoundOn never throws`
  - `[test]` `toggleSound` inverts `soundOn` twice. The board `reset` and `toggleFlip` leave it alone — `view-slice.test.ts` › `sound toggles and survives reset`
  - `[test]` With fakes: `install` creates no context and fetches every file once, even when called twice. The first gesture creates one context, resumes it and decodes. A gesture after `running` creates nothing new — `sound-player.test.ts` › `context waits for the first gesture`
  - `[test]` If `resume` rejects or leaves the context `suspended`, the next gesture calls `resume` again with no second context and no unhandled rejection — `sound-player.test.ts` › `resume retried on the next gesture`
  - `[test]` `play` before any gesture, for a kind whose fetch failed, and with no `AudioContext` support starts nothing and doesn't throw. Other kinds still play — `sound-player.test.ts` › `play skips what isn't ready`
  - `[test]` A started sound connects its buffer through the gain node and sets `data-last-sound` to `"<kind> <n>"` with `n` counting up. A skipped play leaves the attribute unchanged — `sound-player.test.ts` › `play starts the buffer and marks it`
  - `[test]` The Board markup has the Sound button right after Flip in `.buttons`, with `button button--icon button--sound-on` and `aria-pressed="true"` when on. With `soundOn` false it has no `button--sound-on` and `aria-pressed="false"` — `sound-button.test.tsx` › `sound button reflects the setting`
  - `[test]` `Button.css` has a `.button--sound-on` rule whose background is `var(--board-sound-on)` — `sound-button.test.tsx` › `sound-on style uses the token`
  - `[test]` Every `SoundKind` has an entry in `SOUND_FILES`, and its file exists in `public/sounds/` and is non-empty, `.mp3` or `.wav`, and under 100 KB. `npm run build` copies them to `dist/sounds/` — `tests/sound-files.test.ts` › `every sound kind ships a file`
  - `[manual]` In the browser, after one real click: move, capture, castle, check, promotion and mate each play a clearly different sound and set `data-last-sound` to the right kind. The console shows no errors or warnings, including on load before any click.
  - `[manual]` Sound off: moves are silent and `data-last-sound` doesn't change. After a reload the button is still off. Turning it back on doesn't replay the last move.
  - `[manual]` Look at desktop and 375 px: Sound sits right after Flip with the same size and radius. It's green (`#059862`) when on and dark when off, the icon changes, the row wraps cleanly on the phone, and Tab shows the white focus ring.
  - `[manual]` `public/sounds/CREDITS.md` names the pack, author, source URL, CC0, and each file's kind. The source page confirms CC0.
- **Depends on:** —
- **One-way door:** none

### T1: Touch drag through `react-dnd-multi-backend`
- **Scope:**
  - Build the contract's Touch drag section from T1's findings in `docs/research/touch-drag.md` (What the next sprint needs).
  - Install `react-dnd-multi-backend` and `rdndmb-html5-to-touch` with plain `npm install`. They're the plan's one allowed runtime dependency (with its preset). Change no other package's version. `react-dnd-html5-backend` stays.
  - In `src/index.tsx`, swap the provider. Inside it, render a touch-only `PieceDragPreview` that uses `usePreview` (or `Preview`) from `react-dnd-multi-backend`.
    - Its drawing is a plain exported component, `PieceDragImage({ pieceType, size, style })`. It's a `div` with the piece image as its background, `size` × `size` px, `pointer-events: none`, and the preview's position `style` merged in.
    - The size follows the same breakpoints as `Board.tsx`: `SQUARE_SIZE_XS`, `_MD` from 768 px, and `_XL` from 1200 px.
    - The piece image comes from `pieceFactory`, as in `Piece.tsx`.
  - Don't add `touch-action` CSS. The research found it isn't needed. If the touch run shows the page scrolling during a piece drag, log a `PENDING` entry and don't fix it here.
  - Don't edit `Piece.tsx`, `Square.tsx`, `Board.tsx` or the board CSS. Drag start already selects through `pickUp`.
  - Update `docs/known-issues/browser-smoke-touch.md` with the touch-drag smoke run. Say which `docs/research/touch-drag.md` scenarios to run and what each should show, now that touch drag is in the app.
  - Use only existing tokens and images, and follow the plan's `## Look`. The preview is the piece image alone, with no shadow, no tint and no scale.
- **Files owned:**
  - `package.json`
  - `package-lock.json`
  - `src/index.tsx`
  - `src/features/board/components/PieceDragPreview.tsx` (new)
  - `src/features/board/__tests__/piece-drag-preview.test.tsx` (new)
  - `tests/touch-dnd.test.ts` (new)
  - `docs/known-issues/browser-smoke-touch.md`
- **Success criteria:**
  - `[test]` `package.json` has `react-dnd-multi-backend` and `rdndmb-html5-to-touch` at major 9. `react-dnd` is still major 16, and no other dependency was added — `tests/touch-dnd.test.ts` › `touch drag deps match the plan`
  - `[test]` `react-dnd`, resolved from inside `react-dnd-multi-backend`, `react-dnd-preview` and the app root, is one file path, and so is `dnd-core` (a single copy) — `tests/touch-dnd.test.ts` › `one react-dnd copy`
  - `[test]` `PieceDragImage` for `WhiteKnightKing` (or any piece) at size 48 renders the piece image URL (`svg-mock`), `width:48px`, `height:48px`, `pointer-events:none`, and the passed `transform` — `piece-drag-preview.test.tsx` › `drag image draws the piece at the square size`
  - `[test]` The size picker returns XS, MD and XL at 375, 768 and 1200 px widths (a pure helper given the two media-query results) — `piece-drag-preview.test.tsx` › `preview size follows the board breakpoints`
  - `[manual]` CDP touch run at 375 px (`docs/research/touch-drag.md` script): touch drag e2–e4 and g1–f3 play `1. e4` and `1. Nf3`, the dots show during the drag, and the piece image follows the finger.
  - `[manual]` CDP touch run: a tap on e2 and then e4 still plays `1. e4`. A piece drag keeps `scrollY` steady on a 500 px tall page. A touch drag on the flipped board lands on the named square. The console shows no errors.
  - `[manual]` Desktop mouse drag (the tool's `drag`, or the CDP `mousedrag` scenario) still plays e2–e4 with the HTML5 drag image and no touch preview. Click-to-move still works.
  - `[manual]` Look at 375 px mid-drag: the preview is the plain piece at square size, with no box, shadow or tint, and the source piece is faded on its square as before.
- **Depends on:** —
- **One-way door:** none
