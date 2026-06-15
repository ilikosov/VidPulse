import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('playlists', (t) => {
    // Cursor for incremental playlist ingestion: stores YouTube's nextPageToken so
    // "load older videos" can resume where the previous fetch stopped. Null once the
    // whole playlist has been pulled (or for playlists added before this column existed).
    t.text('next_page_token').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('playlists', (t) => {
    t.dropColumn('next_page_token');
  });
}
