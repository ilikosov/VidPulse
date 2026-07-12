import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import { AddressInfo } from 'net';
import { knex } from '@vidpulse/db';
import router from './video';

// Integration test against the migrated test DB (see tests/vitest.global-setup.ts). Covers the
// `search` filter used by the file editor's video picker (VideoSearchSelect.tsx).

const TAG = 'video-search-test';
let channelId: number;

async function seedVideo(youtubeId: string, title: string): Promise<number> {
  const [row] = await knex('videos')
    .insert({
      youtube_id: youtubeId,
      channel_id: channelId,
      original_title: title,
      status: 'new',
    })
    .returning('id');
  return typeof row === 'object' ? row.id : row;
}

describe('GET /videos?search=', () => {
  beforeEach(async () => {
    const [chan] = await knex('channels')
      .insert({ youtube_id: `${TAG}-channel`, title: TAG })
      .returning('id');
    channelId = typeof chan === 'object' ? chan.id : chan;
    await seedVideo(`${TAG}-aaaaaaaaaaa`, `${TAG} Itzy Comeback Stage`);
    await seedVideo(`${TAG}-bbbbbbbbbbb`, `${TAG} Aespa Fancam`);
  });

  afterEach(async () => {
    await knex('videos').where('original_title', 'like', `${TAG}%`).delete();
    await knex('channels').where('youtube_id', `${TAG}-channel`).delete();
  });

  async function search(query: string): Promise<any> {
    const app = express();
    app.use('/api/videos', router);
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/api/videos?${query}`);
    const body = await res.json();
    server.close();
    return body;
  }

  it('matches a case-insensitive substring of the title', async () => {
    const body = await search(`search=${encodeURIComponent('itzy')}`);

    const titles = body.videos.map((v: any) => v.original_title);
    expect(titles).toContain(`${TAG} Itzy Comeback Stage`);
    expect(titles).not.toContain(`${TAG} Aespa Fancam`);
  });

  it('matches an exact youtube_id', async () => {
    const body = await search(`search=${encodeURIComponent(`${TAG}-bbbbbbbbbbb`)}`);

    const youtubeIds = body.videos.map((v: any) => v.youtube_id);
    expect(youtubeIds).toEqual([`${TAG}-bbbbbbbbbbb`]);
  });
});
