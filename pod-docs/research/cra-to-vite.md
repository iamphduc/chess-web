# Research: Migrating CRA (react-scripts 5) + TS + Vitest app to Vite, deployed via GitHub Actions to GitHub Pages

_Generated: 2026-10-03 · Depth: standard · Searches: 4 · Pages read: 24_

**Assumptions:** Repo is a project site (`https://<user>.github.io/<repo>/`). Node version in CI and locally is not known. `homepage: "."` means the current build uses relative paths. "Latest versions" are what the npm registry and Vite docs returned today (2026-10-03).

## What exists
This is a technical question, so the table lists approaches and tools.

| Name | Link | What it does | Alive? (latest seen) | License | How close to the idea |
|------|------|--------------|----------------------|---------|-----------------------|
| Vite 8 | [docs](https://vite.dev/guide/) | Dev server and bundler. Uses Rolldown and Oxc instead of esbuild and Rollup. Needs Node `^20.19.0 \|\| >=22.12.0`. | 8.3.2 on npm | no evidence found | The target tool |
| @vitejs/plugin-react | [npm](https://registry.npmjs.org/@vitejs/plugin-react/latest) | Fast Refresh and automatic JSX. | 6.1.1, peer `vite ^8.0.0` | no evidence found | Needed. 6.x only works with Vite 8. |
| Vitest | [npm](https://registry.npmjs.org/vitest/latest) | Test runner that reads `vite.config.*`. | 5.0.3, Node `^22.12 \|\| ^24 \|\| >=26`, Vite `^6.4 \|\| ^7 \|\| ^8`, optional peer `@types/node ^22 \|\| >=24` | no evidence found | Already used by the project |
| resolve.tsconfigPaths (built in) | [docs](https://vite.dev/config/shared-options.html) | Vite option that reads tsconfig `paths`. | Documented in v8.3.1 docs | MIT (Vite) | Covers `paths`. Not confirmed to cover `baseUrl` bare imports. |
| vite-tsconfig-paths | [repo](https://github.com/aleclarson/vite-tsconfig-paths) | Plugin that maps tsconfig `paths` and `baseUrl`. | 1.6k stars, "New in v7" | MIT | Documents `baseUrl` bare imports. |
| resolve.alias | [docs](https://vite.dev/config/shared-options.html) | Manual alias map. | Built in | MIT | Works, but you list each top-level folder by hand. |
| Official Pages workflow | [docs](https://vite.dev/guide/static-deploy.html) | `configure-pages`, `upload-pages-artifact`, `deploy-pages`. | Docs list checkout v7, setup-node v7, configure-pages v6, upload-pages-artifact v5, deploy-pages v5 | no evidence found | Matches the chosen deploy path |
| gh-pages branch push (current `gh-pages` script) | none fetched | Pushes the build to a branch. | no evidence found | no evidence found | Being replaced |

## Gaps and angles
- **Version trap.** Current Vite is 8, and plugin-react 6.1.1 needs `vite ^8`. Vitest 5.0.3 needs Node 22.12 or newer, while Vite 8 accepts Node 20.19. A Node 20 setup can run Vite 8 but not Vitest 5. — [vitest](https://registry.npmjs.org/vitest/latest), [vite](https://registry.npmjs.org/vite/latest), [plugin-react](https://registry.npmjs.org/@vitejs/plugin-react/latest)
- **The `@types/node@^16` conflict.** Vitest 5's optional peer is `@types/node ^22 || >=24`, so `^16` clashes. Bumping `@types/node` to 22 or 24 (matching your Node) should remove the need for `--legacy-peer-deps`. This is my inference from the peer ranges, not tested. — [vitest](https://registry.npmjs.org/vitest/latest)
- **TypeScript has moved on.** Latest TS is 7.0.2. TS 6.0 deprecates `baseUrl` as a lookup root, and the replacement is explicit `paths` like `"@app/*": ["./src/app/*"]`. TS 6.0 also makes `types` default to `[]`, and deprecates `moduleResolution: node`. Bare imports like `game/...` rely on exactly this deprecated `baseUrl` behavior. TS 5.x (your choice) still works, but this is a later cost. — [TS 6.0 post](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/), [npm](https://registry.npmjs.org/typescript/latest)
- **CRA's `browserslist` has no equivalent.** The Vite build docs say the default target is "Baseline Widely Available" (Chrome >=111, Edge >=111, Firefox >=114, Safari >=16.4) and do not mention `browserslist`. Set `build.target` if you need older browsers, or use `@vitejs/plugin-legacy`. — [build docs](https://vite.dev/guide/build.html)
- **SVG as URL needs no plugin.** Importing an asset returns a hashed URL. One guide says SVG needs `vite-plugin-svgr`, but that only matters if you import SVGs as React components, which you don't. — [assets](https://vite.dev/guide/assets.html), [guide](https://oneuptime.com/blog/post/2026-01-15-migrate-create-react-app-to-vite/view)
- **react-dnd looks safe.** The 16.0.1 package is ESM (`"type": "module"`) and `useDrag` source has no `process` reference. I found no Vite-specific react-dnd issue. The old `process/browser` error I found was a webpack error. That is not proof it works on Vite, so test drag and drop in the production build. — [react-dnd npm](https://registry.npmjs.org/react-dnd/latest), [source](https://github.com/react-dnd/react-dnd/blob/main/packages/react-dnd/src/hooks/useDrag/useDrag.ts)
- **framer-motion 7.10.3 looks safe.** It ships an ESM build (`dist/es/index.mjs`), is `sideEffects: false`, and needs React 18. I found no evidence of Vite problems with v7. — [npm](https://registry.npmjs.org/framer-motion/7.10.3)
- **Vite 8 CommonJS change.** `default` imports from CJS modules now behave the same in dev and build, which can break code that relied on the old guess. Watch any CJS-only dependency. — [migration](https://vite.dev/guide/migration.html)

## Best practices
- **Move `index.html` to the project root.** Add `<script type="module" src="/src/index.tsx">`, and replace `%PUBLIC_URL%` references. Assets in `public/` are served from the root and copied unchanged. Missing `%PUBLIC_URL%` replacements cause asset load failures. — [assets](https://vite.dev/guide/assets.html), [guide](https://oneuptime.com/blog/post/2026-01-15-migrate-create-react-app-to-vite/view)
- **Use `base: '/<REPO>/'` for a project site.** A relative base (`'./'` or `''`) is also allowed, but needs `import.meta` support. Your current `homepage: "."` is the relative style, so `'./'` keeps behavior the same. `'/<REPO>/'` is the documented choice. — [static deploy](https://vite.dev/guide/static-deploy.html), [build](https://vite.dev/guide/build.html)
- **Use the official Pages workflow, not a gh-pages branch.** Set repo Settings > Pages > Source to "GitHub Actions". The job needs `permissions: pages: write` and `id-token: write`, and `environment: github-pages`. The Vite sample builds, uploads `dist`, and deploys on push to `main`. — [static deploy](https://vite.dev/guide/static-deploy.html), [deploy-pages](https://github.com/actions/deploy-pages)
- **Split CI into two jobs.** Run test and build on pull requests. Run the deploy job only on push to `main`. That is my layout; the Vite sample only shows the push-to-main deploy.
- **Rename env vars.** Only `VITE_*` variables reach client code, read through `import.meta.env`. Do not put secrets in them. Add a `vite-env.d.ts` to type custom variables. — [env docs](https://vite.dev/guide/env-and-mode.html)
- **TS settings.** Vite recommends `isolatedModules: true`, `types: ["vite/client"]`, and `useDefineForClassFields` matching your target. Its React template uses `moduleResolution: "bundler"`, `module: "esnext"`, `jsx: "react-jsx"`, `noEmit: true`. — [features](https://vite.dev/guide/features.html), [template tsconfig](https://github.com/vitejs/vite/blob/main/packages/create-vite/template-react-ts/tsconfig.app.json)
- **Keep type-checking, as a separate step.** Vite only transpiles, so run `tsc --noEmit` (for example `"build": "tsc --noEmit && vite build"`). `vite-plugin-checker` is an option for in-browser errors. — [features](https://vite.dev/guide/features.html)
- **Merge Vitest config into `vite.config.ts`.** Vitest reads `vite.config.*` by default. If you keep two files, use `mergeConfig` from `vitest/config`. One file means one set of aliases. — [vitest](https://vitest.dev/guide/)
- **Set Node in CI explicitly.** The Vite sample uses `lts/*`. With Vitest 5, use Node 22 or newer. — [static deploy](https://vite.dev/guide/static-deploy.html)

## Ideas to consider
- **Minimal:** Vite 8 + plugin-react 6, `resolve.alias` for your few top-level folders, `index.html` at root, `VITE_` rename, and `.github/workflows` for test/build/deploy. Grows from the migration steps above.
- **Use `resolve.tsconfigPaths: true`.** It removes the plugin dependency, but first confirm it handles `baseUrl` bare imports. Grows from the shared-options docs.
- **Use `vite-tsconfig-paths` if the built-in option ignores `baseUrl`.** It documents `baseUrl` support. Grows from the plugin README.
- **Stay on Vite 7 and Vitest 4-ish if CI must stay on Node 20.** I did not fetch Vite 7 or Vitest 4 pages, so check their engines before choosing. (own idea)
- **Move off `baseUrl` now.** Rewrite imports to `paths` with `./src/...` prefixes, so the later TS 6 upgrade is clean. Grows from the TS 6.0 post.
- **Add a CI smoke test of the built site.** Run `vite preview` with the `/<REPO>/` base and check that pieces and SVGs load, to catch base-path errors before deploy. (own idea)
- **Bold:** Add `@vitejs/plugin-legacy` or a lower `build.target` if you must match the old CRA `browserslist`. Grows from the build docs.

## Questions for the plan
- Which Node version will CI and your machine use? — why it matters: Vitest 5 needs 22.12+, Vite 8 allows 20.19+. — options: Node 22/24 with Vite 8 + Vitest 5 / Node 20 with older Vite and Vitest
- Does `resolve.tsconfigPaths` handle your `baseUrl: ./src` bare imports? — why it matters: docs only mention `paths`, while the plugin README explicitly documents `baseUrl`. — options: built-in option / vite-tsconfig-paths / hand-written aliases / convert to `paths`
- `base` as `'/<REPO>/'` or `'./'`? — why it matters: `'/<REPO>/'` is the documented choice, and `'./'` mirrors `homepage: "."` but needs `import.meta` support. — options: `'/<REPO>/'` / `'./'`
- Which browsers must the app support? — why it matters: CRA's `browserslist` is gone and the default target is Chrome 111, Safari 16.4 or newer. — options: accept the default / set `build.target` / add plugin-legacy
- Pin TypeScript 5.x, and for how long? — why it matters: latest is 7.0.2, TS 6 deprecates `baseUrl`, and your imports depend on it. — options: stay on 5.x and plan the import rewrite / go to 6 now
- Which `@types/node` to use? — why it matters: `^16` conflicts with Vitest 5's peer range. — options: match CI Node major (22 or 24)
- Keep `tsc --noEmit` in build and CI? — why it matters: Vite does not type-check. — options: in the `build` script / separate CI step / `vite-plugin-checker`
- Do you want a custom domain or any env vars set in CI? — why it matters: a custom domain would make `base: '/'` correct, and env vars must be `VITE_`-prefixed and present at build time. — options: github.io project path / custom domain

no evidence found: a documented Vite-specific problem with react-dnd 16 or framer-motion 7; whether `resolve.tsconfigPaths` supports `baseUrl`; `build.outDir` default (the sample workflow uploads `dist`, CRA used `build`); Vite 7 and Vitest 4 engine ranges; licenses for Vite, Vitest and plugin-react (not fetched).

## Sources
- Vite: Deploying a Static Site — https://vite.dev/guide/static-deploy.html — current docs (v8.3.x)
- Vite 8 Migration Guide — https://vite.dev/guide/migration.html — current
- Vite shared options — https://vite.dev/config/shared-options.html — current
- Vite env and modes — https://vite.dev/guide/env-and-mode.html — current
- Vite: Getting Started — https://vite.dev/guide/ — current
- Vite features (TypeScript) — https://vite.dev/guide/features.html — current
- Vite static assets — https://vite.dev/guide/assets.html — current
- Vite building for production — https://vite.dev/guide/build.html — current
- Vitest guide — https://vitest.dev/guide/ — current (v5.0.3)
- @vitejs/plugin-react README — https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md — current
- plugin-react on npm registry — https://registry.npmjs.org/@vitejs/plugin-react/latest — 2026-10-03
- vite on npm registry — https://registry.npmjs.org/vite/latest — 2026-10-03
- vitest on npm registry — https://registry.npmjs.org/vitest/latest — 2026-10-03
- typescript on npm registry — https://registry.npmjs.org/typescript/latest — 2026-10-03
- Vite react-ts template tsconfig — https://github.com/vitejs/vite/blob/main/packages/create-vite/template-react-ts/tsconfig.app.json — current
- Announcing TypeScript 6.0 — https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/ — 2026
- vite-tsconfig-paths — https://github.com/aleclarson/vite-tsconfig-paths — current
- react-dnd on npm registry — https://registry.npmjs.org/react-dnd/latest — 2026-10-03
- react-dnd useDrag source — https://github.com/react-dnd/react-dnd/blob/main/packages/react-dnd/src/hooks/useDrag/useDrag.ts — current
- framer-motion 7.10.3 on npm registry — https://registry.npmjs.org/framer-motion/7.10.3 — 2026-10-03
- actions/deploy-pages — https://github.com/actions/deploy-pages — current
- Sunsetting Create React App — https://react.dev/blog/2025/02/14/sunsetting-create-react-app — 2025-02-14
- Migrate CRA to Vite (OneUptime) — https://oneuptime.com/blog/post/2026-01-15-migrate-create-react-app-to-vite/view — 2026-01-15
