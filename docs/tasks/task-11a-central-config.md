# TASK-11A — Centralize runtime configuration parsing and validation

**Status:** [ ] not started
**Priority:** medium
**Docs:** [Code review → C4](../code-review.md#c4--import-time-side-effects-in-srcindexts)

**Why:** environment parsing and defaults are currently spread across app entrypoints, routes, middleware,
and services. Centralizing config makes startup failures clearer, keeps service imports side-effect-free for
tests, and reduces drift between runtime behavior and `.env.example`.

**Steps:**

- [ ] Introduce a central config module, for example `src/config.ts` or `src/config/index.ts`.
- [ ] Move environment parsing/defaults into that module for:
  - `PORT`;
  - `YOUTUBE_API_KEY`;
  - `LOG_YOUTUBE_API_CALLS`;
  - `SYNC_CRON_TIME`;
  - `LM_STUDIO_API_URL` / `LM_STUDIO_URL`;
  - `LM_STUDIO_MODEL`;
  - `LM_STUDIO_TIMEOUT`;
  - `LM_STUDIO_API_KEY`;
  - `MEDIA_LIBRARY_DANGEROUS_ACTIONS_ENABLED`;
  - `MAX_VIDEO_LIST_ITEMS`;
  - `HIDE_FLAGGED_VIDEOS`.
- [ ] Validate numeric and boolean settings once at startup.
- [ ] Avoid throwing at import time from service modules such as `src/services/youtube.service.ts`; surface
      missing required config when constructing or using the service.
- [ ] Update `.env.example` so every supported variable is documented.

**Files:** `src/config.ts` or `src/config/index.ts`, `src/index.ts`, `src/services/youtube.service.ts`,
`src/services/ai.service.ts`, `src/services/sync.service.ts`, `src/middleware/dangerousActions.ts`,
`src/routes/video-lists.routes.ts`, `src/routes/video.routes.ts`, `.env.example`, tests.

**Acceptance:**

- [ ] No direct `process.env.*` reads outside the config module except test setup.
- [ ] Missing/invalid required config produces a clear startup error.
- [ ] Importing modules in tests does not fail solely because optional production env vars are absent.

---

← back to [TODO](../../TODO.md)
