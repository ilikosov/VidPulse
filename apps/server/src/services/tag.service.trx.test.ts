import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { knex } from '@vidpulse/db';
import { assignAutoTags, SHORTS_TAG } from './tag.service';

// Integration test against the real migrated test DB (vitest global setup). Regression coverage
// for the resync deadlock: assignAutoTags used to write through the GLOBAL knex pool even when
// the caller was inside a transaction holding SQLite's write lock, hanging until busy_timeout /
// acquireConnectionTimeout. Passing the transaction through must complete instantly.

const TAG = 'tag-trx-test';
let channelId: number;
let videoId: number;

describe('assignAutoTags inside a transaction', () => {
  beforeEach(async () => {
    const [chan] = await knex('channels')
      .insert({ youtube_id: `${TAG}-channel`, title: TAG })
      .returning('id');
    channelId = typeof chan === 'object' ? chan.id : chan;
    const [vid] = await knex('videos')
      .insert({
        youtube_id: `${TAG}-video`,
        channel_id: channelId,
        original_title: TAG,
        status: 'new',
      })
      .returning('id');
    videoId = typeof vid === 'object' ? vid.id : vid;
  });

  afterEach(async () => {
    await knex('video_tags').where('video_id', videoId).delete();
    await knex('videos').where('id', videoId).delete();
    await knex('channels').where('id', channelId).delete();
  });

  it('writes through the passed transaction without deadlocking on the write lock', async () => {
    await knex.transaction(async (trx) => {
      // A write through trx takes SQLite's write lock — the assignAutoTags call below must
      // ride the same transaction, not the global pool.
      await trx('videos').where('id', videoId).update({ updated_at: new Date().toISOString() });
      await assignAutoTags(videoId, 30, undefined, trx);
    });

    const tagged = await knex('video_tags as vt')
      .join('tags as t', 't.id', 'vt.tag_id')
      .where('vt.video_id', videoId)
      .where('t.name', SHORTS_TAG)
      .first();
    expect(tagged).toBeTruthy();
  }, 10000);
});
