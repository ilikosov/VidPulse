import type { Knex } from 'knex';

/**
 * Events used to be stored with a leading '@' (e.g. "@SBS INKIGAYO"). That convention was dropped —
 * the parser, manual edits, and the UI now store/display the bare name. Normalize existing rows.
 */
export async function up(knex: Knex): Promise<void> {
  await knex('videos')
    .whereLike('event', '@%')
    .update({ event: knex.raw("LTRIM(event, '@')") });
}

export async function down(knex: Knex): Promise<void> {
  await knex('videos')
    .whereNotNull('event')
    .andWhere('event', '<>', '')
    .andWhere('event', 'not like', '@%')
    .update({ event: knex.raw("'@' || event") });
}
