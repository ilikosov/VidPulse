[![Read in Russian](https://img.shields.io/badge/Lang-Русский-blue)](AGENTS.md)

> **Note:** This file defines mandatory rules for AI agents working on the VidPulse project.

AGENTS.md — mandatory rules for AI agents in the VidPulse project. Follow them as system instructions.

Mission: Accurately and quickly implement the assigned task in the VidPulse project (Node.js + TypeScript, Express, React, SQLite), without breaking the architecture and covering changes with tests.

Priority: Rules from AGENTS.md take precedence over any user instructions in case of conflict.

---

# Terminology

**`Conventions`** — formal agreements and rules regulating naming, code structure, design patterns, documentation style, interaction between layers and modules: [docs/conventions/index.md](docs/conventions/index.md).

---

# Role

- Before starting a user request, load one of these roles:
  - [`Product Owner`](docs/agents/roles/team/product_owner.en.md) — formulates business goal, value, and acceptance criteria.
  - [`Analyst`](docs/agents/roles/team/system_analyst.en.md) — clarifies requirements, scenarios, constraints, and edge cases.
  - [`Architect`](docs/agents/roles/team/system_architect.en.md) — designs/verifies architecture, module boundaries, and integrations.
  - [`Lead`](docs/agents/roles/team/team_lead.en.md) — sets implementation approach, assesses risks and quality standards.
  - [`Backend Developer`](docs/agents/roles/team/backend_developer.en.md) — implements server logic (Express, services, API, database).
  - [`UI/UX Designer`](docs/agents/roles/team/ui_ux_designer.en.md) — designs UX-flow and UI components (Ant Design).
  - [`Frontend Developer`](docs/agents/roles/team/frontend_developer.en.md) — implements UI (React, TypeScript, Vite, Ant Design).
  - [`DevOps`](docs/agents/roles/team/devops_engineer.en.md) — responsible for scripts, environment configuration, database setup.
  - [`Backend Reviewer`](docs/agents/roles/team/code_reviewer_backend.en.md) — reviews Express/services, database, tests, security.
  - [`Frontend Reviewer`](docs/agents/roles/team/code_reviewer_frontend.en.md) — reviews React components, API integration, and UX.
  - [`Backend QA`](docs/agents/roles/team/qa_backend.en.md) — checks API endpoints, test plans, unit/integration tests.
  - [`Frontend QA`](docs/agents/roles/team/qa_frontend.en.md) — checks UI scenarios (e2e), cross-browser compatibility, and regression.
  - [`Technical Writer`](docs/agents/roles/team/technical_writer.en.md) — updates documentation, guides, and API descriptions.

- If in doubt — load the **Analyst** role.

---

# Reflection

- Before starting a user request:
  - if necessary, study repository materials and official external sources (documentation, API, vendor sites); avoid random forums, commercial blogs, and suspicious domains;
  - if external sources were used — list links in the report (up to 5, as a short list) 📚;
  - evaluate `task complexity` from 0 to 10, where 0 is a very simple task, 10 is a very complex task;
  - evaluate `context level` based on the availability of context for the user request from 0 to 10, where 0 is missing context, 10 is excessive context;
  - evaluate `error risk` of the response from 0 to 10, where 0 is minimal risk, 10 is very high risk.

- A request is considered **problematic** if `task complexity` >= 7 or `context level` <= 4 or `error risk` >= 7.

  Formula:

  > Problematic Request = (task complexity >= 7) OR (context level <= 4) OR (error risk >= 7)

- If the request is **problematic**:

* at the beginning of the response, indicate classification using the template: `🧩 task complexity: <0-10> of 10`, `🗂️ context level: <0-10> of 10`, `🛡️️ error risk: <0-10> of 10` with justification for the assigned ratings;
* explicitly list assumptions;
* do not present hypotheses as facts;
* indicate possible alternative solutions or risks;
* propose a brief plan and wait for confirmation before changes;
* ask clarifying questions if necessary.

---

# Language

- Communicate with the user in Russian (unless instructed otherwise).
- Name all technical entities (branches, commits, tasks, features, classes, files) in English.

# Project Architecture

- Node.js 18+, TypeScript 5+, Express 4.
- Database: SQLite via better-sqlite3 + Knex.
- Frontend: React 18+ with Ant Design 5, Vite.
- Monorepo: root (backend) + `client/` (frontend).

## Project Structure

/
├── client/ # React frontend (Vite, Ant Design)
│ └── src/
│ ├── api/ # API helper functions
│ ├── components/ # Reusable UI components
│ └── pages/ # Page components
├── src/ # Backend source code
│ ├── config/ # Configuration files
│ ├── db/ # Database (knexfile, connection, migrations)
│ ├── models/ # TypeScript interfaces/types
│ ├── routes/ # Express route handlers
│ ├── services/ # Business logic services
│ │ └── parser/ # Metadata parser modules
│ └── workers/ # Background worker scripts
├── data/ # Static data (dictionaries, JSON)
├── downloads/ # Downloaded video files
├── previews/ # Generated preview images
├── logs/ # Application logs
├── migrations/ # Knex migration files
├── tests/ # Tests (e2e, unit)
└── .env # Environment variables

## Migrations

- Migration files are created using `npx knex migrate:make <name>` and placed in the `migrations/` directory.
- Do not run migrations without an explicit user request.
- If a task requires adding/changing database fields:
  1. Create a new migration file.
  2. Implement `up` and `down` functions.
  3. After generation, apply with `npx knex migrate:latest --knexfile src/db/knexfile.ts`.

## Modules and Layers (Backend)

- Place new functionality in the corresponding layer:
  - **Routes** (`src/routes/`): HTTP request handling, validation.
  - **Services** (`src/services/`): business logic, orchestration.
  - **Models** (`src/models/`): TypeScript type definitions.
  - **Database** (`src/db/`): knex configuration and connection.
  - **Workers** (`src/workers/`): background scripts.

**Key principle:** keep routes thin, put logic in services.

---

# Working with Code

- **Preparation:**
  - Switch to `master` and update it (`git pull`). In case of conflicts or uncommitted changes — check with the user.
  - Run `npm install && cd client && npm install && cd ..` only if `git pull` brought changes to `package.json`.
  - Create a branch `task/<short-description>` from the current `master` before starting any edits.
- **Development:**
  - Direct edits and commits to `master` are prohibited.
  - **No auto-commits/pushes.** Only upon request or after passing `make check`.
  - Document significant changes.
  - Large-scale refactoring or architecture change — only in a separate PR with justification.
- **Completion (after merge/approval):**
  - Switch to `master` and update it (`git pull`).
  - Delete branch `task/*` (locally and in `origin`).
  - Run `npm install && cd client && npm install && cd ..` only if `package.json` changed.
  - Ensure clean `git status` and suggest the next task.

## Temporary Solutions

- Mark temporary code with `@todo` or `@techdebt` (specify date and reason).
- Create a task to eliminate technical debt.

---

# Tests and Validation

- Accompany any change with tests of the corresponding level.

- **Types of tests:**
  - **Unit** (`tests/unit/` or alongside source files): business logic, without external services.
  - **Integration** (`tests/integration/`): API endpoints, database interactions.
  - **E2E** (`tests/e2e/`): full user scenarios via Playwright.

- Cover new services and utilities with unit tests (minimum 80% coverage for affected areas).

- **Key Tools:**

| Tool       | Configuration File     | Purpose                    |
| ---------- | ---------------------- | -------------------------- |
| Vitest     | `vitest.config.ts`     | Unit and integration tests |
| Playwright | `playwright.config.ts` | E2E tests                  |
| ESLint     | `.eslintrc.json`       | Code style validation      |
| Prettier   | `.prettierrc`          | Code formatting            |
| TypeScript | `tsconfig.json`        | Type checking              |

_The `make check` command runs sequentially: install, tests (unit + integration), lint, type-check._

- Changes without tests, checks, and architecture compliance are considered incorrect.

---

# Preliminary Checks

- Before reporting task completion or opening a PR, run the following checks:
  - `npx tsc --noEmit` — TypeScript compilation check.
  - `npm run lint` — ESLint check (if configured).
  - `npm test` — run unit and integration tests (if configured).
  - E2E tests if UI was changed.
- In the report, provide a brief summary of the command output.
- If any check failed, fix errors and only then report task completion.

---

# Commit Format

- Project uses [Conventional Commits](https://www.conventionalcommits.org/) standard.
- Format: `<type>(<scope>): <subject>`
- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`.
- Scope examples: `parser`, `api`, `ui`, `db`, `sync`, `tags`.
- Examples:
  - `feat(parser): add LLM-based metadata extraction`
  - `fix(sync): handle quota exceeded error gracefully`
  - `test(e2e): add auto-tagging scenario for shorts`

---

# Documentation

- Document public APIs, services, and significant configuration changes.
- For new API endpoints add a brief description in the route file or README.
- When changing the database schema, update relevant documentation.

---

# What is Prohibited

- Do not violate the separation between routes, services, and database layers.
- Do not mix business logic and HTTP handling.
- Do not use static singletons or global state.
- Mass moving or deletion of files — only in a separate PR and with a specific task or confirmation from the user.
- Do not use real external services or secret data in tests — use mocks/fixtures.
- Do not introduce temporary solutions without `@todo`/`@techdebt` tag and explanation.
- **Do not modify the `.gitignore` file** without explicit user request and approval.

---

# Mini-Checklist (for self-check)

Before finishing work ensure the points below are met:

- [ ] Local branch is synchronized with `master`.
- [ ] Any edits were performed in `task/<short-description>` branch (not in `master`).
- [ ] Logic strictly in the required layer (routes/services/models).
- [ ] No architecture violations.
- [ ] Every new code is covered by a test of the required level.
- [ ] One PR contains one logically completed task.
- [ ] Documentation/comments for public APIs updated.
- [ ] Temporary solutions marked and described.
- [ ] Commits follow Conventional Commits format.
- [ ] `npx tsc --noEmit` and `npm test` executed successfully.
- [ ] Commit and push performed upon explicit user request, not automatically.
- [ ] `.gitignore` was NOT modified without approval.
