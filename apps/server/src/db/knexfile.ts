import type { Knex } from 'knex';
import path from 'path';

const SEEDS_DIR = path.resolve(__dirname, '../../seeds');
const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

const DEV_DB = process.env.DATABASE_PATH ?? path.resolve(__dirname, './dev.sqlite3');
const TEST_DB = process.env.TEST_DATABASE_PATH ?? path.resolve(__dirname, './dev.test.sqlite3');
const PROD_DB = process.env.DATABASE_PATH ?? path.resolve(__dirname, './prod.sqlite3');

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
