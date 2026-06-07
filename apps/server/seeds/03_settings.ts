import type { Knex } from 'knex';

const DEFAULTS: Record<string, string> = {
  visible_group_types: 'female,mixed',
};

export async function seed(knex: Knex): Promise<void> {
  await knex('settings')
    .insert(Object.entries(DEFAULTS).map(([key, value]) => ({ key, value })))
    .onConflict('key')
    .ignore();
}
