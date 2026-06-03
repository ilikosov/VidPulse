# TASK-9 — Remove dead code & unused dependency

**Status:** [x] done (in the TASK-15 PR — `parser_new` deleted, `sqlite3` removed).
**Priority:** medium
**Docs:** [Code review → C1](../code-review.md#c1--dead-code-srcservicesparser_new),
[C3](../code-review.md#c3--unused-dependency-sqlite3)

**Why:** `src/services/parser_new/` (~500 LOC) has zero references and shadows the active
`src/services/parser/`; `package.json` depends on both `sqlite3` and `better-sqlite3` while only
`better-sqlite3` is used.

**Steps:**

- [ ] Confirm `src/services/parser_new/` is unused (grep across `src/`, scripts, tests) and delete it —
      or, if it is the intended replacement, wire it in and remove the old parser.
- [ ] Remove `sqlite3` from `package.json` dependencies; `npm install` to refresh the lockfile.

**Files:** `src/services/parser_new/`, `package.json`, `package-lock.json`.

**Acceptance:** no dead `parser_new`; `sqlite3` gone; `npm test`, `npm run test:e2e` and the build green.

> Note: removing `parser_new` also deletes its failing test suite —
> ~169 of the current 175 `npm test` failures (see
> [Code review → C10](../code-review.md#c10--the-dead-parser_new-suite-is-97-of-the-failures)).

---

← back to [TODO](../../TODO.md)
