# AGENTS.md

## Project Overview

Static marketing site deployed to GitHub Pages. No server, no backend, no runtime API calls for content. Three layers:

1. **Landing page** — clickbait hero with an 8-second auto-advance countdown (`src/pages/LandingPage.tsx`).
2. **Catalog** — drama grid generated from TMDB **at build time** (`tools/catalog/`), not hand-written.
3. **Trailer modal** — native `<dialog>` playing a YouTube embed; its CTA opens a Shopee affiliate link.

"DraChin" = Chinese drama; the TMDB query is intentionally restricted to `with_original_language=zh` with genre filters.

Stack: React 19, Vite 8, TypeScript 5.9, Vitest 5 + Testing Library, ESLint 10, Prettier 3, pnpm 12. No runtime dependencies beyond React.

`public/config.json` is the content surface — headline, badges, affiliate links, and poster can change with no code edit. Everything in `dist/` is generated and deploys automatically.

All user-facing copy, code comments, and docs are written in **Indonesian**. Match that when editing them.

## Setup

- Node `^22.12.0 || ^24.0.0 || >=26.0.0` (CI uses Node 24); pnpm 12 (`packageManager: pnpm@12.4.1`). Use pnpm only — `pnpm-lock.yaml` is the lockfile.
- `pnpm install`
- Optional: copy `.env.example` to `.env` and set `TMDB_API_KEY`. Without it, `pnpm build` still succeeds using the 6-item fallback catalog.

## Common Commands

```bash
pnpm dev            # Vite dev server; catalog served from a dev-only cache
pnpm build          # tsc -b && vite build -> dist/ (calls TMDB when a key is set)
pnpm preview        # serve the built dist/
pnpm lint           # eslint .
pnpm typecheck      # tsc -b --noEmit
pnpm test           # vitest run
pnpm test:watch     # vitest
pnpm format         # prettier --write .
pnpm format:check   # prettier --check .
```

Focused test (verified working):

```bash
pnpm test src/lib/links.test.ts
```

CI (`.github/workflows/deploy.yml`) runs in this order: `pnpm install --frozen-lockfile`, `lint`, `typecheck`, `test`, `build`. Treat that as the required gate set.

## Code Style

Enforced by config, not convention:

- Prettier: 2-space, single quotes, semicolons, trailing commas, print width 90, LF (`.prettierrc.json`). `dist/`, `pnpm-lock.yaml`, `archive/`, and `.pi/` are excluded.
- ESLint flat config (`eslint.config.js`): `js.recommended` + `typescript-eslint` recommended + `eslint-plugin-react-hooks` recommended. Ignores `dist`, `node_modules`, `archive`. There is no `lint:fix` script; invoke `eslint --fix` directly if needed.
- TypeScript is strict with `noUncheckedIndexedAccess`, `noImplicitOverride`, `verbatimModuleSyntax`, and `isolatedModules` in both projects. `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch` are enabled in `tsconfig.app.json` only, so unused locals bite in `src/` but not in `tools/`. Handle indexed access explicitly and use `import type` for type-only imports.
- The `react-hooks/set-state-in-effect` rule is active: derive loading state during render or set state in event handlers, not synchronously in an effect body.

Type inclusion is split by project reference and matters when adding files:

- `tsconfig.app.json` includes `src` plus `tools/catalog/types.ts` only.
- `tsconfig.node.json` includes `vite.config.ts` and `tools/**/*`.
- `tools/catalog/types.ts` is shared across both boundaries by design. A new cross-boundary file must be added to the right `include` list.

`vite.config.ts` must keep `import { defineConfig } from 'vitest/config'`; only `loadEnv` comes from `vite`. Vite's own `defineConfig` does not know the `test` block and `pnpm typecheck` fails if it is used. This is documented inline — do not "clean it up".

Tests import `describe`/`it`/`expect` explicitly from `vitest` even though `globals: true` is set; follow that convention.

## Testing

- Vitest 5, jsdom by default. `src/test-setup.ts` runs for every test file.
- Collected files: `src/**/*.test.{ts,tsx}` and `tools/**/*.test.ts`.
- Tests under `tools/` must start with `// @vitest-environment node`. Every existing tools test does; they import Node-only modules otherwise unavailable in jsdom.
- jsdom does not implement `HTMLDialogElement.showModal`/`close`, so `src/test-setup.ts` stubs them to prevent `TypeError`. The stub does **not** reproduce focus trapping, Esc handling, or backdrop click. Those must be verified in a real browser, not asserted in jsdom.
- Tests never hit the network: they either inject a fake `fetcher` argument or `vi.stubGlobal` `fetch`/`Image`. Storage-dependent code (`pickLink`) takes a `storage` parameter and tests pass a fake, so no real `localStorage` is required. The catalog plugin deliberately skips generation on non-build (serve/test) runs so tests stay hermetic even when `.env` holds a key — preserve that guard.
- Reset hash state with `window.history.replaceState`, not hash assignment, to avoid waking unmounted components.

## Architecture Notes

- Build-time catalog pipeline: `tools/catalog/vitePlugin.ts` (thin Vite plugin) -> `fetchCatalog.ts` (TMDB discover + videos) -> `normalize.ts` (validation) -> `downloadPosters.ts` (bounded concurrency) -> emitted as `dist/catalog.json` and `dist/posters/*.jpg`.
  - The pipeline never throws: missing key, HTTP failure, or empty results all fall back to `FALLBACK_CATALOG` (`tools/catalog/fallback.ts`). Keep that property — a deploy must not fail because TMDB is down.
  - Page selection is randomized within `CATALOG_PAGE_POOL`, so each build yields a different catalog by design.
  - A dev-only cache lives in `node_modules/.cache/drachin-catalog`. Builds always refetch from TMDB; do not extend that cache to build mode.
- Browser-side revalidation: `src/lib/catalogSchema.ts` re-validates every `catalog.json` field at runtime (drops malformed entries, rejects poster paths outside `./posters/`, requires 11-char YouTube IDs). Extend the schema whenever you add catalog fields.
- Routing is hash-based (`src/lib/router.ts`): `#/katalog` = catalog, `#/drama/<id>` = catalog plus modal, anything else = landing.
  - `enterCatalog` and `closeDetail` use `location.replace` so the back button cannot re-trigger the 8-second countdown loop; `openDetail` uses hash assignment so back closes the modal. This asymmetry is intentional.
- `TMDB_API_KEY` deliberately has no `VITE_` prefix: `VITE_`-prefixed vars are injected into the client bundle. It is read only in the Node build process via `loadEnv(mode, cwd, '')`.
- Trailer iframes render only while the modal is open; leaving one mounted makes trailer audio keep playing after close.
- Opening the modal is deferred until posters finish preloading, so trailer audio never starts behind an unready screen.

## Safety / Do Not Touch

- Never put a real API key, token, or credential in a tracked file, and never prefix a secret with `VITE_`. `.env` is gitignored; `.env.example` must stay value-free.
- `.github/workflows/deploy.yml` fails the build if the key's value is found anywhere in `dist/`. If you change how the key flows into the build, keep that check passing.
- `dist/` is generated output and gitignored. Do not hand-edit it; rebuild instead.
- `archive/browser.html` is a retired monolithic version kept for reference. It is not deployed, and ESLint/Prettier ignore it. Do not modernize or "fix" it.
- `public/config.json` is the intended edit point for landing content — prefer changing it over hardcoding copy in components.
- Only `http:`/`https:` affiliate URLs survive `parseConfig`; other schemes are dropped silently. Cover link changes with `src/lib/config.test.ts`.
- Pushes to `main` deploy to production via GitHub Actions with `cancel-in-progress`. There is no staging environment.
- `pnpm-workspace.yaml` carries `minimumReleaseAgeExclude` entries for `@types/node`, `vitest`, `@vitest/mocker`, and `@vitest/spy`. If you bump those packages, update that list in the same change.

## Agent Workflow

1. Landing copy or links: edit `public/config.json` only.
2. Catalog shape changes: update `tools/catalog/types.ts` first, then `normalize.ts`/`fetchCatalog.ts`, then `src/lib/catalogSchema.ts`. The build producer and the browser validator must agree.
3. Add or adjust a colocated `*.test.ts(x)` beside every module you change.
4. Before finishing, run all five Required Gates below. Do not report work as complete until every one exits 0.
5. `pnpm build` needs network access when `TMDB_API_KEY` is set, but neither a missing key nor an unreachable TMDB is a failure: the catalog plugin falls back. Do not skip the build because it touches the network.
6. Keep code in the existing layout: `src/lib/` pure logic, `src/hooks/` React hooks, `src/components/` presentational, `src/pages/` route-level, `tools/catalog/` build-time only.

### Git: never commit unless explicitly told

**Do not run `git commit` (or `git push`, `git tag`, `git reset`, or any other history-changing command) unless the user has explicitly asked you to in the current request.** "Implement it", "fix it", "add it", "write specs then plan then implement", or "do not ask for approval" are **not** permission to commit. They authorize editing files, not recording history.

Finishing work means the files are written and the Required Gates pass. Leave the change staged-free and uncommitted, then report what changed and let the user decide when to commit.

If a task genuinely requires a commit to proceed, ask first and wait for a yes. Never commit "to be helpful" — an unexpected commit is hard to undo once it is pushed, and on this repository a push to `main` deploys to production.

## Required Gates (Definition of Done)

Five gates must pass before any change counts as done. Run all five; a passing subset is not completion:

```bash
pnpm format:check   # Prettier
pnpm lint           # ESLint
pnpm typecheck      # tsc -b --noEmit
pnpm test           # Vitest
pnpm build          # tsc -b && vite build
```

- All five must exit 0. A failing gate means the change is incomplete: fix the cause, do not paper over the gate.
- Never silence a gate to make it pass — do not weaken or delete a test, skip an assertion with `.only`/`.skip`, relax a lint rule, add an `eslint-disable`, exclude a file in `.prettierignore`, or loosen a `tsconfig` flag. Fix the underlying problem instead.
- If a gate fails for a reason that is provably unrelated to your change, say so explicitly and show the evidence, rather than ignoring it silently.
- `pnpm build` is mandatory even for logic-only changes. It is the only gate that runs the full Vite pipeline, executes the catalog plugin, and verifies the emitted `dist/` artifacts (`catalog.json`, `posters/*.jpg`).
- CI (`.github/workflows/deploy.yml`) enforces `lint`, `typecheck`, `test`, and `build` in that order after `install --frozen-lockfile`. `format:check` is **not** part of CI, so it will never fail there — it must be run manually or formatting drift reaches `main` unnoticed.

## Notes for Future Agents

- This is a single root-level project; no workspace members or nested packages exist.
- No repository-level E2E or browser automation suite exists. Focus trapping, Esc, backdrop click, the popup-block fallback, and real trailer audio behavior are unverified by tests.
- No `typecheck --watch` or `lint:fix` script is defined.
