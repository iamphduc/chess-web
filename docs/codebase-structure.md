# Codebase structure

A client-side chess web app: Vite + React 18 + TypeScript + Redux Toolkit, deployed to GitHub Pages under `/chess-web/`. No backend, no database, no auth; all state is in the browser (Redux store).

## Layout

- **`index.html` → `src/index.tsx` → `src/App.tsx`**: the root `index.html` is the Vite entry and loads `/src/index.tsx` as a module. `index.tsx` wraps the app in the Redux `Provider` and react-dnd's `DndProvider`; `App.tsx` renders the board. Single screen, no router.
- **`src/app/`**: the Redux store (`store.ts`, one `board` reducer) and typed hooks (`hooks.ts`).
- **`src/features/board/`**: the UI and Redux state for the game.
  - `Board.tsx` and `components/*` (`Square`, `Piece`, `Promotion`, `Notation`, `GameOver`, `FallenPieces`, `Player`, `BoardSidebar`, …): presentation; drag-and-drop via `react-dnd`, animation via `framer-motion`.
  - `src/features/board/BoardSlice.ts`: the Redux reducer. It keeps one engine `GameState` per ply (`engineHistory`), asks the engine for legal moves and applies moves through it, and keeps the UI-only parts itself: notation, last-move highlight, fallen pieces, the promotion picker step.
  - `src/features/board/engineAdapter.ts`: the bridge between the pure engine and the UI. It turns a `GameState` into the `HistorySquares` grid the UI reads, builds engine `Move`s from UI actions, maps the picker choice to a promotion kind, and reports the checked king and game-over state.
  - `src/features/board/components/avatar.ts`: `avatarSrc(name)` maps a player's avatar file name to its imported image URL through a static map, falling back to `chess-player.png`. Add a line there when `src/game/players.ts` uses a new avatar.
- **`src/game/engine/`**: the pure rules engine, the only one the app uses. Immutable `GameState` (`game-state.ts`), `legalMoves`/`applyMove` (`engine.ts`), per-piece move generators and shared geometry (`moves/`), attack map and check (`moves/attack.ts`), checkmate/stalemate (`game-status.ts`), promotion ids (`moves/promotion.ts`). Fully unit-tested, including perft counts and a replayed recorded game.
  - `PROMOTED_IDS` in `src/game/engine/moves/promotion.ts` is the single table of promoted-piece ids (`*Promoted1..4`, at most 4 per type). `src/constants.ts` re-exports it as `PromotionBoard` for the picker.
- **`src/game/pieces/*`**: presentation only. Each piece class holds its image, weight and notation letter; no move rules and no game state. `src/game/piece-factory.ts` maps a `PieceType` to its piece object, and `src/game/piece-notation.ts` writes move notation.
- **`src/game/board-types.ts`**: the UI board types, `Square` (`{ pieceType, isEnemyAttacked }`) and `HistorySquares`.
- **`src/game/piece-type.ts`**: the `PieceType` enum, including the promoted ids. `src/game/players.ts` holds the two players' names and avatars.
- **`src/constants.ts`**: the start position, `PromotionBoard`, square sizes and the default clock time. It is imported by relative path; `constants` is not a bare-import prefix.
- **`src/assets/`**: piece SVGs and avatar PNGs.

## Stack & conventions

- **Toolchain:** Vite 8 (`vite.config.ts`) with `@vitejs/plugin-react` 6, Vitest 5, TypeScript 5.x (below 6). Node 22.12 or newer (Vitest 5 needs it); local is Node 24. React 18, Redux Toolkit 1.x, react-dnd 16 and framer-motion 7.
- **Scripts:** `dev` = `vite`, `build` = `tsc --noEmit && vite build` (Vite only transpiles; `tsc` type-checks `src/` only, not `vite.config.ts` or `tests/`), `preview` = `vite preview`, `test` = `vitest run`. Build output goes to `dist/`.
- **Base path:** `base` is `/chess-web/` in dev, build and preview. Files in `public/` are referenced as `/x`, never `%PUBLIC_URL%`.
- **Bare imports:** `app/`, `assets/`, `features/`, `game/` and `hooks/` resolve to `src/<prefix>/`. The single source is tsconfig `paths` (no `baseUrl`); Vite reads it through `resolve.tsconfigPaths`. Anything else, such as `constants`, is imported by relative path.
- **SVGs:** never inlined (`build.assetsInlineLimit` returns `false` for `.svg`), because `Piece.tsx` and `Promotion.tsx` put image URLs in an unquoted CSS `url(...)` that a `data:` URL breaks.
- **Tests:** Vitest with `environment: 'node'` (no jsdom, no component tests). Tests live in `__tests__/` folders under `src/` (they run through the app's own imports and aliases) and in the root `tests/` folder (tests that read files or run processes with Node APIs; `tsconfig` gives `src/` only `vite/client` types).
- **SVG mock:** under Vitest only, every `*.svg` import resolves to `src/__mocks__/svgMock.ts` (default export `"svg-mock"`). The production build bundles the real SVGs.
- **Known warning:** Vite 8 prints "ESM syntax in a file loaded as CommonJS (vite.config.ts)" on every run. It is harmless; it goes away when the `ci-deploy` sprint removes the CommonJS `gh-pages.js`.
- **Deploy (until `ci-deploy`):** `npm run deploy` builds (through `predeploy`), then `gh-pages.js` pushes `dist/` to the `gh-pages` branch.

## Smoke recipe

The app is a static single-page client; there is no server, database or login to stand up.

- **Install:** `npm install` (plain, no flags). Each worktree installs its own `node_modules`. A `node_modules` left from an older install (CRA era, or installed with extra flags) is stale: delete it and install again before running tests. On Windows the first install can leave a corrupt tree (for example an invalid `@rollup/rollup-win32-x64-msvc`); delete `node_modules` and install once more.
- **Dev:** `npm run dev` → `http://127.0.0.1:${PORT:-5173}/chess-web/`.
- **Production check:** `npm run build && npm run preview` → `http://127.0.0.1:${PORT:-4173}/chess-web/`. Use this to catch base-path problems (missing images, blank page).
- **Ports:** both servers bind `127.0.0.1`. Set `PORT` to a whole number from 1 to 65535 to pick the port (PowerShell: `$env:PORT=3030; npm run dev`); anything else falls back to the defaults above.
- **DB setup / login:** none.
- **What you see:** the 8×8 board in the start position, two player cards with avatars, notation and fallen pieces in the sidebar. Pieces move by drag-and-drop; a `GameOver` overlay appears on checkmate or stalemate.
- **Runtime to smoke:** load the board with no console errors and all piece images and both avatars showing; make a legal move and see it reflected; then play **castling, en passant, pawn promotion (promotion picker) and a checkmate (GameOver overlay)**; reset and play a second game to confirm state clears. Per-slice `Runtime to smoke` lines in engineer summaries name what a given slice adds.
- **Browser smoke gotchas:** pieces are not in the accessibility tree, so drags need a workaround; see `docs/known-issues/browser-smoke-drag.md`. Stopping a dev/preview server on Windows can leave it holding the port; see `docs/known-issues/windows-server-teardown.md`.
- **Verification:** `npm run build && npm test`. Both must pass.

## CI

None. The `ci-deploy` sprint adds a GitHub Actions workflow (typecheck, test and build on PRs; deploy to Pages on push to `main`).
