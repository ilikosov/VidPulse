import type { Knex } from 'knex';
import path from 'path';

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'better-sqlite3',
    connection: {
      filename: path.resolve(__dirname, './dev.sqlite3'),
    },
    useNullAsDefault: true,
    pool: {
      afterCreate: (conn: any, done: any) => {
        conn.pragma('journal_mode=WAL');
        conn.pragma('busy_timeout=5000');
        done(null, conn);
      },
    },
    migrations: {
      directory: '../../migrations',
    },
  },

  test: {
    client: 'better-sqlite3',
    // Dedicated test DB file — never the shared dev database (see TASK-5 / TASK-15).
    connection: { filename: path.resolve(__dirname, './dev.test.sqlite3') },
    useNullAsDefault: true,
    pool: {
      afterCreate: (conn: any, done: any) => {
        conn.pragma('foreign_keys = ON');
        conn.pragma('busy_timeout=5000');
        done(null, conn);
      },
    },
    migrations: { directory: path.resolve(__dirname, '../../migrations') },
  },

  production: {
    client: 'better-sqlite3',
    connection: {
      filename: 'src/db/prod.sqlite3',
    },
    useNullAsDefault: true,
    pool: {
      afterCreate: (conn: any, done: any) => {
        conn.pragma('journal_mode=WAL');
        conn.pragma('busy_timeout=5000');
        done(null, conn);
      },
    },
    migrations: {
      directory: '../../migrations',
    },
  },
};

export default config;
