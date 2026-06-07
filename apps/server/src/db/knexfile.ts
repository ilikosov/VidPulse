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
        conn.pragma('foreign_keys = ON');
        conn.pragma('busy_timeout=5000');
        done(null, conn);
      },
    },
    migrations: {
      directory: path.resolve(__dirname, '../../migrations'),
    },
  },

  test: {
    client: 'better-sqlite3',
    connection: { filename: path.resolve(__dirname, './dev.test.sqlite3') },
    useNullAsDefault: true,
    pool: {
      afterCreate: (conn: any, done: any) => {
        conn.pragma('journal_mode=WAL');
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
      filename: path.resolve(__dirname, './prod.sqlite3'),
    },
    useNullAsDefault: true,
    pool: {
      afterCreate: (conn: any, done: any) => {
        conn.pragma('journal_mode=WAL');
        conn.pragma('foreign_keys = ON');
        conn.pragma('busy_timeout=5000');
        done(null, conn);
      },
    },
    migrations: {
      directory: path.resolve(__dirname, '../../migrations'),
    },
  },
};

export default config;
