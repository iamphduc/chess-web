# Sprint: CI and Pages deploy

_From plan: docs/plans/vite-migration.md · Slug: ci-deploy · Status: archived · Generated: 2026-10-04_

<!-- autopilot-run: started=2026-10-04T23:33:17Z sprints=1 waves=1 -->

## Status board

| Wave | Slice | Title | Branch | PR | Status | Confidence | Depends on |
|------|-------|-------|--------|----|--------|------------|------------|
| 1 | C1 | GitHub Actions workflow (verify, secrets, Pages deploy); remove `gh-pages`; package becomes ESM | ci-deploy-C1 | #36 | merged | high | — |
| 2 | D1 | Document the CI and deploy; decisions entry; fix the stale `engineAdapter.ts` header | ci-deploy-D1 | #37 | merged | medium | C1 |

Plan branch: `vite-migration`. Wave heads: `ci-deploy-w1`, `ci-deploy-w2`.

Why it runs in order: the workflow tests need a YAML parser, so C1 changes `package.json` and `package-lock.json`. Removing `gh-pages` and adding `"type": "module"` touch the same files, so all of it is one slice. D1 documents what C1 shipped, and its tests check that the workflow file it names exists.

## Shared contract

**Workflow file:** `.github/workflows/pod-ci.yml`, the only workflow in the repo. C1 owns it. D1 and later sprints read it.

**Rule: triggers.** `on:` has exactly two keys:
- `pull_request` with **no** `branches` filter. Every PR runs the checks, including wave PRs into `vite-migration`. This is the plan's CI from this sprint on.
- `push` with `branches: [main]` exactly. Pushes to any other branch (wave heads, the plan branch, slice branches) do not trigger it. A merged PR into `main` therefore runs it once as a push.
- No `workflow_dispatch`, no `schedule`. To deploy again, re-run the push run's jobs from the Actions tab.

**Rule: jobs.** Three jobs. The top-level `permissions` is `contents: read` and nothing else.
- `verify` (`ubuntu-latest`): checkout, `actions/setup-node` with `node-version: 24` and `cache: npm`, `npm ci`, then one step whose `run` is exactly the `Verification:` command in `docs/codebase-structure.md` (`npm run build && npm test`). `build` already runs `tsc --noEmit`, so this one step is typecheck, build and tests. Only when the event is a push to `main`, it then runs `actions/configure-pages` and `actions/upload-pages-artifact` with `path: dist`. On a PR it uploads nothing.
- `secrets` (`ubuntu-latest`): checkout with `fetch-depth: 0`, then `gitleaks/gitleaks-action@v2` with env `GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}`. No job permission above `read`.
- `deploy`: `needs: [verify, secrets]`. Its `if` requires both `github.event_name == 'push'` and `github.ref == 'refs/heads/main'`. Job `permissions` are exactly `pages: write` and `id-token: write`. `environment` is `name: github-pages`, `url: ${{ steps.deployment.outputs.page_url }}`. One step: `actions/deploy-pages` with `id: deployment`. `concurrency: { group: pages, cancel-in-progress: false }`, so a second push queues behind a running deploy and never cancels it.
- Edges: no job but `deploy` has any `write` permission. No job but `deploy` uses `deploy-pages`. A failed `verify` or `secrets` means no deploy. A PR run shows `deploy` as skipped, not failed. No step runs `npm run deploy` or `gh-pages`. No secret other than `GITHUB_TOKEN` is referenced.
- Every `uses:` is pinned to a major tag (`@v<N>`), never a branch such as `@main`. Majors come from `docs/research/cra-to-vite.md` (checkout v7, setup-node v7, configure-pages v6, upload-pages-artifact v5, deploy-pages v5). If one of those tags doesn't exist, use the latest major that does and add a NOTE.

**Rule: package is ESM.** `package.json` has `"type": "module"`. This removes Vite's "ESM syntax in a file loaded as CommonJS (vite.config.ts)" warning. `vite.config.ts` keeps its name. Edge: any future Node script at the repo root must be ESM, or be named `.cjs`.

**Removed:** `gh-pages.js`, the `gh-pages` package, and the `deploy` and `predeploy` scripts. Scripts left: `dev`, `build`, `preview`, `test`, unchanged. Added: devDependency `yaml` `^2` (tests parse the workflow with it; its YAML 1.2 parsing keeps the `on:` key a string, not `true`).

**How this sprint verifies the workflow before `main`** (the deploy job can only run after the human merges the plan PR):
1. Structure tests on the parsed YAML (C1's `tests/workflow.test.ts`).
2. The real `verify` and `secrets` jobs run on this sprint's own wave PRs into `vite-migration`, on Linux, from a clean `npm ci`. The orchestrator checks both pass and that `deploy` is skipped (`gh pr checks <url>`).
3. The production-base build is already pinned by `tests/build.test.ts`, which `verify` runs.

**Human steps after this sprint** (agents must not do them):
- Before merging the plan PR into `main`: repo Settings → Pages → Source → "GitHub Actions". Until then the old `gh-pages` branch keeps serving, and the first `deploy` job fails.
- Decide whether `verify` (and `secrets`) become required status checks on `main`.
- Approve and merge the plan PR. Then watch the push run's `deploy` job and run the live smoke at `https://iamphduc.github.io/chess-web/`: castle, en passant, promotion, checkmate, reset across two games, no console errors, every piece image loads. Rollback: switch Pages Source back to the `gh-pages` branch, which still holds the old build.
- Delete the old `gh-pages` branch after the live smoke passes (the plan's open question; default is to keep it until then).

**Queue entries this sprint resolves** (the orchestrator marks them at archive): the 2026-10-04 V1 "ESM syntax in a file loaded as CommonJS" PENDING (C1) and the 2026-10-04 D1 stale `engineAdapter.ts` header PENDING (D1).

## Per-slice detail

### C1: GitHub Actions workflow; remove `gh-pages`; package becomes ESM
- **Scope:**
  - Write `.github/workflows/pod-ci.yml` to the contract's **triggers** and **jobs** rules. Keep it minimal: no matrix, no extra jobs, no third-party actions besides gitleaks.
  - In `package.json`: add `"type": "module"`, add devDependency `yaml` `^2`, remove `gh-pages`, `deploy` and `predeploy`. Delete `gh-pages.js`. Regenerate `package-lock.json` with plain `npm install`. Clean `npm ci` and `npm ls --all` must pass.
  - Update `tests/toolchain.test.ts` to the new state: the deploy scripts, `gh-pages` package and `gh-pages.js` are gone, and `type` is `module`. Keep every other existing check.
  - With `"type": "module"`, each root test file must still find the repo root. If `__dirname` is undefined in any of them, switch that file's `ROOT` line to `fileURLToPath(new URL("..", import.meta.url))`, and change nothing else in it.
  - Don't change `vite.config.ts`, `src/`, or `docs/`. The `## CI` docs are D1's.
  - CI runs on Linux, which is case-sensitive about paths. If the wave PR's `verify` fails only on Linux, fix it in this slice's files if possible. Otherwise add a queue PENDING naming the file.
- **Files owned:** `.github/workflows/pod-ci.yml` (new), `package.json`, `package-lock.json`, `gh-pages.js` (delete), `tests/workflow.test.ts` (new), `tests/toolchain.test.ts`, `tests/build.test.ts`, `tests/vite-config.test.ts`, `tests/no-require.test.ts`, `tests/docs.test.ts` (only the `ROOT` line, only if needed)
- **Success criteria:**
  - `[test] on has exactly pull_request (no branches/branches-ignore filter) and push with branches ["main"] — tests/workflow.test.ts › runs on every pull request and on push to main only`
  - `[test] top-level permissions equal { contents: "read" }; no job except deploy has any "write" permission — tests/workflow.test.ts › only the deploy job can write`
  - `[test] verify uses setup-node with node-version 24 and cache npm, runs npm ci, and has a step whose run equals the Verification: command read from docs/codebase-structure.md — tests/workflow.test.ts › verify runs the documented verification on node 24`
  - `[test] verify's configure-pages and upload-pages-artifact (path dist) steps both have an if that requires a push to refs/heads/main — tests/workflow.test.ts › pages artifact is uploaded only on push to main`
  - `[test] secrets checks out with fetch-depth 0 and uses gitleaks/gitleaks-action@v2 with GITHUB_TOKEN from secrets — tests/workflow.test.ts › secrets job scans the full history with gitleaks`
  - `[test] deploy needs verify and secrets, its if requires event push and ref refs/heads/main, permissions are exactly pages write and id-token write, environment github-pages with the deployment page_url, concurrency group pages without cancel-in-progress — tests/workflow.test.ts › deploy runs only after checks pass on push to main`
  - `[test] deploy-pages appears only in the deploy job, with id deployment — tests/workflow.test.ts › only the deploy job deploys`
  - `[test] every uses: matches <owner>/<repo>@v<digits> — tests/workflow.test.ts › actions are pinned to major tags`
  - `[test] no step mentions gh-pages or npm run deploy, and the only secrets.* reference is GITHUB_TOKEN — tests/workflow.test.ts › no old deploy path and no extra secrets`
  - `[test] .github/workflows holds only pod-ci.yml — tests/workflow.test.ts › one workflow file`
  - `[test] package.json has type module, no gh-pages dependency, no deploy/predeploy scripts; dev/build/preview/test unchanged — tests/toolchain.test.ts › package.json matches the vite toolchain`
  - `[test] gh-pages.js is gone along with the CRA-era files — tests/toolchain.test.ts › CRA-era files are removed`
  - `[test] .gitignore still lists /dist (the gh-pages.js check is dropped) — tests/toolchain.test.ts › build output is dist`
  - `[test] the production build's output has no line containing both "CommonJS" and "vite.config" — tests/build.test.ts › config loads as ESM without a CommonJS warning`
  - `[test] all existing suites still pass under "type": "module" (vite-config port tests, build, docs, no-require, engine, board) — npm test (vitest run) › full suite green`
  - `[manual] npm run build && npm run preview → http://127.0.0.1:4173/chess-web/ shows the board with all piece images and no console errors, and neither command prints the CommonJS warning.`
  - `[manual] On the wave-1 PR into vite-migration, gh pr checks shows verify and secrets passed and deploy skipped (the orchestrator checks this before merging the wave).`
- **Depends on:** —
- **One-way door:** none. Nothing deploys during this sprint: `deploy` runs only on a push to `main`, which happens only when the human merges the plan PR. Removing `gh-pages.js` is undone with `git revert`, and the `gh-pages` branch, which is still the live Pages source, is not touched.

### D1: Document the CI and deploy; fix the stale `engineAdapter.ts` header
- **Scope:**
  - `docs/codebase-structure.md`:
    - Rewrite `## CI` to describe `.github/workflows/pod-ci.yml` from the contract: triggers (every `pull_request`, `push` to `main`), the three jobs, Node 24, that `verify` runs the `Verification:` command, and that `deploy` publishes `dist/` to `https://iamphduc.github.io/chess-web/` only on push to `main`. Add a short "Human setup" list: the Pages Source → "GitHub Actions" switch, and the required-check decision.
    - In `## Stack & conventions`, remove the "Known warning" bullet. Replace the "Deploy (until `ci-deploy`)" bullet with a one-line deploy bullet pointing at `## CI`. Add that the package is ESM (`"type": "module"`), so root Node scripts are ESM or `.cjs`.
    - Leave `## Layout` and `## Smoke recipe` alone except for anything that names the old deploy.
  - Append a `docs/decisions.md` entry, "GitHub Actions deploys to GitHub Pages", following the format of the existing entries: the official Pages actions replace the `gh-pages` branch push; one workflow with PR checks plus a `main`-only deploy; checks on every PR; `"type": "module"`. Point to the plan's Key decisions. Don't edit old entries.
  - `src/features/board/engineAdapter.ts`: change only the header paragraph that says engine modules use relative imports because Vitest can't resolve the tsconfig aliases. It should say the relative imports are kept as they are, and the bare-import prefixes now resolve everywhere. No code changes.
- **Files owned:** `docs/codebase-structure.md`, `docs/decisions.md`, `src/features/board/engineAdapter.ts`, `tests/docs.test.ts`
- **Success criteria:**
  - `[test] codebase-structure.md has no "gh-pages.js", "npm run deploy", or "loaded as CommonJS" text, plus the existing stale-text checks — tests/docs.test.ts › codebase-structure has no stale CRA or pre-cutover text`
  - `[test] the ## CI section is not "None", names .github/workflows/pod-ci.yml (which exists on disk), and mentions pull_request, main, Node 24, and https://iamphduc.github.io/chess-web/ — tests/docs.test.ts › CI section describes the workflow`
  - `[test] the ## CI section names the human "GitHub Actions" Pages Source step — tests/docs.test.ts › CI section lists the human setup`
  - `[test] the Verification: command in the Smoke recipe equals the run of a verify step in pod-ci.yml — tests/docs.test.ts › documented verification matches CI`
  - `[test] decisions.md has a "## " heading that mentions GitHub Actions and Pages — tests/docs.test.ts › decisions records the actions deploy`
  - `[test] engineAdapter.ts has no "baseUrl" and no "does not resolve" text — tests/docs.test.ts › engineAdapter header has no stale alias note`
  - `[test] existing docs checks (sections, smoke recipe values, real scripts only, layout paths, vite decision) still pass — tests/docs.test.ts › (existing tests)`
- **Depends on:** C1
- **One-way door:** none

## Sprint summary

- **Synced with merge-target:** up to date (`origin/main` had no new commits).
- **Slices shipped:** C1, D1 (wave PRs #36, #37 into `vite-migration`).
- **Queue entries:** resolved 2 (the Vite CommonJS-config warning; the stale `engineAdapter.ts` header), deferred 0. One gate-5 halt (`--max-runtime`, 4h default) between wave 1 and wave 2 — logged and resolved in `docs/handoff-queue.md` (2026-10-04).
- **Slice log:**
  - C1: high · test-first yes · runtime clean `npm ci` + build + preview at `/chess-web/`; real GitHub Actions run on PR #36 (`verify` pass, `secrets` pass, `deploy` skipped) · 4 NOTEs · time lost: first engineer stalled (10 min no output during a mutation check) and was re-dispatched once into the same worktree; the re-dispatch found the leftover mutation in the workflow's deploy `if`, restored it, and kept a real test fix (`f743836`)
  - D1: medium · test-first yes (one test green from the start, proven by a deliberate doc break) · runtime `npm ci` + build + preview at `/chess-web/`, 32 pieces, no console messages · 2 NOTEs · time lost ~5 min (regex escaping in a test)
  - Wave fixes: none. Stalls: 1 (C1, re-dispatched once). CI on both wave PRs: `verify` + `secrets` pass, `deploy` skipped.
- **Agent context at hand-back:** ~215k tokens (sprint-planner 71k, C1 re-dispatch 66k, D1 78k; the stalled C1 run reported none) — each agent's final context size, not tokens billed.
