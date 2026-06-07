# TASK-19 — Promote frontend API contracts into shared workspace package

**Status:** Not started
**Priority:** medium
**Docs:** [ADR 0003 — Migrate to a monorepo (npm workspaces)](../adr/0003-monorepo.md), [TASK-8](./task-08-monorepo.md)
**Depends on:** [TASK-8](./task-08-monorepo.md)

**Why:** the frontend now has a single request helper and a temporary local contract module in
`client/src/api/types.ts`, but those DTOs should ultimately live in the shared workspace package planned
by TASK-8. Keeping route response/request contracts in a workspace package lets the server and web app
share the same video, dictionary, pagination, and error shapes instead of drifting independently.

**Steps:**

- [ ] After TASK-8 creates `packages/shared`, move the temporary frontend DTO/request definitions from
      `client/src/api/types.ts` into the shared package.
- [ ] Export request DTOs that mirror backend schemas in `src/schemas/request/`, including video metadata,
      batch tags, dictionary CRUD, URL-add, and settings payloads.
- [ ] Export response DTOs that mirror actual route responses from `src/routes/*.ts`, including video,
      dictionary, pagination, parser, channel, playlist, event-log, import, and batch operation responses.
- [ ] Update the frontend API modules to import contracts from the shared package instead of local
      `client/src/api/types.ts`.
- [ ] Update backend route/service typings to reuse the same shared contracts where practical.

**Files:** `packages/shared/**` (after TASK-8), `client/src/api/types.ts`, `client/src/api.ts`,
`client/src/api/dictionary.ts`, `src/schemas/request/*.json`, `src/routes/*.ts`.

**Acceptance:** frontend and backend compile against shared API contracts; `client/src/api/types.ts` is
removed or reduced to frontend-only adapter types; dictionary/video response interfaces are not duplicated
between apps; shared request DTOs stay aligned with backend request schemas.

---

← back to [TODO](../../TODO.md)
