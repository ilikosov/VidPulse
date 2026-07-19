import type { Knex } from 'knex';
import path from 'path';
import { loadConfigForEnv } from '@vidpulse/config';

const SEEDS_DIR = path.resolve(__dirname, '../seeds');
const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');

// DB paths come from vidpulse.config.yaml (per-environment `database.path`, resolved to absolute).
const DEV_DB = loadConfigForEnv('development').database.path;
const TEST_DB = loadConfigForEnv('test').database.path;
const PROD_DB = loadConfigForEnv('production').database.path;

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
