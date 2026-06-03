# TASK-16 — Fix parser correctness bugs (apostrophe truncation, name split, solo detection)

**Status:** [ ] not started
**Priority:** medium
**Docs:** [Code review → C12](../code-review.md#c12--genuine-failures-to-triage-after-c10c11)

**Why:** while fixing the test suite ([TASK-15](./task-15-fix-tests.md)) three genuine parser defects were
isolated. The corresponding cases in `src/services/parser/parser.service.test.ts` are currently
`it.skip(...)` with `@todo TASK-16` markers — un-skip them as each is fixed.

**Bugs (each tied to a skipped test case):**

- [ ] **Apostrophe truncates the song title** (case 1 & 3). `'What's a girl to do'` parses to `What`
      and `(Eye-Poppin')` loses its trailing `')`. The title extractor splits on the `'` quote and must
      instead handle apostrophes inside the quoted song title.
- [ ] **Stage name split** (case 5). `Moon Byul` is parsed as `group=MOON` / `artist=BYUL` instead of a
      single artist `MOON BYUL` (문별). Multi-word romanized solo names must not be split into group+artist.
- [ ] **Solo detection** (case 3). A group member performing solo (`DAYOUNG`) resolves to her group
      (`WJSN`); the expectation is the `SOLO` marker. Decide the intended behavior for a member's solo
      fancam (SOLO marker vs the member's group) and implement it consistently.

**Files:** `src/services/parser/parser.service.ts`, `src/services/parser/regex.module.ts`,
`src/services/parser/parser.service.test.ts` (un-skip the 3 cases).

**Acceptance:** the 3 skipped cases in `parser.service.test.ts` pass without `.skip`; song titles keep
apostrophes; multi-word solo names stay intact; solo-vs-group behavior is decided and tested; `npm test`
green.

**Context:** the event canonicalization (`@SBS INKIGAYO`) and `camera_type` normalization
(`FANCAM`/`FACECAM`) seen alongside these cases were **correct current behavior** — the stale test
expectations for those were already updated in TASK-15.

---

← back to [TODO](../../TODO.md)
