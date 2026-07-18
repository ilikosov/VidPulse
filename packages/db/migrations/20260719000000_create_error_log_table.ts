import type { Knex } from 'knex';

/**
 * Error journal: unexpected/server errors (stack trace + request context) are persisted here by the
 * Express error handler, so failures are inspectable after the fact instead of living only in logs.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('error_log', (t) => {
    t.increments('id').primary();
    t.text('name'); // error class name (TypeError, AppError, …)
    t.text('message').notNullable();
    t.text('stack');
    t.text('method'); // HTTP method of the failing request
    t.text('path'); // request path
    t.integer('status_code');
    t.text('context'); // extra JSON info
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.index('created_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('error_log');
}
