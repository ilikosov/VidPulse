import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfigForEnv } from '@vidpulse/config';

// The DB layer lives in the @vidpulse/db workspace package; its knexfile now reads the DB path from
// vidpulse.config.yaml (per-environment `database.path`). Migrations/seeds run via the knex CLI.
const KNEXFILE = '../../packages/db/src/knexfile.ts';

/**
 * Vitest global setup: provision a dedicated, migrated test database once before the suite runs.
 * Tests that use the real knex singleton (NODE_ENV=test) then see the full migrated schema + seed
 * data — no dependency on a pre-existing dev.sqlite3.
 */
export default async function setup() {
  process.env.NODE_ENV = 'test';

  // The test DB path comes from the config file's `test` section (already resolved to absolute).
  const filename = loadConfigForEnv('test').database.path;

  // Start from a clean DB so migrations (and their seed data) are deterministic.
  for (const f of [filename, `${filename}-shm`, `${filename}-wal`]) {
    fs.rmSync(f, { force: true });
  }
  fs.mkdirSync(path.dirname(filename), { recursive: true });

  // Run migrations through the knex CLI (like `npm run dev:all`). We preload tsx (NODE_OPTIONS) so the
  // TypeScript knexfile + migration files load — TypeScript 7's native compiler no longer exposes the
  // JS API that ts-node needs, so tsx (esbuild) is the loader. The knexfile resolves the DB path from
  // the config file (found by walking up from the knexfile dir), so no DATABASE_PATH plumbing is needed
  // — only NODE_ENV=test to select the environment.
  const childEnv = { ...process.env, NODE_ENV: 'test', NODE_OPTIONS: '--import tsx' };

  execFileSync('npx', ['knex', 'migrate:latest', '--knexfile', KNEXFILE], {
    stdio: 'inherit',
    env: childEnv,
  });

  execFileSync('npx', ['knex', 'seed:run', '--knexfile', KNEXFILE], {
    stdio: 'inherit',
    env: childEnv,
  });
}
