# Sprint: Vite switch

_From plan: docs/plans/vite-migration.md · Slug: vite-switch · Status: active · Generated: 2026-10-04_

<!-- autopilot-run: started=2026-10-04T06:58:18Z sprints=0 waves=2 -->

## Status board

| Wave | Slice | Title | Branch | PR | Status | Confidence | Depends on |
|------|-------|-------|--------|----|--------|------------|------------|
| 1 | A1 | Replace the `require()` avatar lookup with a static, tested map | vite-switch-A1 | #33 | merged | high | — |
| 2 | V1 | Swap CRA for Vite 8 + Vitest 5 in one `vite.config.ts`; plain `npm install` | vite-switch-V1 | — | in-progress | — | A1 |
| 3 | D1 | Update `docs/codebase-structure.md` (+ decisions entry) for Vite and the post-cutover engine | vite-switch-D1 | — | pending | — | V1 |

Plan branch: `vite-migration`. Wave heads: `vite-switch-w1`, `vite-switch-w2`, `vite-switch-w3`.

Why it runs in order: `package.json` and `package-lock.json` change in one slice (V1), so the toolchain can't be split across parallel slices. A1 goes first because `Player.tsx` calls `require(\`assets/${avatar}\`)`. That is a webpack-only call: under Vite it fails in the browser, and it may break the build that V1's tests run. D1 writes down what V1 shipped.

## Shared contract

**Toolchain after this sprint** (V1 owns it, D1 documents it, and the later `ci-deploy` sprint builds on it):
- Node `>=22.12` (local is v24.16.0). Packages: `vite` 8, `@vitejs/plugin-react` 6, `vitest` 5, `typescript` latest 5.x (the range must stay below 6), `@types/node` `^24`. React 18, Redux Toolkit 1.x, react-dnd 16 and framer-motion 7 stay as they are.
- Removed from `package.json`: `react-scripts`, `@types/jest`, `@testing-library/jest-dom`, `eslintConfig`, `browserslist`, and the `eject` and `start` scripts. Removed files: `vitest.config.ts`, `public/index.html`, `src/react-app-env.d.ts`.
- `gh-pages` and `gh-pages.js` **stay** until `ci-deploy`. `gh-pages.js` publishes `dist` instead of `build`, so the old manual deploy path still works between sprints. Nobody runs `npm run deploy` in this sprint.
- Scripts: `dev` = `vite`, `build` = `tsc --noEmit && vite build`, `preview` = `vite preview`, `test` = `vitest run`. `deploy` and `predeploy` stay unchanged.
- Build output goes to `dist/`. `.gitignore` ignores `/dist`.
- `tsc --noEmit` checks `src/` only, as today. `vite.config.ts` and the root `tests/` folder are not type-checked by it.

**Rule: bare imports.** The prefixes `app/`, `assets/`, `features/`, `game/` and `hooks/` resolve to `src/<prefix>/` the same way in `tsc`, `vite dev`, `vite build` and Vitest. One source drives this: tsconfig `paths`, with no `baseUrl`. Vite reads it through `resolve.tsconfigPaths`, or through `vite-tsconfig-paths` if the built-in option falls short. No import line in `src/` changes because of this. Edges:
- Any other bare specifier (for example `constants`) is **not** an alias. `src/constants.ts` keeps being imported by relative path.
- Under Vitest only, any `*.svg` import resolves to `src/__mocks__/svgMock.ts` (default export `"svg-mock"`). This takes priority over `assets/*`.
- A production build never contains the SVG mock. It bundles the real SVGs.
- Tests pass when run from a worktree under `<repo>/.claude/worktrees/` (a dot-directory path on Windows).

**Rule: base path.** `base` is `'/chess-web/'`. Dev, build and preview all serve the app under `/chess-web/`. In the built `dist/index.html`, every script, stylesheet and `public/` file URL (`chess-icon.png`, `logo192.png`, `manifest.json`) starts with `/chess-web/`. Edge: `%PUBLIC_URL%` appears nowhere, and root `index.html` loads `/src/index.tsx` as `type="module"`.

**Rule: ports.** Both `server` and `preview` bind host `127.0.0.1`. The port comes from env `PORT` when that is a whole number from 1 to 65535. Otherwise (unset, empty, `abc`, `0`, `70000`) the default applies: dev `5173`, preview `4173`. The env is read when the config loads, so each run picks it up fresh.

**Rule: avatar lookup** (A1). `avatarSrc(name: string | null): string` lives in `src/features/board/components/avatar.ts`. For `null` or `""` it returns the default image (`chess-player.png`). For a known file name it returns that image's imported URL. For an unknown name it returns the default, without throwing. Every `avatar` value in `src/game/players.ts` is a known name. There is no `require()` anywhere in `src/`.

**Rule: install.** Plain `npm install` succeeds with no flags. No `.npmrc` sets `legacy-peer-deps`. After a clean install, `npm ls --all` exits 0, which means no invalid, missing or extraneous packages. Edge: a `node_modules` left from an older install (CRA, `--legacy-peer-deps`) is stale and must be deleted and reinstalled before tests run. The known Windows retry still applies: if the first install leaves a corrupt tree (for example an invalid `@rollup/rollup-win32-x64-msvc`), delete `node_modules` and install once more.

**Smoke recipe values** (D1 writes them into the docs):
- Install: `npm install`.
- Dev: `npm run dev` → `http://127.0.0.1:${PORT:-5173}/chess-web/`.
- Production check: `npm run build && npm run preview` → `http://127.0.0.1:${PORT:-4173}/chess-web/`.
- `Verification:` `npm run build && npm test`.

**Queue entries this sprint resolves** (the orchestrator marks them at archive, once V1 lands):
- The 2026-06-04 `@types/node` / `--legacy-peer-deps` PENDING.
- The 2026-06-04 per-worktree `npm install --legacy-peer-deps` PENDING. Worktrees still install per worktree, now with a plain `npm install`.
- The 2026-06-04 "`vitest.config.ts` does not resolve the tsconfig `baseUrl` aliases" PENDING, and the cutover's `vitest.config.ts` alias PENDING.

## Per-slice detail

### A1: Replace the `require()` avatar lookup with a static, tested map
- **Scope:** Add `avatarSrc` as the contract's **avatar lookup** rule describes. It uses a static map of imported images, built from plain `import` statements. Do not use `require` or `import.meta.glob`: the map has to work under both CRA (before V1) and Vite (after V1). Inside `avatar.ts`, import the PNGs by **relative** path (`../../../assets/...`). The current `vitest.config.ts` doesn't map `assets/`, and V1 handles both forms. `Player.tsx` calls `avatarSrc(avatar)` instead of `require`. Change nothing else in `Player.tsx`, and don't touch `players.ts`. No visible change.
- **Files owned:** `src/features/board/components/avatar.ts` (new), `src/features/board/components/Player.tsx`, `src/features/board/__tests__/avatar.test.ts` (new), `tests/no-require.test.ts` (new)
- **Note:** after V1, tsconfig has `types: ["vite/client"]`, so `tsc` can't see Node module types in `src/`. Tests that use `node:fs` go in the root `tests/` folder, never under `src/`.
- **Success criteria:**
  - `[test] null returns the default avatar — src/features/board/__tests__/avatar.test.ts › returns the default avatar for null`
  - `[test] empty string returns the default avatar — src/features/board/__tests__/avatar.test.ts › returns the default avatar for an empty name`
  - `[test] a known name returns its own image, not the default — src/features/board/__tests__/avatar.test.ts › returns the matching image for a known avatar name`
  - `[test] an unknown name returns the default and does not throw — src/features/board/__tests__/avatar.test.ts › falls back to the default for an unknown avatar name`
  - `[test] every avatar in players.ts resolves to a non-default image — src/features/board/__tests__/avatar.test.ts › every configured player avatar is registered`
  - `[test] no require() call remains in src/ non-test .ts/.tsx files — tests/no-require.test.ts › src contains no require calls`
- **Depends on:** —
- **One-way door:** none

### V1: Swap CRA for Vite 8 + Vitest 5 in one `vite.config.ts`
- **Scope:** Build the whole **Toolchain after this sprint** block of the contract, and the bare-import, base-path, ports and install rules.
  - New `vite.config.ts` with plugin-react, `base`, `server`/`preview` host and port, tsconfig-paths resolution, and a `test` block (`environment: 'node'`, plus the test-only SVG mock).
  - Move `public/index.html` to the root `index.html`. Replace `%PUBLIC_URL%/x` with `/x` and add the module script.
  - tsconfig: remove `baseUrl`. Add `paths` for the five prefixes, `moduleResolution: "bundler"` and `types: ["vite/client"]`. Raise `target` only if needed.
  - Prove plain `npm install` on a **fresh** `node_modules` in your worktree. If a peer conflict is left, find the package causing it and fix that. Don't add flags or an `.npmrc`.
  - Don't change any `src/` file except deleting `src/react-app-env.d.ts`. Its job moves to `types: ["vite/client"]`.
  - Don't add CI, ESLint or `plugin-legacy`. Don't upgrade React, Redux Toolkit, react-dnd or framer-motion.
  - Watch the Vite 8 CommonJS default-import change on any CJS-only dependency.
  - Tests that read files or run processes go in the root `tests/` folder (Node APIs). The alias test goes under `src/` so it runs through the app's own import graph.
- **Files owned:** `package.json`, `package-lock.json`, `vite.config.ts` (new), `vitest.config.ts` (delete), `index.html` (new), `public/index.html` (delete), `tsconfig.json`, `src/react-app-env.d.ts` (delete), `.gitignore`, `gh-pages.js`, `src/__tests__/aliases.test.ts` (new), `tests/toolchain.test.ts` (new), `tests/vite-config.test.ts` (new), `tests/build.test.ts` (new)
- **Success criteria:**
  - `[test] game/, app/, features/, hooks/ bare imports resolve under Vitest (import a real export from each) — src/__tests__/aliases.test.ts › resolves every bare import prefix`
  - `[test] an assets/*.svg import resolves to the "svg-mock" stub under Vitest — src/__tests__/aliases.test.ts › svg imports use the test mock`
  - `[test] package.json has none of the removed packages/keys/scripts; scripts dev/build/preview/test match the contract — tests/toolchain.test.ts › package.json matches the vite toolchain`
  - `[test] typescript range is major 5, @types/node range is ^24, vite major 8, plugin-react major 6, vitest major 5 — tests/toolchain.test.ts › dependency ranges match the plan`
  - `[test] vitest.config.ts, public/index.html, src/react-app-env.d.ts are gone — tests/toolchain.test.ts › CRA-era files are removed`
  - `[test] tsconfig has no baseUrl, has paths for exactly the five prefixes, moduleResolution bundler, types ["vite/client"] — tests/toolchain.test.ts › tsconfig uses explicit paths`
  - `[test] root index.html has no %PUBLIC_URL% and loads /src/index.tsx as a module — tests/toolchain.test.ts › root index.html is the vite entry`
  - `[test] .gitignore lists /dist; gh-pages.js publishes "dist" — tests/toolchain.test.ts › build output is dist`
  - `[test] no .npmrc sets legacy-peer-deps, and npm ls --all exits 0 — tests/toolchain.test.ts › dependency tree is clean without legacy peer deps`
  - `[test] loaded config has base "/chess-web/" and server/preview host 127.0.0.1 — tests/vite-config.test.ts › serves under /chess-web/ on 127.0.0.1`
  - `[test] PORT unset → dev 5173 / preview 4173 — tests/vite-config.test.ts › uses default ports when PORT is unset`
  - `[test] PORT=6123 → both use 6123 — tests/vite-config.test.ts › uses PORT when it is a valid port`
  - `[test] PORT "", "abc", "0", "70000" → defaults — tests/vite-config.test.ts › ignores an invalid PORT`
  - `[test] a production build into a temp dir succeeds; every script/link URL in its index.html starts with /chess-web/ (incl. chess-icon.png and manifest.json) — tests/build.test.ts › production build uses the /chess-web/ base`
  - `[test] built JS contains no "svg-mock" string — tests/build.test.ts › production build bundles real svgs, not the test mock`
  - `[test] all pre-existing suites (engine, perft, recorded game, board-slice, notation, avatar) still pass under the merged config — npm test (vitest run) › full suite green`
  - `[manual] Runtime smoke on the production build: npm run build && npm run preview → http://127.0.0.1:4173/chess-web/. No console errors, and all 32 piece images and both avatars load. Drag-and-drop moves work and framer-motion animates. Play castle, en passant, promotion (picker) and checkmate (GameOver overlay), then reset and play a second game. Check \`npm run dev\` loads the board too. (react-dnd drag gestures under the Vite bundle can't be driven from a node test.)`
- **Depends on:** A1
- **One-way door:** none. Every change is in the repo and undone with `git revert`. The `gh-pages.js` edit is not run.

### D1: Update `docs/codebase-structure.md` for Vite and the post-cutover engine
- **Scope:** Rewrite `docs/codebase-structure.md` to match the code as it is now:
  - The intro says Vite, not CRA.
  - **Layout:** the live app runs on the pure engine through `src/features/board/engineAdapter.ts`. the legacy singleton engine is gone (don't name its deleted file). `game/pieces/*` keep only presentation getters. `src/game/board-types.ts` holds `Square`/`HistorySquares`. The engine's `PROMOTED_IDS` is the single promotion-id table. Mention `avatar.ts`. Read the code to confirm each of these; don't rely on old docs.
  - Add **`## Stack & conventions`**: the Vite, Vitest and TS versions from the contract; tests live in `__tests__/` under `src/` and in the root `tests/` folder; Vitest runs with `environment: 'node'`; the bare-import prefixes come from tsconfig `paths`; the SVG mock applies only under Vitest.
  - Rewrite **`## Smoke recipe`** with the contract's values, keeping the runtime-to-smoke playthrough. Drop `--legacy-peer-deps`, and note the stale-`node_modules` and Windows retry edges.
  - Add **`## CI`**: `none`. The `ci-deploy` sprint adds it.
  - Append a `docs/decisions.md` entry: "Vite + Vitest replace CRA". It supersedes the "CRA stays for the app build" part of the 2026-06-04 Vitest decision and points to the plan's Key decisions. Don't edit the old entries.
- **Files owned:** `docs/codebase-structure.md`, `docs/decisions.md`, `tests/docs.test.ts` (new)
- **Success criteria:**
  - `[test] codebase-structure.md has no "react-scripts", "--legacy-peer-deps", "localhost", "not yet wired", or "piece-moves.ts" text — tests/docs.test.ts › codebase-structure has no stale CRA or pre-cutover text`
  - `[test] it has "## Stack & conventions", "## Smoke recipe" and "## CI" headings — tests/docs.test.ts › codebase-structure has the required sections`
  - `[test] the Smoke recipe has an install step "npm install", URLs on 127.0.0.1 under /chess-web/, a PORT mention, and a "Verification:" line — tests/docs.test.ts › smoke recipe matches the vite commands`
  - `[test] every "npm run <name>" and "npm test" the recipe mentions exists in package.json scripts — tests/docs.test.ts › smoke recipe only names real scripts`
  - `[test] every backticked src/ path in the Layout section exists on disk (a path ending in /* or / is checked as a directory) — tests/docs.test.ts › layout paths exist`
  - `[test] decisions.md has an entry heading mentioning Vite — tests/docs.test.ts › decisions records the vite switch`
- **Depends on:** V1
- **One-way door:** none
