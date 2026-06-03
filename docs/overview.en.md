# VidPulse

> 🌐 **Languages:** **English** · [Русский](./overview.ru.md)
>
> 📚 **See also:** [Entities & Relationships](./entities.en.md)

VidPulse is a full-stack application for archiving and managing **K-pop video metadata**. It ingests videos from YouTube channels and playlists, automatically parses structured metadata from their titles (group, artist, song, performance date, event, fancam detection), lets you review and correct that metadata, and organizes everything against a curated dictionary of groups, artists, songs and events.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [NPM Scripts](#npm-scripts)
- [Project Structure](#project-structure)
- [Data Model](#data-model)
- [REST API](#rest-api)
- [Testing](#testing)
- [Conventions](#conventions)

---

## Features

- **YouTube ingestion** — add channels and playlists; videos are synced via the YouTube Data API (a scheduled cron job keeps them up to date).
- **Automatic metadata parsing** — a multi-stage parser extracts group, artist, song(s), performance date, event and camera type from a raw video title, and detects whether the clip is a fancam.
- **Multiple songs per video** — a video can reference several songs (e.g. a medley `Bubble + ASAP`); songs are stored in the `video_songs` junction table, the single source of truth.
- **Curated dictionary** — canonical groups, artists, songs and events with aliases, group memberships, and song↔artist/group links.
- **Review queue** — low-confidence parses are flagged for manual review and editing.
- **Tagging** — automatic tags (shorts, long, private) plus manual tags.
- **Optional LLM parsing** — fall back to a local OpenAI-compatible model (LM Studio) for hard-to-parse titles.
- **Audit & training data** — every edit is logged; confirmed metadata is captured as training data.

---

## Architecture

VidPulse is a monorepo with a layered backend and a React frontend.

```
┌─────────────┐     REST/JSON      ┌──────────────────────────────┐
│   Frontend  │ ◀────────────────▶ │            Backend           │
│ React + AntD│                    │  routes → services → repos   │
│   (Vite)    │                    │        ↓                     │
└─────────────┘                    │   Knex / better-sqlite3      │
                                   │        ↓                     │
                                   │      SQLite + YouTube API    │
                                   └──────────────────────────────┘
```

- **Routes** (`src/routes`) are thin HTTP controllers.
- **Services** (`src/services`) hold business logic (parser, dictionary, sync, tags, YouTube, AI).
- **Repositories** (`src/repositories`) wrap data access.
- Dependencies are wired in `src/compositionRoot.ts` (composition root / DI).

---

## Tech Stack

| Layer    | Technology                                                    |
| -------- | ------------------------------------------------------------- |
| Backend  | Node.js, TypeScript, Express 4                                |
| Database | SQLite via `better-sqlite3` + Knex query builder & migrations |
| Frontend | React 18, Ant Design 5, React Router 6, Vite                  |
| Testing  | Vitest (unit/integration), Playwright (E2E)                   |
| Tooling  | Prettier, Husky + lint-staged, ts-node / tsx, nodemon         |

---

## Prerequisites

- **Node.js 18+** and npm
- A **YouTube Data API key** (for syncing real videos)
- _(Optional)_ **LM Studio** or another local OpenAI-compatible endpoint for LLM-based parsing

---

## Getting Started

```bash
# 1. Clone and enter the repo
git clone <repo-url> VidPulse && cd VidPulse

# 2. Configure environment
cp .env.example .env
#   then edit .env and set YOUTUBE_API_KEY

# 3. One-shot setup: installs deps (root + client), runs migrations, launches BE+FE
npm run dev:all
```

`dev:all` is the fastest path. To run things manually:

```bash
npm install                                              # backend deps
cd client && npm install && cd ..                        # frontend deps
npx knex migrate:latest --knexfile src/db/knexfile.ts    # apply migrations
npm run launch                                           # backend + frontend together
```

- Backend runs on **http://localhost:3000** (`PORT`)
- Frontend dev server runs on **http://localhost:5173** (Vite)

---

## Environment Variables

Defined in `.env` (see `.env.example`):

| Variable                | Description                                       | Default                                     |
| ----------------------- | ------------------------------------------------- | ------------------------------------------- |
| `PORT`                  | Backend HTTP port                                 | `3000`                                      |
| `YOUTUBE_API_KEY`       | YouTube Data API key                              | —                                           |
| `LOG_YOUTUBE_API_CALLS` | Log every YouTube API call                        | `false`                                     |
| `SYNC_CRON_TIME`        | Cron expression for the sync scheduler            | `0 3 * * *`                                 |
| `HIDE_FLAGGED_VIDEOS`   | Hide flagged videos in listings                   | `false`                                     |
| `LM_STUDIO_API_URL`     | Local OpenAI-compatible chat-completions endpoint | `http://localhost:1234/v1/chat/completions` |
| `LM_STUDIO_MODEL`       | Model name to request                             | `local-model`                               |
| `LM_STUDIO_API_KEY`     | API key for the local endpoint (often blank)      | —                                           |
| `LM_STUDIO_TIMEOUT`     | LLM request timeout (ms)                          | `30000`                                     |

---

## NPM Scripts

**Root:**

| Script                 | Description                                 |
| ---------------------- | ------------------------------------------- |
| `npm run dev`          | Backend only (nodemon + ts-node)            |
| `npm run launch`       | Backend + frontend concurrently             |
| `npm run dev:all`      | Install + migrate + launch (full bootstrap) |
| `npm run build`        | Compile backend TypeScript to `dist/`       |
| `npm start`            | Run compiled backend                        |
| `npm test`             | Run Vitest unit/integration tests           |
| `npm run test:e2e`     | Run Playwright E2E tests                    |
| `npm run format`       | Format with Prettier                        |
| `npm run format:check` | Check formatting                            |
| `npm run backfill:*`   | One-off data backfill/maintenance scripts   |

**Client (`cd client`):**

| Script            | Description                   |
| ----------------- | ----------------------------- |
| `npm run dev`     | Vite dev server               |
| `npm run build`   | Type-check + production build |
| `npm run preview` | Preview the production build  |

---

## Project Structure

```
VidPulse/
├── src/                     # Backend
│   ├── routes/              # Express controllers (videos, channels, playlists, dictionary, parser, …)
│   ├── services/            # Business logic
│   │   ├── parser/          # Title → metadata parsing pipeline (active)
│   │   ├── sync/            # Channel/playlist sync from YouTube
│   │   └── …                # dictionary, youtube, ai, tag services
│   ├── repositories/        # Data-access layer
│   ├── models/ interfaces/ types/   # TypeScript definitions
│   ├── middleware/          # Express middleware
│   ├── scripts/             # Backfill / maintenance scripts
│   ├── db/                  # Knex config & SQLite connection
│   ├── compositionRoot.ts   # Dependency injection wiring
│   └── index.ts             # App entry point
├── client/                  # Frontend (React + Vite)
│   └── src/
│       ├── pages/           # Route-level screens
│       ├── components/      # Reusable UI (VideoTable, VideoCard, ReviewQueue, …)
│       ├── api/ api.ts      # API client layer
│       ├── hooks/ utils/
├── migrations/              # Knex migrations (schema source of truth)
├── tests/e2e/               # Playwright E2E tests & page objects
├── docs/                    # ADRs, API notes, audits
└── CLAUDE.md                # Contributor conventions & workflow
```

---

## Data Model

> For full table-by-table columns, keys and an ER diagram, see **[Entities & Relationships](./entities.en.md)**.

Core entities (defined across `migrations/`):

- **`videos`** — ingested videos with denormalized metadata fields and FKs to `channels`, `playlists`, `video_lists`, `duplicate_groups`.
- **`channels`, `playlists`** — YouTube sources.
- **Dictionary:** `dictionary_groups`, `dictionary_artists`, `dictionary_songs`, `dictionary_events`, plus `dictionary_aliases` for alternate spellings.
- **Many-to-many links:**
  - `video_songs` — videos ↔ songs (**single source of truth for a video's songs**)
  - `video_tags` — videos ↔ tags
  - `dictionary_song_artists`, `dictionary_song_groups` — songs ↔ artists/groups
  - `dictionary_artist_memberships` — artists ↔ groups
- **Auxiliary:** `status_history`, `training_data`, `event_log`, `tags`, `video_lists`.

> **Note:** `videos.song_id` / `videos.song_title` are legacy denormalized columns kept for backward compatibility; the authoritative set of songs for a video lives in `video_songs`.

---

## REST API

All endpoints are mounted under `/api`:

| Base path          | Purpose                                                |
| ------------------ | ------------------------------------------------------ |
| `/api/channels`    | Manage and load YouTube channels                       |
| `/api/playlists`   | Manage and load YouTube playlists                      |
| `/api/videos`      | List/get/update videos, metadata, tags, reparse/resync |
| `/api/dictionary`  | Groups, artists, songs, events, aliases, media library |
| `/api/parser`      | Reparse / LLM-parse endpoints                          |
| `/api/sync`        | Trigger/manage syncs                                   |
| `/api/events`      | Audit event log                                        |
| `/api/settings`    | App settings                                           |
| `/api/video-lists` | Custom video collections                               |

---

## Testing

```bash
npm test          # Vitest (unit/integration)
npm run test:e2e  # Playwright (E2E; spins up backend with a mocked YouTube API)
```

Unit tests live next to the code (`src/**/*.test.ts`). Tests that exercise the database use an in-memory SQLite instance — see `src/services/parser/videoSongs.service.test.ts` for the mocking pattern. E2E tests and page objects live in `tests/e2e/`.

---

## Conventions

See [`CLAUDE.md`](../CLAUDE.md) for the full contributor guide. Highlights:

- Work on feature branches; never commit directly to the default branch.
- **Commits** follow Conventional Commits: `<type>(<scope>): <subject>` (`feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`).
- Keep **routes thin** and put logic in **services**.
- Create schema changes via `npx knex migrate:make <name>` and apply with `npx knex migrate:latest --knexfile src/db/knexfile.ts`.
- Run `npm run format` before committing (a Husky pre-commit hook also formats staged files).
