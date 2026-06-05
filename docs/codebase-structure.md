# Codebase structure

A client-side chess web app — Create React App (`react-scripts` 5) + TypeScript + Redux Toolkit, deployed to GitHub Pages. No backend, no database, no auth; all state is in the browser (Redux store).

## Layout

- **`src/index.tsx` → `src/App.tsx`** — entry; renders the board. Single screen, no router.
- **`src/features/board/`** — the UI and Redux state for the game.
  - `Board.tsx`, `components/*` (`Square`, `Piece`, `Promotion`, `Notation`, `GameOver`, `FallenPieces`, …) — presentation; drag-and-drop via `react-dnd`.
  - **`BoardSlice.ts`** — the Redux reducer that holds game state and calls the rules engine. This is the seam the `cutover-cleanup` sprint flips from the legacy engine to the new pure engine.
- **`src/game/pieces/*` + `src/game/piece-moves.ts`** — the **legacy** rules engine: module-level mutable singletons (`whiteKing`, `pieceMoves`, a promotion counter) that leak state across games. Being strangled out; still wired to the live app until cutover.
- **`src/game/engine/`** — the **new pure engine** (built test-first over sprints engine-foundation → external-anchors): immutable `GameState` (`game-state.ts`), `legalMoves`/`applyMove` (`engine.ts`), per-piece pseudo-legal generators + shared geometry (`moves/`), attack mapping + check (`moves/attack.ts`), game-end detection (`game-status.ts`), promotion-id allocator (`moves/promotion.ts`). Pure functions, fully unit-tested (incl. perft anchors); **not yet wired into `BoardSlice`** until `cutover-cleanup`.
- **`src/game/piece-type.ts`, `piece-factory.ts`, `constants.ts`** — `PieceType` enum (incl. the quarantined `*Promoted1..4` ids), factory, and shared constants (`PromotionBoard`).

## Smoke recipe

The app is a static single-page client; there is no server/DB/login to stand up.

- **Install:** `npm install --legacy-peer-deps` (plain `npm install` is blocked by the `@types/node@^16` vs `vitest` peer conflict; the actual Node runtime is unaffected). If the first install yields a corrupt tree on Windows (npm optional-dep bug — `@rollup/rollup-win32-x64-msvc` invalid / missing `std-env`), delete `node_modules` and reinstall once.
- **Start command:** `npm start` (`react-scripts start`) — dev server on **http://localhost:3000**.
- **DB setup:** none.
- **Login credentials:** none.
- **Key URLs:** `http://localhost:3000` — the chess board renders immediately (8×8 with both armies in the start position); pieces are moved by drag-and-drop; the sidebar shows notation and fallen pieces; a `GameOver` overlay appears on checkmate/stalemate.
- **Runtime to smoke:** load the board with no console errors; make a legal move and see it reflected; then exercise the rules the engine cutover must preserve — **castle, en passant, pawn promotion (promotion picker), and deliver checkmate (GameOver overlay)** — and confirm `reset`/new game clears state across two consecutive games. (Per-slice `Runtime to smoke` lines in each engineer summary name the specific behaviors a given sprint introduces; the cutover sprint's is the full-game playthrough above.)
- **Verification (headless):** `npm test` (`vitest run`) for the engine unit + perft + recorded-game suites, and `npm run build` (`react-scripts build`) for a clean production compile. Both must pass before any cutover is considered green.
