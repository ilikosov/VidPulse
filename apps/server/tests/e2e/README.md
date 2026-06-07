# E2E tests (Playwright)

This suite validates critical user flows in the K-pop Archive Manager UI + API.

## What it covers

- Adding a channel (with mocked YouTube API responses) and verifying synced videos.
- Manual metadata review flow (`needs_review` -> `new`).
- Batch "Confirm Download Selected" status updates.

## Test database isolation

- A dedicated SQLite file is used: `dev.test.sqlite3`.
- `globalSetup` creates a symlink from `src/db/dev.sqlite3` to `dev.test.sqlite3`, runs migrations, and resets downloads.
- `globalTeardown` removes the test DB and restores any pre-existing development DB file.

## Running

From project root:

```bash
npm run test:e2e
```

Playwright will start:

- backend on `http://127.0.0.1:3000`
- frontend on `http://127.0.0.1:5173`

YouTube API calls are mocked through `tests/e2e/setup/youtube-mock.cjs` using fixture data in `tests/e2e/fixtures/`.
