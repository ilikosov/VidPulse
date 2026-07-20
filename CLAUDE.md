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

- **Backend:** Node.js 18+, TypeScript 7 workspaces, Express 5.
- **DB:** SQLite via `better-sqlite3` + Knex (query builder & migrations).
- **Frontend:** React 18, Ant Design 5, Vite (in `apps/web/`).
- **Tests:** Vitest (unit/integration), Playwright (e2e).
- **Tooling:** Prettier, Husky + lint-staged, tsx, nodemon.
- **Monorepo:** npm workspaces — `apps/server` (backend), `apps/web` (frontend), `packages/shared`
  (shared types), `packages/db` (`@vidpulse/db`: knex connection, knexfile, migrations, seeds,
  repositories, entity types, tag operations), `packages/kpop-sources` (`@vidpulse/kpop-sources`: parse
  Wikidata/MusicBrainz into a media-library snapshot), `packages/cli` (`@vidpulse/cli`: all command-line
  tools — config migrate/import-env, backfill/maintenance scripts, dev-all launcher). See
  [ADR 0003](docs/adr/0003-monorepo.md), [ADR 0004](docs/adr/0004-kpop-data-sources.md).

## Repository layout

```
/
├── apps/
│   ├── server/               # Backend (Node.js / Express)
│   │   ├── src/              # TypeScript source
│   │   │   ├── routes/       # Express controllers (thin)
│   │   │   ├── services/     # Business logic (parser/, sync/, dictionary, youtube, ai, tag)
│   │   │   ├── models/ interfaces/ types/   # TypeScript definitions
│   │   │   ├── middleware/   # Express middleware
│   │   │   └── index.ts      # App entry
│   │   ├── tests/            # Vitest unit/integration + Playwright e2e
│   │   └── schemas/ examples/  # JSON schemas & sample data
│   └── web/                  # React frontend (Vite, Ant Design)
├── packages/
│   ├── shared/               # Shared API contracts (@vidpulse/shared)
│   ├── db/                   # @vidpulse/db: connection, knexfile, migrations/, seeds/,
│   │   │                     #   repositories, entity types (compiled to dist/)
│   │   ├── src/              # connection.ts, knexfile.ts, repositories.ts, types.ts, index.ts
│   │   ├── migrations/       # Knex migrations (schema source of truth)
│   │   └── seeds/            # Knex seeds (+ examples/media-library.seed.json)
│   ├── kpop-sources/         # @vidpulse/kpop-sources: Wikidata/MusicBrainz → media-library snapshot
│   │   └── src/              # wikidata/ (queries, source, normalize), buildLibrary.ts (compiled to dist/)
│   └── cli/                  # @vidpulse/cli: command-line tools (compiled to dist/, exposed as bins)
│       ├── src/cli/          # migrate, import-env, backfill-*, merge-short-tags
│       └── scripts/          # dev-all.mjs (raw .mjs launcher, not compiled)
├── docs/                     # ADRs, reviews, reference docs, task files
└── tsconfig.base.json        # Shared TS base config
```

## Common commands

| Command                                                                                           | What it does                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev:all`                                                                                 | Install/build/migrate + launch, and **auto-restart on new commits** pushed to the current branch (watcher pulls & restarts). `dev:all:once` runs it a single time |
| `npm run dev`                                                                                     | Backend only (nodemon + tsx)                                                                                                                                      |
| `npm run launch`                                                                                  | Backend + frontend together                                                                                                                                       |
| `npm run build`                                                                                   | Compile `@vidpulse/db` + sources → backend → frontend                                                                                                             |
| `npm test`                                                                                        | Vitest (unit/integration)                                                                                                                                         |
| `npm run test:e2e`                                                                                | Playwright (e2e)                                                                                                                                                  |
| `npm run format`                                                                                  | Prettier write                                                                                                                                                    |
| `NODE_OPTIONS="--import tsx" npx knex migrate:make <name> --knexfile packages/db/src/knexfile.ts` | Create a migration (tsx preload loads the TS knexfile under TS7)                                                                                                  |
| `NODE_OPTIONS="--import tsx" npx knex migrate:latest --knexfile packages/db/src/knexfile.ts`      | Apply migrations (or `npm run migrate`, which preloads tsx)                                                                                                       |

Backend → http://localhost:3000 · Frontend (Vite) → http://localhost:5173.

## Conventions

- **Layers:** keep **routes thin**; put logic in **services**; data access via the `@vidpulse/db`
  repositories. Don't mix HTTP handling with business logic. Import the knex singleton, repositories,
  and entity types from `@vidpulse/db` (e.g. `import { knex, videoRepository } from '@vidpulse/db'`).
- **Migrations:** create with `knex migrate:make`, implement `up` **and** `down`. Don't run migrations
  unless asked; apply with the `--knexfile packages/db/src/knexfile.ts` flag (or `npm run migrate`).
  `@vidpulse/db` is a **compiled** package — `npm run build` builds it before the server; rebuild it
  (`npm run build -w @vidpulse/db`) after changing repositories/connection so the server picks it up.
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

- Unit/integration tests live next to the code (`apps/server/src/**/*.test.ts`); DB tests use an isolated SQLite test database prepared by Vitest global setup.
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
- **DB runtime:** `@vidpulse/db` enables WAL, foreign keys, and `busy_timeout` in the Knex `afterCreate` hook.
  Test migrations run through `packages/db/src/knexfile.ts` with `TEST_DATABASE_PATH`.
- **Tag operations live in `@vidpulse/db`** (`packages/db/src/tags.ts`: `assignAutoTags`, `addTagToVideo`,
  `tagShortsByDuration`, `mergeShortTags`, …) so the CLI backfills in `@vidpulse/cli` can share them.
  `apps/server/src/services/tag.service.ts` is a **compat re-export shim** — server code and its test
  mocks (`vi.mock('../services/tag.service')`) still import from there.
- **All CLIs live in `@vidpulse/cli`** (compiled, `bin`s + `tsx` npm scripts). Run via root scripts
  (`npm run config:migrate`, `config:import-env`, `backfill:*`, `merge:short-tags`) which build the
  package deps first, or directly with `-w @vidpulse/cli`. `dev-all.mjs` moved to `packages/cli/scripts/`.
- The active parser is `apps/server/src/services/parser/`. Which implementation runs is selected by
  `PARSER_STRATEGY` (default `pipeline` = regex + dictionary) via `services/parser/registry.ts`; every
  parse entry point funnels through `parseTitle()` → `getActiveParser()`, and all parsers go through
  the dictionary (normalize names + `resolveParsedMetadata` for IDs). Contract: `IParser`/`ParseResult`
  ([ADR 0006](docs/adr/0006-pluggable-parser.md)). Add a parser = implement `IParser` + register it.
- **K-pop dictionary refresh** (`@vidpulse/kpop-sources` → Wikidata) is **opt-in**
  (`KPOP_DICT_REFRESH_ENABLED=true`) and needs `query.wikidata.org` in the environment's egress
  allowlist + a descriptive `KPOP_SOURCES_USER_AGENT`. Manual trigger: `POST /api/kpop-dictionary/refresh`.
  Optional **MusicBrainz song enrichment** (full track-lists Wikidata lacks) is a separate opt-in
  (`MUSICBRAINZ_REFRESH_ENABLED=true`), bridged via Wikidata P434; it's slow (≤1 req/s) and needs
  `musicbrainz.org` allowlisted + `MUSICBRAINZ_USER_AGENT` ([ADR 0005](docs/adr/0005-musicbrainz-song-source.md)).
- **Config** is a typed, zod-validated `vidpulse.config.yaml` (`@vidpulse/config`, [ADR 0008](docs/adr/0008-config-format.md)):
  one file with a `default` section + `environments.<NODE_ENV>` overrides; the server and the knexfile
  both read it. `youtube.apiKey` is required for real syncs. The file is **gitignored** and **auto-created
  from defaults on startup** (auto-migrated with a `.bak` backup if its `version` is older) — keep real keys
  local. Adding a config field = bump `CURRENT_CONFIG_VERSION`; migrate = `npm run config:migrate`.
- **Config hot-reload:** when `watchConfig: true` (default) the server watches `vidpulse.config.yaml` and
  does an **in-process restart** on change (`resetConfig()` → close HTTP server + cron tasks → re-listen on
  the new `config.port`); an invalid edit is logged and ignored (stays on the old config). `port`,
  `parser.strategy`, and the cron schedules re-apply on reload; **`database.path` does not** (the knex
  singleton is created once at import) — changing the DB path still needs a full process restart.

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
