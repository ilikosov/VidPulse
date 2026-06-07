import type { Knex } from 'knex';

// Seed-only migration — data now managed in seeds/01_tags.ts.
export async function up(_knex: Knex): Promise<void> {}
export async function down(_knex: Knex): Promise<void> {}
