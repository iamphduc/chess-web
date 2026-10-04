# Plan: Move from Create React App to Vite

_Generated: 2026-10-03 · Status: active · Grilled-with: pod (fast)_

<!-- autopilot-run: started=2026-10-04T06:58:18Z sprints=1 waves=3 -->

## Goal
Replace Create React App (`react-scripts`) with Vite, and build, test and deploy the site from GitHub Actions instead of a local `gh-pages` script. The app must look and play exactly as it does today.

## Why
CRA is no longer maintained ([Sunsetting Create React App](https://react.dev/blog/2025/02/14/sunsetting-create-react-app)). It also forces `npm install --legacy-peer-deps`, and it keeps the tests (Vitest) and the build on two separate setups. This is item 1 on `docs/roadmap.md`. It has to land before PartyKit online play (item 2), which needs a working CI and deploy pipeline.

**Success criteria for the whole plan:**
- `react-scripts` is gone. `npm run dev`, `npm run build`, `npm run preview` and `npm test` all run on Vite and Vitest from one `vite.config.ts`.
- A plain `npm install` works, with no `--legacy-peer-deps`.
- Every PR runs typecheck, tests and build in GitHub Actions. A push to `main` deploys to GitHub Pages at `https://iamphduc.github.io/chess-web/`.
- The deployed site passes the full smoke playthrough: castle, en passant, promotion, checkmate, and reset across two games. No console errors, and every piece image loads.

## Scope
**In scope:**
- Vite 8 + `@vitejs/plugin-react` 6. Move `index.html` to the repo root and replace `%PUBLIC_URL%`.
- Fold `vitest.config.ts` into `vite.config.ts`, keeping the SVG mock for tests.
- tsconfig: swap `baseUrl: ./src` for explicit `paths` (`app/*`, `assets/*`, `features/*`, `game/*`, `hooks/*`), so import strings stay the same. Add Vite's recommended settings (`moduleResolution: bundler`, `types: ["vite/client"]`).
- Bump `@types/node` to `^24` and TypeScript to the latest 5.x. Remove CRA-only packages (`react-scripts`, `@types/jest`, `@testing-library/jest-dom`, `eslintConfig`, `browserslist`).
- GitHub Actions: a PR check job (typecheck, test, build) and a deploy job on push to `main`, using the official Pages actions. Remove `gh-pages.js` and the `gh-pages` package.
- Update `docs/codebase-structure.md`. It still describes CRA and the pre-cutover engine, and its smoke recipe needs the new commands.

**Out of scope:**
- React 19, Redux Toolkit 2, react-dnd, and framer-motion → motion upgrades.
- TypeScript 6/7. The `paths` switch above removes the `baseUrl` blocker, so this becomes a separate small upgrade later.
- Any UI or gameplay change, and a linter setup to replace CRA's ESLint (a later chore).
- Roadmap items 2+ (PartyKit, AI opponent, …). Each gets its own plan.

## Sprint sequence

| Sprint | Goal | Status | Depends on |
|--------|------|--------|------------|
| vite-switch | App runs, tests and builds on Vite 8 + Vitest 5 locally, with the same behavior. CRA is removed, plain `npm install` works, and docs are updated. | done | — |
| ci-deploy | GitHub Actions runs PR checks and deploys `main` to GitHub Pages. The local `gh-pages` script is removed and the live site passes the smoke playthrough. | planned | vite-switch |

## Look
none — no UI change. The app must render exactly as it does today.

## Key decisions
- **Research first:** `docs/research/cra-to-vite.md` (2026-10-03). The choices below come from it.
- **Deploy with GitHub Actions + official Pages actions**, not by pushing a `gh-pages` branch. PRs get typecheck/test/build checks; deploy runs only on push to `main` (human choice).
- **Upgrade only what the move needs.** React 18, Redux Toolkit 1.x, react-dnd 16 and framer-motion 7 stay (human choice).
- **Vite 8 + plugin-react 6 + Vitest 5 on Node 24** — plugin-react 6 needs Vite 8, and Vitest 5 needs Node 22.12+. Node 24 matches the local machine (v24.16.0). CI pins Node 24 too. (default)
- **`@types/node` → `^24`** to match Vitest 5's peer range and end `--legacy-peer-deps`. The research marks this as untested, so the vite-switch sprint must prove it with a clean install. (default)
- **Keep bare imports by switching `baseUrl` to explicit `paths`.** No import lines change, it works with Vite (built-in `resolve.tsconfigPaths`, or `vite-tsconfig-paths` if the built-in one falls short), and it clears the way for TS 6, which deprecates `baseUrl`. (default)
- **Stay on TypeScript 5.x** for this plan. TS 6/7 is out of scope. (default)
- **`base: '/chess-web/'`**, the documented choice for a GitHub Pages project site. There is no custom domain. (default)
- **Accept Vite's default browser target** (Chrome/Edge 111+, Firefox 114+, Safari 16.4+) instead of keeping CRA's `browserslist`. No `plugin-legacy`. (default)
- **Type-check outside Vite**: `"build": "tsc --noEmit && vite build"`, and CI runs it. Vite only transpiles. (default)
- **Build output goes to `dist/`** (Vite default), replacing CRA's `build/`. Update `.gitignore`. (default)

## Known risks
- **Base-path breakage** (missing images or a blank page under `/chess-web/`): smoke-test with `npm run preview`, which serves the base path, before deploy, and again on the live site.
- **react-dnd / framer-motion under Vite** — no known problems, but that evidence is weak: test drag-and-drop and animations in the production build, not just dev.
- **`@types/node` bump might not fully remove the peer conflict**: if not, find the remaining conflict instead of keeping `--legacy-peer-deps`.
- **Vite 8 CommonJS default-import change**: watch any CJS-only dependency at build time.
- **Pages switch needs a human step**: in repo Settings → Pages, set Source to "GitHub Actions" before the first deploy. Until then the old `gh-pages` branch keeps serving.
- **Branch protection**: decide whether the new CI check becomes a required status check on `main`.

## Open questions
- Delete the old `gh-pages` branch after the first successful Actions deploy? (Human call. Default: keep it until the live smoke passes, then delete.)
- Open handoff items this plan may close: the `@types/node` peer conflict, the per-worktree `npm install --legacy-peer-deps` step, and the alias-under-Vitest note. The sprint-planner should resolve them in `docs/handoff-queue.md` when they land.

## Verification
- `package.json` has no `react-scripts`, `gh-pages`, `@types/jest`, `eslintConfig` or `browserslist`. There is no `vitest.config.ts` or `gh-pages.js`.
- On a clean clone: `npm install && npm run build && npm test` all pass with no extra flags.
- `tsconfig.json` has no `baseUrl`, and no import line in `src/` changed for the alias switch.
- `.github/workflows/` runs typecheck, test and build on `pull_request`, and deploys with `actions/deploy-pages` on push to `main`.
- `https://iamphduc.github.io/chess-web/` serves the Vite build and passes the full smoke playthrough with no console errors.
- `docs/codebase-structure.md` describes Vite, the post-cutover engine, and the new smoke recipe.
