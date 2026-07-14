import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import { AddressInfo } from 'net';
import { knex } from '@vidpulse/db';
import router from './video';

// Regression test for the route-ordering bug where POST /:id/tags shadowed POST /batch/tags,
// making every batch tag request 400. Runs against the migrated test DB (vitest global setup).

const TAG = 'batch-tags-route-test';
let channelId: number;

async function seedVideo(youtubeId: string): Promise<number> {
  const [row] = await knex('videos')
    .insert({ youtube_id: youtubeId, channel_id: channelId, original_title: TAG, status: 'new' })
    .returning('id');
  return typeof row === 'object' ? row.id : row;
}

describe('POST /videos/batch/tags', () => {
  beforeEach(async () => {
    const [chan] = await knex('channels')
      .insert({ youtube_id: `${TAG}-channel`, title: TAG })
      .returning('id');
    channelId = typeof chan === 'object' ? chan.id : chan;
  });

  afterEach(async () => {
    const ids = await knex('videos').where('original_title', TAG).pluck('id');
    if (ids.length) await knex('video_tags').whereIn('video_id', ids).delete();
    await knex('videos').where('original_title', TAG).delete();
    await knex('channels').where('youtube_id', `${TAG}-channel`).delete();
    await knex('tags').where('name', 'concert').delete();
  });

  it('reaches the batch handler and tags every video (not shadowed by /:id/tags)', async () => {
    const a = await seedVideo(`${TAG}-a`);
    const b = await seedVideo(`${TAG}-b`);

    const app = express();
    app.use(express.json());
    app.use('/api/videos', router);
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/api/videos/batch/tags`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ videoIds: [a, b], tagName: 'concert' }),
    });
    const body = await res.json();
    server.close();

    expect(res.status).toBe(200);
    expect(body.processed).toBe(2);
    const tagged = await knex('video_tags as vt')
      .join('tags as t', 't.id', 'vt.tag_id')
      .whereIn('vt.video_id', [a, b])
      .where('t.name', 'concert')
      .count<{ count: number }>('* as count')
      .first();
    expect(Number(tagged?.count)).toBe(2);
  });
});
