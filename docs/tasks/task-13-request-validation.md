# TASK-13 — Standardize request validation (ajv)

**Status:** [x] done
**Priority:** medium
**Docs:** [Code review → C7](../code-review.md#c7--no-standardized-request-validation)

**Why:** `ajv` is already a dependency but used only for the media-library schema; API request bodies are
validated ad-hoc and inconsistently per route.

**Steps:**

- [ ] Add a small `validate(schema)` middleware using `ajv` (+ `ajv-formats`, already present).
- [ ] Define request schemas for the main write endpoints (videos, dictionary, video-lists, sync,
      parser); replace hand-written per-route validators.
- [ ] Return 400 with a consistent error body (aligned with [TASK-10](./task-10-error-handling.md)).

**Files:** new `src/middleware/validate.ts`, `src/routes/**`, shared schema definitions.

**Acceptance:** write endpoints reject invalid bodies with a consistent 400; no bespoke per-route
validation left for covered endpoints; tests cover valid/invalid cases.

---

← back to [TODO](../../TODO.md)
