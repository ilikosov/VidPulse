import { afterAll, describe, expect, it } from 'vitest';
import knex from './index';

/**
 * TASK-1 / ADR 0002 acceptance: the text columns hold the raw parse (evidence),
 * the FK holds the canonical link, and the display value is derived on read as
 * COALESCE(dictionary, raw) via the `videos_display` view. Renaming a dictionary
 * entry must change the display immediately while the stored evidence stays put.
 */
describe('videos_display view (TASK-1)', () => {
  const createdVideoIds: number[] = [];
  const createdGroupIds: number[] = [];

  afterAll(async () => {
    if (createdVideoIds.length) await knex('videos').whereIn('id', createdVideoIds).del();
    if (createdGroupIds.length)
      await knex('dictionary_groups').whereIn('id', createdGroupIds).del();
  });

  it('derives display = COALESCE(dictionary, raw) and keeps the raw parse as evidence', async () => {
    const [groupId] = await knex('dictionary_groups').insert({
      name: 'CANON GROUP',
      type: 'female',
      active: 1,
    });
    createdGroupIds.push(groupId);

    const [videoId] = await knex('videos').insert({
      youtube_id: 'task1-display-view',
      original_title: 't',
      group_name: 'raw-alias', // raw parse = evidence
      group_id: groupId, // canonical link
      status: 'new',
    });
    createdVideoIds.push(videoId);

    let row = await knex('videos_display')
      .where({ id: videoId })
      .first('group_name', 'raw_group_name');
    expect(row.group_name).toBe('CANON GROUP'); // display = canonical
    expect(row.raw_group_name).toBe('raw-alias'); // evidence preserved

    // Rename the dictionary entry → display updates immediately.
    await knex('dictionary_groups')
      .where({ id: groupId })
      .update({ name: 'CANON GROUP (RENAMED)' });

    row = await knex('videos_display').where({ id: videoId }).first('group_name', 'raw_group_name');
    expect(row.group_name).toBe('CANON GROUP (RENAMED)');
    expect(row.raw_group_name).toBe('raw-alias');

    // The stored evidence column never changed.
    const base = await knex('videos').where({ id: videoId }).first('group_name');
    expect(base.group_name).toBe('raw-alias');
  });

  it('falls back to the raw parse when there is no dictionary match', async () => {
    const [videoId] = await knex('videos').insert({
      youtube_id: 'task1-display-view-unmatched',
      original_title: 't',
      group_name: 'only-raw',
      group_id: null,
      status: 'new',
    });
    createdVideoIds.push(videoId);

    const row = await knex('videos_display').where({ id: videoId }).first('group_name');
    expect(row.group_name).toBe('only-raw');
  });
});
