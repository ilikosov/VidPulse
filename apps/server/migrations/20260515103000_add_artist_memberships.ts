import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('dictionary_artist_memberships', (t) => {
    t.increments('id').primary();
    t.integer('artist_id')
      .notNullable()
      .references('id')
      .inTable('dictionary_artists')
      .onDelete('CASCADE');
    t.integer('group_id')
      .nullable()
      .references('id')
      .inTable('dictionary_groups')
      .onDelete('SET NULL');
    t.text('activity_type').notNullable();
    t.text('status').notNullable();
    t.date('started_at').nullable();
    t.date('ended_at').nullable();
    t.boolean('is_primary').notNullable().defaultTo(false);
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable('dictionary_artist_memberships', (t) => {
    t.index(['artist_id'], 'dictionary_artist_memberships_artist_id_idx');
    t.index(['group_id'], 'dictionary_artist_memberships_group_id_idx');
    t.index(['artist_id', 'activity_type'], 'dictionary_artist_memberships_artist_activity_idx');
    t.index(
      ['artist_id', 'group_id', 'activity_type', 'status'],
      'dictionary_artist_memberships_lookup_idx',
    );
    t.index(
      ['artist_id', 'activity_type', 'started_at'],
      'dictionary_artist_memberships_artist_activity_started_idx',
    );
  });

  await knex.raw(`
    ALTER TABLE dictionary_artist_memberships
    ADD CONSTRAINT dictionary_artist_memberships_activity_type_check
    CHECK (activity_type IN ('group', 'solo'))
  `);

  await knex.raw(`
    ALTER TABLE dictionary_artist_memberships
    ADD CONSTRAINT dictionary_artist_memberships_status_check
    CHECK (status IN ('active', 'former', 'hiatus'))
  `);

  await knex.raw(`
    INSERT INTO dictionary_artist_memberships (
      artist_id, group_id, activity_type, status, is_primary, created_at, updated_at
    )
    SELECT id, group_id, 'group', 'active', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM dictionary_artists
    WHERE group_id IS NOT NULL
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('dictionary_artist_memberships');
}
