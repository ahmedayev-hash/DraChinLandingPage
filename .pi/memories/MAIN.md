---
schema_version: 1
scope: "project"
project_root: "D:\\GitHub\\DraChinLandingPage"
updated_at: "2026-09-16T05:02:03.217Z"
---

# Main Memory

## Definition of Done

- **five-required-gates-must-pass**: DraChinLandingPage: a change is NOT done until all five gates exit 0, run from the repo root: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. Rules: (1) run all five, a passing subset is not completion; (2) never silence a gate to make it pass — no weakening/`.skip`/`.only` on tests, no `eslint-disable`, no relaxing lint rules, no adding files to `.prettierignore`, no loosening `tsconfig` flags; fix the underlying cause instead; (3) `pnpm build` is mandatory even for logic-only changes because it is the only gate that runs the full Vite pipeline, executes the catalog plugin, and emits `dist/catalog.json` + `dist/posters/*.jpg`; (4) `format:check` is NOT enforced by CI (`.github/workflows/deploy.yml` runs only lint -> typecheck -> test -> build after `install --frozen-lockfile`), so formatting drift reaches `main` unnoticed unless it is run manually. Canonical source: `AGENTS.md` section "Required Gates (Definition of Done)".
