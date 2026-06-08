import type { Knex } from 'knex';
import path from 'path';

const SEEDS_DIR = path.resolve(__dirname, '../../seeds');
const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

if (!process.env.DATABASE_PATH) {
  throw new Error('Missing required env var: DATABASE_PATH');
}
if (!process.env.TEST_DATABASE_PATH) {
  throw new Error('Missing required env var: TEST_DATABASE_PATH');
}
const DEV_DB = process.env.DATABASE_PATH;
const TEST_DB = process.env.TEST_DATABASE_PATH;
const PROD_DB = process.env.DATABASE_PATH;

const sharedPool = {
  afterCreate: (conn: any, done: any) => {
    conn.pragma('journal_mode=WAL');
    conn.pragma('foreign_keys = ON');
    conn.pragma('busy_timeout=5000');
    done(null, conn);
  },
};

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'better-sqlite3',
    connection: { filename: DEV_DB },
    useNullAsDefault: true,
    pool: sharedPool,
    migrations: { directory: MIGRATIONS_DIR },
    seeds: { directory: SEEDS_DIR },
  },

  test: {
    client: 'better-sqlite3',
    connection: { filename: TEST_DB },
    useNullAsDefault: true,
    pool: sharedPool,
    migrations: { directory: MIGRATIONS_DIR },
    seeds: { directory: SEEDS_DIR },
  },

  production: {
    client: 'better-sqlite3',
    connection: { filename: PROD_DB },
    useNullAsDefault: true,
    pool: sharedPool,
    migrations: { directory: MIGRATIONS_DIR },
    seeds: { directory: SEEDS_DIR },
  },
};

export default config;
