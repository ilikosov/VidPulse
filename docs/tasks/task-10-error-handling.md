# TASK-10 — Central error handling, 404, and async wrapper

**Status:** [ ] not started
**Priority:** high
**Docs:** [Code review → C2](../code-review.md#c2--no-central-error-handling--404-handler)

**Why:** `src/index.ts` has no error-handling middleware and no 404 handler; routes hand-roll `try/catch`
with inconsistent 500 shapes, and Express 4 won't catch errors thrown in `async` handlers that forget a
`try/catch`.

**Steps:**

- [ ] Add a terminal error-handling middleware (after all routes) returning a consistent error body
      `{ error: { message, code? } }` with proper status codes; log via the logger (see
      [TASK-14](./task-14-observability-types.md)).
- [ ] Add a 404 fallthrough for unmatched `/api/*` routes.
- [ ] Add an `asyncHandler(fn)` wrapper (or `express-async-errors`) and apply it so handlers can drop the
      boilerplate `try/catch`.
- [ ] Introduce a small `AppError`/`HttpError` type for intentional 4xx responses.

**Files:** `src/index.ts`, new `src/middleware/errorHandler.ts`, `src/middleware/asyncHandler.ts`,
`src/routes/*.routes.ts`.

**Acceptance:** thrown/rejected errors yield a consistent JSON error with the right status; unknown routes
return 404; handlers no longer need manual `try/catch`; tests cover the error + 404 paths.

---

← back to [TODO](../../TODO.md)
