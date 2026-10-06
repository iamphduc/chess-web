# Codebase structure

A client-side chess web app: Vite + React 18 + TypeScript + Redux Toolkit, deployed to GitHub Pages under `/chess-web/`. No backend, no database, no auth; all state is in the browser (Redux store).

## Layout

- **`index.html` → `src/index.tsx` → `src/App.tsx`**: the root `index.html` is the Vite entry and loads `/src/index.tsx` as a module. `index.tsx` wraps the app in the Redux `Provider` and the `DndProvider` from `react-dnd-multi-backend` with its `HTML5toTouch` preset (mouse uses the HTML5 backend, the first `touchstart` switches to the touch backend), plus a touch-only drag preview that draws the dragged piece at the square size (the `PieceDragPreview` component in the board's `components` folder); `App.tsx` renders the board. Single screen, no router.
- **`src/app/`**: the Redux store (`store.ts`, a `board` reducer and a `view` reducer) and typed hooks (`hooks.ts`).
- **`src/features/board/`**: the UI and Redux state for the game.
  - `Board.tsx` and `components/*` (`Square`, `Piece`, `Promotion`, `Notation`, `GameOver`, `FallenPieces`, `Player`, `BoardSidebar`, …): presentation; drag-and-drop via `react-dnd`, animation via `framer-motion`.
  - `src/features/board/BoardSlice.ts`: the Redux reducer. It keeps one engine `GameState` per ply (`engineHistory`), asks the engine for legal moves and applies moves through it, and keeps the UI-only parts itself: notation, last-move highlight, fallen pieces, the promotion picker step.
  - `src/features/board/engineAdapter.ts`: the bridge between the pure engine and the UI. It turns a `GameState` into the `HistorySquares` grid the UI reads, builds engine `Move`s from UI actions, maps the picker choice to a promotion kind, and reports the checked king and game-over state.
  - `orientation.ts`: pure board-to-screen math for the flip. Board coordinates stay White's view everywhere (`y = 0` is rank 8, `x = 0` is the a-file); `toDisplay`, `displayOrder`, `squareLabels` and `promotionPlacement` map them to where a square renders, which squares carry the rank and file labels, and where the promotion picker sits.
  - `viewSlice.ts`: the `view` reducer, `{ flipped, soundOn }`. `toggleFlip()` turns the board around; it isn't saved. `toggleSound()` turns move sounds on or off; the Sound button saves it, and the slice loads it at start. The board `reset` touches neither. `Board.tsx` renders squares in `displayOrder(flipped)` with each square keyed by its board index, swaps the player cards (keyed by color, so each clock stays with its player), and wraps the board in framer-motion `MotionConfig reducedMotion="user"`. The Flip button blocks the layout animation for the flip render, so pieces jump instead of sliding.
  - **Move sounds:** `src/features/board/sound.ts` holds the `SoundKind`s, the `SOUND_FILES` map, `pickSound` (game end > check > promotion > castle > capture > move) and `soundToPlay` (play a stored sound only when it's a new object and sound is on). `BoardSlice` stores `moveSound: { kind } | null`, a new object per completed ply (a promotion completes on the pick). `src/features/board/soundSetting.ts` loads and saves the setting in `localStorage` under `chess-web.sound` (`"on"`/`"off"`, default on, storage errors ignored). `src/features/board/soundPlayer.ts` is the Web Audio player: `install` fetches the files and waits for the first user gesture to make and resume the `AudioContext`; `play` starts a decoded buffer through one gain node and sets `data-last-sound="<kind> <n>"` on `<html>`. Its browser parts are injected, so the tests use fakes. `src/features/board/useMoveSound.ts`, mounted once in `Board.tsx`, installs the app's single player and plays each new `moveSound`.
  - `squareMarks.ts`: pure choice of the marks a square shows (highlight tint, dot or ring hint, check glow, drop edge); `Square` only renders what it returns. Mark colors come from the `--board-*` tokens in `src/index.css`.
  - `src/features/board/clock.ts`: pure clock math in whole milliseconds (drift-free countdown from `Date.now()` passed in, `MM:SS` / tenths format, low-time stages, the hand's quarter-turn angle, phase and tick interval, the 10s alert text). No React, no timers.
  - `src/features/board/components/Player.tsx` keeps each player's `ClockState` and one timer per turn (keyed on `tickInterval`, each tick timed to land when the digits change), and dispatches `stop()` on flag fall or game over. `PlayerClock.tsx` is the presentational pill: `role="timer"`, inline SVG clock face whose hand jumps 90° per second, digits, and a hidden `role="alert"` sibling at 10s.
  - `src/features/board/components/avatar.ts`: `avatarSrc(name)` maps a player's avatar file name to its imported image URL through a static map, falling back to `chess-player.png`. Add a line there when `src/game/players.ts` uses a new avatar.
- **`src/game/engine/`**: the pure rules engine, the only one the app uses. Immutable `GameState` (`game-state.ts`), `legalMoves`/`applyMove` (`engine.ts`), per-piece move generators and shared geometry (`moves/`), attack map and check (`moves/attack.ts`), checkmate/stalemate (`game-status.ts`), promotion ids (`moves/promotion.ts`). Fully unit-tested, including perft counts and a replayed recorded game.
  - `PROMOTED_IDS` in `src/game/engine/moves/promotion.ts` is the single table of promoted-piece ids (`*Promoted1..4`, at most 4 per type). `src/constants.ts` re-exports it as `PromotionBoard` for the picker.
- **`src/game/pieces/*`**: presentation only. Each piece class holds its image, weight and notation letter; no move rules and no game state. `src/game/piece-factory.ts` maps a `PieceType` to its piece object, and `src/game/piece-notation.ts` writes move notation.
- **`src/game/board-types.ts`**: the UI board types, `Square` (`{ pieceType, isEnemyAttacked }`) and `HistorySquares`.
- **`src/game/piece-type.ts`**: the `PieceType` enum, including the promoted ids. `src/game/players.ts` holds the two players' names and avatars.
- **`src/constants.ts`**: the start position, `PromotionBoard`, square sizes and the default clock time. It is imported by relative path; `constants` is not a bare-import prefix.
- **`src/assets/`**: piece SVGs and avatar PNGs.

## Stack & conventions

- **Toolchain:** Vite 8 (`vite.config.ts`) with `@vitejs/plugin-react` 6, Vitest 5, TypeScript 5.x (below 6). Node 22.12 or newer (Vitest 5 needs it); local is Node 24. React 18, Redux Toolkit 1.x, react-dnd 16 (with `react-dnd-multi-backend` 9 for touch) and framer-motion 7.
- **Scripts:** `dev` = `vite`, `build` = `tsc --noEmit && vite build` (Vite only transpiles; `tsc` type-checks `src/` only, not `vite.config.ts` or `tests/`), `preview` = `vite preview`, `test` = `vitest run`. Build output goes to `dist/`.
- **Base path:** `base` is `/chess-web/` in dev, build and preview. Files in `public/` are referenced as `/x`, never `%PUBLIC_URL%`.
- **Bare imports:** `app/`, `assets/`, `features/`, `game/` and `hooks/` resolve to `src/<prefix>/`. The single source is tsconfig `paths` (no `baseUrl`); Vite reads it through `resolve.tsconfigPaths`. Anything else, such as `constants`, is imported by relative path.
- **Sounds:** move sounds live in `public/sounds/` (one `.wav` per kind, each under 100 KB), with their source and CC0 licence in `public/sounds/CREDITS.md`. Vite copies them to `dist/sounds/`; the player loads them from `${import.meta.env.BASE_URL}sounds/`.
- **Clock colors:** the player clocks use only the `--clock-*` tokens in `src/index.css` `:root` (waiting, running and low pairs; the low pair is for the large digits and icon only). Quicksand loads weights 500 and 700 from the Google Fonts `@import` there.
- **SVGs:** never inlined (`build.assetsInlineLimit` returns `false` for `.svg`), because `Piece.tsx` and `Promotion.tsx` put image URLs in an unquoted CSS `url(...)` that a `data:` URL breaks.
- **Tests:** Vitest with `environment: 'node'` (no jsdom). Components may be tested in node by rendering to a string with `react-dom/server`'s `renderToStaticMarkup` (wrap in the Redux `Provider` with the real store if they read it); effects and timers don't run there, so keep timing logic in pure functions. Tests live in `__tests__/` folders under `src/` (they run through the app's own imports and aliases) and in the root `tests/` folder (tests that read files or run processes with Node APIs; `tsconfig` gives `src/` only `vite/client` types).
- **SVG mock:** under Vitest only, every `*.svg` import resolves to `src/__mocks__/svgMock.ts` (default export `"svg-mock"`). The production build bundles the real SVGs.
- **ESM package:** `package.json` has `"type": "module"`, so any Node script at the repo root must be ESM or be named `.cjs`.
- **Deploy:** GitHub Actions builds and publishes `dist/` to GitHub Pages on push to `main`; there is no local deploy script. See `## CI`.

## Smoke recipe

The app is a static single-page client; there is no server, database or login to stand up.

- **Install:** `npm install` (plain, no flags). Each worktree installs its own `node_modules`. A `node_modules` left from an older install (CRA era, or installed with extra flags) is stale: delete it and install again before running tests. On Windows the first install can leave a corrupt tree (for example an invalid `@rollup/rollup-win32-x64-msvc`); delete `node_modules` and install once more.
- **Dev:** `npm run dev` → `http://127.0.0.1:${PORT:-5173}/chess-web/`.
- **Production check:** `npm run build && npm run preview` → `http://127.0.0.1:${PORT:-4173}/chess-web/`. Use this to catch base-path problems (missing images, blank page).
- **Ports:** both servers bind `127.0.0.1`. Set `PORT` to a whole number from 1 to 65535 to pick the port (PowerShell: `$env:PORT=3030; npm run dev`); anything else falls back to the defaults above.
- **DB setup / login:** none.
- **What you see:** the 8×8 board in the start position, two player cards with avatars, notation and fallen pieces in the sidebar, and Play, Reset, Flip and Sound buttons (Sound is green when on). Pieces move by drag-and-drop or by clicking (or tapping) a piece and then its target square; a `GameOver` overlay appears on checkmate or stalemate.
- **Runtime to smoke:** load the board with no console errors and all piece images and both avatars showing; make a legal move and see it reflected; then play **castling, en passant, pawn promotion (promotion picker) and a checkmate (GameOver overlay)**; reset and play a second game to confirm state clears. Per-slice `Runtime to smoke` lines in engineer summaries name what a given slice adds.
- **Play by clicking:** each square has `data-square="<file><rank>"`. Click the piece's square, then the target square, for example `document.querySelector('[data-square="e2"]').click()` then `[data-square="e4"]` in one `eval`. This works after **Play** too, with no drag workaround.
- **Flip:** click **Flip board** (`aria-label`). The board turns (h1 top-left), the labels stay on the left and bottom edges, the white card moves to the top, and `aria-pressed` turns `true`. Pieces jump, they don't slide. Then play moves by click and by drag on the flipped board and check they land on the named squares; `data-square` names board squares, so the same selectors work flipped. Play a promotion (the picker opens beside the pawn) and a checkmate while flipped, and press Play then flip mid-game to see each clock stay with its player.
- **Sound:** browsers only unlock audio after a real user gesture, and a click from page JS doesn't count, so first give one real click with the tool's `click` (for example on the Notation heading). Then play a move, a capture, castling, a check, a promotion and a mate, and after each read `document.documentElement.dataset.lastSound` in an `eval`: it's `"<kind> <n>"`, with kind `move`, `capture`, `castle`, `check`, `promote` or `game-end` and `n` counting up. Toggle **Sound** (`aria-label="Sound"`) off, play a move and see `data-last-sound` unchanged, then reload and see the button still has `aria-pressed="false"` (`localStorage['chess-web.sound']` is `"off"`).
- **Phone (375 px):** `emulate --viewport "375x812x2,mobile,touch"` (`resize` stops at 500 px). The button row wraps. Play a full game by tapping squares (click from page JS, see `docs/known-issues/browser-smoke-touch.md`): castling, en passant, promotion and checkmate, with no console errors. To drag pieces by touch, follow the touch drag run in `docs/known-issues/browser-smoke-touch.md`.
- **Browser smoke gotchas:** pieces are not in the accessibility tree, so drags need a workaround; see `docs/known-issues/browser-smoke-drag.md`. Stopping a dev/preview server on Windows can leave it holding the port; see `docs/known-issues/windows-server-teardown.md`.
- **Verification:** `npm run build && npm test`. Both must pass.

## CI

One GitHub Actions workflow: `.github/workflows/pod-ci.yml`.

- **Triggers:** every `pull_request` (any target branch, including wave PRs into a plan branch), and `push` to `main` only. Pushes to other branches don't run it. To deploy again, re-run the `main` push run from the Actions tab.
- **`verify`:** Node 24 (`actions/setup-node`, npm cache), `npm ci`, then the smoke recipe's **Verification:** command (`npm run build && npm test`; `build` runs `tsc --noEmit`, so this is typecheck, build and tests). On a push to `main` it then uploads `dist/` as the Pages artifact; on a PR it uploads nothing.
- **`secrets`:** gitleaks (`gitleaks/gitleaks-action@v2`) scans the full git history (`fetch-depth: 0`).
- **`deploy`:** runs only on push to `main`, after both `verify` and `secrets` pass. It publishes `dist/` to `https://iamphduc.github.io/chess-web/` with `actions/deploy-pages`, in the `github-pages` environment. Only this job can write (`pages: write`, `id-token: write`); the rest are `contents: read`. Deploys queue (concurrency group `pages`) and never cancel each other. On a PR it shows as skipped.
- Actions are pinned to major tags (`@vN`). The only secret used is `GITHUB_TOKEN`.

**Human setup** (agents don't change repo settings):

- Before the first deploy from `main`: repo Settings → Pages → Source → "GitHub Actions". Until then Pages keeps serving the old `gh-pages` branch, and the `deploy` job fails. Rollback: switch Source back to the `gh-pages` branch.
- Decide whether `verify` and `secrets` become required status checks on `main`.
