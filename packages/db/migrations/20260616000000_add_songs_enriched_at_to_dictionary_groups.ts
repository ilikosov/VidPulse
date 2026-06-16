import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('dictionary_groups', (t) => {
    // ISO timestamp of the last MusicBrainz song enrichment for this group. Null = never
    // enriched. The K-pop refresh enriches the oldest/never-enriched groups first so the
    // catalogue is filled in "по частям" across runs (bounding the connection load per run),
    // and connect-timeout stragglers — left un-stamped — are retried before fresh groups.
    t.text('songs_enriched_at').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('dictionary_groups', (t) => {
    t.dropColumn('songs_enriched_at');
  });
}
