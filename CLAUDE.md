# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository. Keep it short and current — if a rule
here no longer matches the code, fix the code or this file.

## What is VidPulse

A full-stack app for archiving and managing **K-pop video metadata**: it ingests videos from YouTube
channels/playlists, parses structured metadata from titles (group, artist, song(s), date, event, fancam),
lets you review/correct it, and organizes everything against a curated dictionary.

- Overview: [`docs/overview.en.md`](docs/overview.en.md) · [`docs/overview.ru.md`](docs/overview.ru.md)
- Data model: [`docs/entities.en.md`](docs/entities.en.md)
- Decisions: [`docs/adr/`](docs/adr) · Backlog: [`TODO.md`](TODO.md) → [`docs/tasks/`](docs/tasks)

## Tech stack

- **Backend:** Node.js 18+, TypeScript 5, Express 4. (in `apps/server/`)
- **DB:** SQLite via `better-sqlite3` + Knex (query builder & migrations).
- **Frontend:** React 18, Ant Design 5, Vite (in `apps/web/`).
- **Shared types:** `@vidpulse/shared` (in `packages/shared/`).
- **Tests:** Vitest (unit/integration), Playwright (e2e).
- **Tooling:** Prettier, Husky + lint-staged, ts-node / tsx, nodemon.
- **Monorepo:** npm workspaces — see [ADR 0003](docs/adr/0003-monorepo.md).

## Repository layout

```
/
├── apps/
│   ├── server/             # Backend (Express, src/, migrations/, tests/)
│   │   ├── src/            # routes/, services/, middleware/, db/, etc.
│   │   ├── migrations/     # Knex migrations (schema source of truth)
│   │   ├── tests/e2e/      # Playwright e2e tests
│   │   ├── vitest.config.ts
│   │   └── playwright.config.ts
│   └── web/                # Frontend (Vite, React, Ant Design)
│       └── src/
├── packages/
│   └── shared/             # Shared types/contracts (@vidpulse/shared)
├── schemas/                # JSON schemas (media-library, request)
├── docs/                   # ADRs, reviews, reference docs, task files
├── examples/               # Sample data
├── package.json            # Root: private, workspaces, aggregating scripts
└── tsconfig.base.json      # Shared TS base config
```

## Common commands

| Command                                                                  | What it does                                          |
| ------------------------------------------------------------------------ | ----------------------------------------------------- |
| `npm run dev:all`                                                        | Install deps, run migrations, launch backend+frontend |
| `npm run dev`                                                            | Backend + frontend together                           |
| `npm run dev -w apps/server`                                             | Backend only (nodemon + ts-node)                      |
| `npm run dev -w apps/web`                                                | Frontend only (Vite)                                  |
| `npm run build`                                                          | Build both apps                                       |
| `npm test`                                                               | Vitest (unit/integration)                             |
| `npm run test:e2e`                                                       | Playwright (e2e)                                      |
| `npm run format`                                                         | Prettier write                                        |
| `npx knex migrate:make <name> --knexfile apps/server/src/db/knexfile.ts` | Create a migration                                    |
| `npx knex migrate:latest --knexfile apps/server/src/db/knexfile.ts`      | Apply migrations                                      |

Backend → http://localhost:3000 · Frontend (Vite) → http://localhost:5173.

Commands prefixed with `-w apps/server` target the backend workspace; `-w apps/web` the frontend.

## Conventions

- **Layers:** keep **routes thin**; put logic in **services**; data access in **services/repositories**.
  Don't mix HTTP handling with business logic.
- **Migrations:** create with `knex migrate:make`, implement `up` **and** `down`. Don't run migrations
  unless asked; apply with the `--knexfile apps/server/src/db/knexfile.ts` flag.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) —
  `<type>(<scope>): <subject>` (`feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`;
  scopes like `parser`, `api`, `ui`, `db`, `sync`, `tags`).
- **Branching:** work on a feature branch; never commit straight to the default branch. Commit/push when
  asked — don't auto-push.
- **Merged PRs are closed:** never push more commits to a branch whose PR is already merged — they'll be
  stranded and won't reach the default branch. Open a **new** branch/PR (off the updated default branch)
  for any follow-up or fix.
- **Formatting:** run `npm run format` before committing (a Husky pre-commit hook also formats staged files).
- **Language:** reply to the user in **Russian**; name code entities (branches, files, identifiers) in
  **English**.
- **Tech debt:** mark temporary code with `@todo` / `@techdebt` (date + reason) and add a TODO entry.
- **Task lifecycle:** each backlog item has its own file in [`docs/tasks/`](docs/tasks). A PR that works
  on a task **updates that task's status/checkboxes** in the task file and in [`TODO.md`](TODO.md) **within
  the same PR** (so progress is reviewed with the change). When a task is **done**, delete its
  `docs/tasks/<task>.md` file and remove its `TODO.md` entry in that PR — the backlog tracks only open
  work; the merged change is the record.

## Testing

- Unit/integration tests live next to the code (`apps/server/src/**/*.test.ts`); DB tests use in-memory SQLite.
- e2e tests + page objects live in `apps/server/tests/e2e/`.
- ⚠️ The suite currently has known failures — see the **Tests** section of
  [`docs/code-review.md`](docs/code-review.md) and [TASK-15](docs/tasks/task-15-fix-tests.md). Aim to get
  it green; don't add tests that depend on a pre-existing `dev.sqlite3`.

## Project-specific gotchas

- **Songs live only in `video_songs`.** A video's songs are the rows in `video_songs` (raw title +
  optional canonical `song_id` + `position`); the legacy `videos.song_id` / `song_title` columns were
  removed in TASK-3 ([ADR 0002](docs/adr/0002-raw-parse-vs-canonical-display.md)).
- **Dual source of truth** for group/artist/event: text columns (`group_name`…) vs FKs (`group_id`…).
  Target model & display rule in [ADR 0002](docs/adr/0002-raw-parse-vs-canonical-display.md) / TASK-1.
- **DB quirks:** FK enforcement currently relies on the `better-sqlite3` default; `test` and `development`
  share `dev.sqlite3` ([TASK-5](docs/tasks/task-05-knexfile-hardening.md)).
- **Backend lives in `apps/server/`** — use `-w apps/server` for workspace-specific commands.
- **Migrations are at `apps/server/migrations/`** — use `--knexfile apps/server/src/db/knexfile.ts`.
- Secrets live in `.env` (never commit). `YOUTUBE_API_KEY` is required for real syncs.

## Working as a pet project

This is a personal/pet project — optimize for **momentum over ceremony**:

- **Ship working software.** A green build + the feature working locally is the bar; don't gold-plate.
- **YAGNI / simplest thing that works.** Refactor when it hurts, not preemptively. Large refactors go in
  their own PR.
- **Small, focused PRs.** One logical change per PR; keep the diff reviewable.
- **Lean testing.** Cover the gnarly logic well (parser, dictionary resolution, tagging); skip exhaustive
  coverage of trivial CRUD.
- **Use the backlog.** When you spot an issue out of scope, add it to [`TODO.md`](TODO.md) /
  `docs/tasks/` instead of fixing everything at once. Record non-obvious decisions as a short ADR.
- **Defer hardening** (auth, full observability, perf) until it's actually needed — but note the debt.
