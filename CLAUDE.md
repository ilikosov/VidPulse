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

- **Backend:** Node.js 18+, TypeScript 5, Express 4.
- **DB:** SQLite via `better-sqlite3` + Knex (query builder & migrations).
- **Frontend:** React 18, Ant Design 5, Vite (in `client/`).
- **Tests:** Vitest (unit/integration), Playwright (e2e).
- **Tooling:** Prettier, Husky + lint-staged, ts-node / tsx, nodemon.
- Repo is two npm packages today (backend at root + `client/`); a real monorepo is planned — see
  [ADR 0003](docs/adr/0003-monorepo.md).

## Repository layout

```
/
├── src/                  # Backend
│   ├── routes/           # Express controllers (thin)
│   ├── services/         # Business logic (parser/, sync/, dictionary, youtube, ai, tag)
│   ├── repositories/     # Data-access helpers
│   ├── models/ interfaces/ types/   # TypeScript definitions
│   ├── middleware/       # Express middleware
│   ├── scripts/          # Backfill / maintenance scripts
│   ├── db/               # Knex config (knexfile.ts) + connection
│   └── index.ts          # App entry
├── client/               # React frontend (Vite, Ant Design)
├── migrations/           # Knex migrations (schema source of truth)
├── tests/e2e/            # Playwright e2e tests
├── docs/                 # ADRs, reviews, reference docs, task files
└── schemas/ examples/    # JSON schemas & sample data
```

## Common commands

| Command                                                      | What it does                                          |
| ------------------------------------------------------------ | ----------------------------------------------------- |
| `npm run dev:all`                                            | Install deps, run migrations, launch backend+frontend |
| `npm run dev`                                                | Backend only (nodemon + ts-node)                      |
| `npm run launch`                                             | Backend + frontend together                           |
| `npm run build`                                              | Compile backend to `dist/`                            |
| `npm test`                                                   | Vitest (unit/integration)                             |
| `npm run test:e2e`                                           | Playwright (e2e)                                      |
| `npm run format`                                             | Prettier write                                        |
| `npx knex migrate:make <name> --knexfile src/db/knexfile.ts` | Create a migration                                    |
| `npx knex migrate:latest --knexfile src/db/knexfile.ts`      | Apply migrations                                      |

Backend → http://localhost:3000 · Frontend (Vite) → http://localhost:5173.

## Conventions

- **Layers:** keep **routes thin**; put logic in **services**; data access in **services/repositories**.
  Don't mix HTTP handling with business logic.
- **Migrations:** create with `knex migrate:make`, implement `up` **and** `down`. Don't run migrations
  unless asked; apply with the `--knexfile src/db/knexfile.ts` flag.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) —
  `<type>(<scope>): <subject>` (`feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`;
  scopes like `parser`, `api`, `ui`, `db`, `sync`, `tags`).
- **Branching:** work on a feature branch; never commit straight to the default branch. Commit/push when
  asked — don't auto-push.
- **Formatting:** run `npm run format` before committing (a Husky pre-commit hook also formats staged files).
- **Language:** reply to the user in **Russian**; name code entities (branches, files, identifiers) in
  **English**.
- **Tech debt:** mark temporary code with `@todo` / `@techdebt` (date + reason) and add a TODO entry.
- **Task lifecycle:** each backlog item has its own file in [`docs/tasks/`](docs/tasks). When a task is
  **done**, delete its `docs/tasks/<task>.md` file and remove its entry from [`TODO.md`](TODO.md) (in the
  same PR that completes it) — the backlog tracks only open work; the merged change is the record.

## Testing

- Unit/integration tests live next to the code (`src/**/*.test.ts`); DB tests use in-memory SQLite.
- e2e tests + page objects live in `tests/e2e/`.
- ⚠️ The suite currently has known failures — see the **Tests** section of
  [`docs/code-review.md`](docs/code-review.md) and [TASK-15](docs/tasks/task-15-fix-tests.md). Aim to get
  it green; don't add tests that depend on a pre-existing `dev.sqlite3`.

## Project-specific gotchas

- **Songs are many-to-many.** `video_songs` is the source of truth; `videos.song_id` / `song_title` are
  legacy single-value snapshots ([ADR 0001 Update](docs/adr/0001-canonical-dictionary-entities.md)).
- **Dual source of truth** for group/artist/event: text columns (`group_name`…) vs FKs (`group_id`…).
  Target model & display rule in [ADR 0002](docs/adr/0002-raw-parse-vs-canonical-display.md) / TASK-1.
- **DB quirks:** FK enforcement currently relies on the `better-sqlite3` default; `test` and `development`
  share `dev.sqlite3` ([TASK-5](docs/tasks/task-05-knexfile-hardening.md)).
- `src/services/parser_new/` is **dead code** slated for removal
  ([TASK-9](docs/tasks/task-09-remove-dead-code.md)); the active parser is `src/services/parser/`.
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
