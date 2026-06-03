# TASK-8 — Migrate to a proper monorepo

**Status:** [ ] not started
**Priority:** medium
**Docs:** [ADR 0003 — Migrate to a monorepo (npm workspaces)](../adr/0003-monorepo.md)

**Why:** the repo is already two npm packages — backend at the root (`package.json`,
`kpop-archive-manager`) and frontend in `client/` — but without a workspace manager. Consequences today:
no single install, scripts shell out with `cd client && …` and `concurrently` (see root `package.json`
`client:dev`/`client:build`/`launch`/`dev:all`), two independent `tsconfig.json`, and no shared package,
so API/domain types are duplicated between backend (`src/interfaces`, `src/types`) and frontend
(`client/src`). A real monorepo gives one install, shared types, and unified tooling.

**Steps:**

- [x] **Decide & record:** [ADR 0003](../adr/0003-monorepo.md) — chosen **npm workspaces** with
      layout `apps/server` + `apps/web` + `packages/shared` (shared types/contracts).
- [ ] **Restructure:** move backend (`src/`, `migrations/`, `tests/`, configs) into `apps/server` and the
      current `client/` into `apps/web`; keep import paths working.
- [ ] **Workspaces:** add `"workspaces"` (or `pnpm-workspace.yaml`) at the root; `private: true`; one
      lockfile; a single `npm install` bootstraps everything.
- [ ] **Shared package:** extract cross-cutting types/contracts (API DTOs, dictionary/video shapes) into
      `packages/shared` consumed by both apps — remove duplication.
- [ ] **Scripts:** replace `cd client && …` / `concurrently` plumbing with workspace-aware scripts
      (`npm run -w apps/web …`, root `dev`/`build`/`test` fan-out). Keep `dev:all` working.
- [ ] **Tooling:** root-level `tsconfig` base + per-app extends; align Prettier/Husky/lint-staged,
      Vitest and Playwright paths.
- [ ] **CI/docs:** update [`docs/overview.*`](../overview.en.md) project-structure section,
      `CLAUDE.md`, and any path assumptions (e.g. `--knexfile` path, Playwright `webServer`).

**Files:** repo root (`package.json`, lockfile, `tsconfig.json`), `src/**` → `apps/server/**`,
`client/**` → `apps/web/**`, new `packages/shared/**`, `playwright.config.ts`, `vitest.config.ts`,
`docs/**`, `CLAUDE.md`.

**Acceptance:** a single `npm install` at the root bootstraps both apps; shared types are imported from
`packages/shared` (no duplication); `npm run dev:all`, `npm test`, `npm run test:e2e` and the build all
work from the root; project structure docs updated.

**Notes:** large, mechanical-but-wide change — do it as its own PR, ideally before the schema/data-model
tasks land to avoid path churn. Re-resolve any open work on top of the new layout.

---

← back to [TODO](../../TODO.md)
