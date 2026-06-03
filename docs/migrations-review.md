# Migrations & DB config review

Findings from a review of the Knex migrations in [`migrations/`](../migrations) and the DB config in
`src/db/knexfile.ts`. All migrations apply cleanly on a fresh DB (17/17, SQLite 3.53 via
`better-sqlite3`); the items below are correctness/hygiene issues worth fixing, ranked by severity.

> Actionable items are tracked in [`TODO.md`](../TODO.md) (TASK-4…7).

---

## 🔴 Worth fixing

### F1 — Duplicate indexes on `videos`

`migrations/20260423161338_create_tables.ts` indexes the same columns twice — once via the schema
builder and once via raw SQL:

```ts
table.index('status'); // → videos_status_index
table.index('duplicate_group_id'); // → videos_duplicate_group_id_index
// ...later, raw:
knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);');
knex.schema.raw(
  'CREATE INDEX IF NOT EXISTS idx_videos_duplicate_group ON videos(duplicate_group_id);',
);
```

Verified on a built DB — both pairs exist: `idx_videos_status` + `videos_status_index`, and
`idx_videos_duplicate_group` + `videos_duplicate_group_id_index`. Redundant write overhead and storage.
**Fix:** drop the redundant `idx_videos_*` (raw) indexes via a new migration; keep one per column.

### F2 — `test` and `development` share the same SQLite file

In `knexfile.ts` both environments use `./dev.sqlite3`:

```ts
test: {
  connection: {
    filename: path.resolve(__dirname, './dev.sqlite3');
  }
}
```

Running anything under `NODE_ENV=test` operates on dev data — risk of corruption/races. The `test` env
also lacks the `busy_timeout`/WAL `pool.afterCreate` the other envs have.
**Fix:** point `test` at a separate file or `:memory:`; add the same pragmas.

### F3 — Schema and seed data mixed in migrations

`migrations/20260504110000_dictionary_db.ts` (large `GROUPS`/`EVENTS` arrays),
`20260428123000_add_tags_and_video_duration.ts` and `20260428143000_ensure_private_tag.ts` insert
reference/seed data inside migrations. Issues:

- seed data belongs in `seeds/`, not migrations (a migration = structure);
- hard-coded Russian tag names (`'длинное видео'`, `'игнорировать видео'`) couple schema to UI strings;
- inserts use manual string interpolation with a hand-rolled `esc()` instead of parameterized
  `knex(...).insert({...})`.

**Fix:** move seeds to `seeds/`; use parameterized inserts; de-hardcode UI tag strings.

---

## 🟡 Architectural (not bugs)

### F4 — FK enforcement relies on the driver default

`PRAGMA foreign_keys = ON` is set once inside `create_tables` (per-connection, doesn't affect runtime).
`knexfile.afterCreate` sets `journal_mode` and `busy_timeout` but **not** `foreign_keys`. FKs currently
work only because `better-sqlite3` enables them by default — implicit and fragile.
**Fix:** add `conn.pragma('foreign_keys = ON')` to every env's `afterCreate`.

### F5 — `ALTER TABLE … ADD CONSTRAINT CHECK` is non-standard SQLite

`20260515103000_add_artist_memberships.ts` adds CHECK constraints via `ALTER TABLE … ADD CONSTRAINT`.
It applies and is enforced in the current stack (SQLite 3.53 / better-sqlite3), but this is not standard
SQLite ALTER syntax — a portability risk if the driver/version changes.
**Fix:** define the CHECK constraints inside `createTable` instead.

### F6 — `updated_at` is not auto-updated

`updated_at` columns have `defaultTo(now)` but no UPDATE trigger — the value only changes if the app
writes it explicitly.
**Fix:** add a trigger, or document/enforce that repositories always set `updated_at` on update.

---

## 🟢 Minor

- **F7 — Mixed column types:** `create_tables` uses `string()` (VARCHAR); dictionary migrations use
  `text()`. No functional difference in SQLite, but inconsistent.
- **F8 — `production.filename` is relative:** `'src/db/prod.sqlite3'` depends on cwd, whereas dev/test
  use `path.resolve(__dirname, …)`. Make production path resolution consistent.
- **F9 — `'private'` tag inserted twice:** in `add_tags_and_video_duration` and `ensure_private_tag`
  (the latter `INSERT OR IGNORE`). Harmless (unique constraint), but redundant.
