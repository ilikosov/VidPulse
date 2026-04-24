import type { Knex } from 'knex';

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'better-sqlite3',
    connection: {
      filename: './dev.sqlite3',
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

  production: {
    client: 'better-sqlite3',
    connection: {
      filename: './prod.sqlite3',
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
