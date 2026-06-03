import fs from 'fs';
import path from 'path';
import Knex from 'knex';
import config from '../src/db/knexfile';

/**
 * Vitest global setup: provision a dedicated, migrated test database once before
 * the suite runs. Tests that use the real knex singleton (NODE_ENV=test) then see
 * the full migrated schema + seed data — no dependency on a pre-existing dev.sqlite3.
 */
export default async function setup() {
  process.env.NODE_ENV = 'test';

  const testConfig = config.test;
  const filename = (testConfig.connection as { filename: string }).filename;

  // Start from a clean DB so migrations (and their seed data) are deterministic.
  for (const f of [filename, `${filename}-shm`, `${filename}-wal`]) {
    fs.rmSync(f, { force: true });
  }
  fs.mkdirSync(path.dirname(filename), { recursive: true });

  const knex = Knex(testConfig);
  try {
    await knex.migrate.latest();
  } finally {
    await knex.destroy();
  }
}
