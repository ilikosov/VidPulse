import path from 'path';
import knex from 'knex';

const dbPath = path.resolve(__dirname, '../../../dev.test.sqlite3');

export const e2eDb = knex({
  client: 'better-sqlite3',
  connection: {
    filename: dbPath,
  },
  useNullAsDefault: true,
});

export async function resetDatabase() {
  await e2eDb('training_data').del();
  await e2eDb('status_history').del();
  await e2eDb('video_tags').del();
  await e2eDb('videos').del();
  await e2eDb('channels').del();
  await e2eDb('playlists').del();
  await e2eDb('duplicate_groups').del();
}
