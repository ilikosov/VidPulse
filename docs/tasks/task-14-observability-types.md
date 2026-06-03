# TASK-14 — Observability & type-safety polish

**Status:** [ ] not started
**Priority:** low
**Docs:** [Code review → C8](../code-review.md#-minor), [C9](../code-review.md#-minor)

**Why:** ~64 `console.*` calls and no structured logger (only `morgan` for HTTP); ~67 `any` / `as any`
in non-test code despite `strict: true`.

**Steps:**

- [ ] Introduce a small logger (pino/winston or a thin wrapper) with levels and test-time silencing;
      replace `console.*` in `src/`.
- [ ] Reduce `any` / `as any`, especially around knex rows and external API payloads (type knex results,
      type YouTube/LLM responses).

**Files:** new `src/lib/logger.ts`, `src/**`.

**Acceptance:** no raw `console.*` in `src/` (outside the logger); measurable drop in `any`; tests green.

---

← back to [TODO](../../TODO.md)
