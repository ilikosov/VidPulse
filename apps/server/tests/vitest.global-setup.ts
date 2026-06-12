import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// The DB layer now lives in the @vidpulse/db workspace package. Migrations and
// seeds run through its knexfile via the knex CLI (paths relative to apps/server cwd).
const KNEXFILE = '../../packages/db/src/knexfile.ts';

/**
 * Vitest global setup: provision a dedicated, migrated test database once before
 * the suite runs. Tests that use the real knex singleton (NODE_ENV=test) then see
 * the full migrated schema + seed data — no dependency on a pre-existing dev.sqlite3.
 */
export default async function setup() {
  process.env.NODE_ENV = 'test';

  // knexfile resolves the test connection to TEST_DATABASE_PATH, so read it directly.
  const filename = process.env.TEST_DATABASE_PATH!;

  // Start from a clean DB so migrations (and their seed data) are deterministic.
  for (const f of [filename, `${filename}-shm`, `${filename}-wal`]) {
    fs.rmSync(f, { force: true });
  }
  fs.mkdirSync(path.dirname(filename), { recursive: true });

  // Run migrations through the knex CLI (like `npm run dev:all`). The CLI
  // auto-registers ts-node, so the TypeScript migration files load correctly.
  // Calling knex.migrate.latest() in-process relies on the runtime already
  // handling `.ts` requires, which fails under a clean `npm ci` on CI
  // (SyntaxError: Unexpected token '{').
  // knex CLI changes cwd to the knexfile directory, so relative DATABASE_PATH
  // values break. Resolve to absolute paths before passing to the child process.
  const absEnv = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_PATH: path.resolve(process.env.DATABASE_PATH!),
    TEST_DATABASE_PATH: path.resolve(process.env.TEST_DATABASE_PATH!),
  };

  execFileSync('npx', ['knex', 'migrate:latest', '--knexfile', KNEXFILE], {
    stdio: 'inherit',
    env: absEnv,
  });

  execFileSync('npx', ['knex', 'seed:run', '--knexfile', KNEXFILE], {
    stdio: 'inherit',
    env: absEnv,
  });
}
