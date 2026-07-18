import { afterEach, describe, expect, it } from 'vitest';
import { knex, errorLogRepository } from '@vidpulse/db';
import { logError } from './errorLog.service';

// Integration test against the migrated test DB (see tests/vitest.global-setup.ts).

const TAG = 'errlog-test-';

async function cleanup() {
  await knex('error_log').where('message', 'like', `${TAG}%`).delete();
}

describe('errorLog.service + errorLogRepository', () => {
  afterEach(cleanup);

  it('persists an error with stack, name and request context', async () => {
    await logError(new Error(`${TAG}boom`), {
      method: 'POST',
      path: '/api/x',
      statusCode: 500,
      extra: { foo: 1 },
    });

    const rows = await knex('error_log').where('message', `${TAG}boom`);
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.name).toBe('Error');
    expect(row.stack).toContain(`${TAG}boom`);
    expect(row.method).toBe('POST');
    expect(row.path).toBe('/api/x');
    expect(row.status_code).toBe(500);
    expect(JSON.parse(row.context)).toEqual({ foo: 1 });
  });

  it('findAll returns newest first', async () => {
    await logError(new Error(`${TAG}one`));
    await logError(new Error(`${TAG}two`));

    const mine = (await errorLogRepository.findAll(100, 0)).filter((r) =>
      r.message.startsWith(TAG),
    );
    expect(mine.map((r) => r.message)).toEqual([`${TAG}two`, `${TAG}one`]);
  });

  it('records a non-Error thrown value without a stack', async () => {
    await logError(`${TAG}string-failure`);
    const rows = await knex('error_log').where('message', `${TAG}string-failure`);
    expect(rows).toHaveLength(1);
    expect(rows[0].stack).toBeNull();
  });

  it('clear empties the log', async () => {
    await logError(new Error(`${TAG}to-clear`));
    expect(await errorLogRepository.count()).toBeGreaterThanOrEqual(1);
    await errorLogRepository.clear();
    expect(await errorLogRepository.count()).toBe(0);
  });
});
