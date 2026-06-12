import type { Knex } from 'knex';

const TAGS = ['short', 'длинное видео', 'игнорировать видео', 'private'];

export async function seed(knex: Knex): Promise<void> {
  await knex('tags')
    .insert(TAGS.map((name) => ({ name })))
    .onConflict('name')
    .ignore();
}
