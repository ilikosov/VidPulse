import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import config from '../src/db/knexfile';

/**
 * Vitest global setup: provision a dedicated, migrated test database once before
 * the suite runs. Tests that use the real knex singleton (NODE_ENV=test) then see
 * the full migrated schema + seed data — no dependency on a pre-existing dev.sqlite3.
 */
export default async function setup() {
  process.env.NODE_ENV = 'test';

  const filename = (config.test.connection as { filename: string }).filename;

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
  execFileSync('npx', ['knex', 'migrate:latest', '--knexfile', 'src/db/knexfile.ts'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test' },
  });

  execFileSync('npx', ['knex', 'seed:run', '--knexfile', 'src/db/knexfile.ts'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test' },
  });
}
