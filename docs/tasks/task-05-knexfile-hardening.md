# TASK-5 — Harden `knexfile.ts` (test DB, FK pragma, prod path)

**Status:** [ ] not started
**Priority:** medium
**Docs:** [Migrations review → F2](../migrations-review.md#f2--test-and-development-share-the-same-sqlite-file),
[F4](../migrations-review.md#f4--fk-enforcement-relies-on-the-driver-default),
[F8](../migrations-review.md#-minor)

**Why:** `test` and `development` share `dev.sqlite3` (risk of corrupting dev data under
`NODE_ENV=test`); FK enforcement relies on the `better-sqlite3` default because `afterCreate` never sets
`foreign_keys`; `production.filename` is cwd-relative while dev/test use `path.resolve`.

**Steps:**

- [ ] Point the `test` env at a separate file or `:memory:`; give it the same `pool.afterCreate` pragmas.
- [ ] Add `conn.pragma('foreign_keys = ON')` to every env's `afterCreate`.
- [ ] Resolve `production.filename` via `path.resolve(__dirname, …)` for cwd-independence.

**Files:** `src/db/knexfile.ts`.

**Acceptance:** test runs never touch `dev.sqlite3`; FK constraints enforced regardless of driver
default; prod path is cwd-independent; `npm test` green.

---

← back to [TODO](../../TODO.md)
