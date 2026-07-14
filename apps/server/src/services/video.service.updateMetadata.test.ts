import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { knex } from '@vidpulse/db';
import { videoService } from './video.service';

// Integration test against the migrated test DB (vitest global setup). Regression coverage for
// the songs-only edit bug: updateMetadata's "nothing changed" early return fired before songs
// were synced, so a request editing only song_titles was silently ignored.

const TAG = 'update-metadata-test';
let channelId: number;
let videoId: number;

describe('videoService.updateMetadata — songs-only edit', () => {
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
        status: 'needs_review',
      })
      .returning('id');
    videoId = typeof vid === 'object' ? vid.id : vid;
    await knex('video_songs').insert({ video_id: videoId, position: 0, raw_title: 'Old Song' });
  });

  afterEach(async () => {
    await knex('training_data').where('video_id', videoId).delete();
    await knex('status_history').where('video_id', videoId).delete();
    await knex('video_songs').where('video_id', videoId).delete();
    await knex('videos').where('id', videoId).delete();
    await knex('channels').where('id', channelId).delete();
  });

  it('syncs video_songs and advances status when ONLY songs are edited', async () => {
    const updated = await videoService.updateMetadata(videoId, { song_titles: ['New Song'] });

    const songs = await knex('video_songs').where('video_id', videoId).orderBy('position');
    expect(songs.map((s) => s.raw_title)).toEqual(['New Song']);
    // A needs_review video that received a correction moves to 'new'.
    expect(updated.status).toBe('new');
  });

  it('still short-circuits when nothing at all is edited', async () => {
    const before = await knex('videos').where('id', videoId).first();

    const result = await videoService.updateMetadata(videoId, {});

    expect(result.status).toBe('needs_review');
    const after = await knex('videos').where('id', videoId).first();
    expect(after.updated_at).toBe(before.updated_at);
    const songs = await knex('video_songs').where('video_id', videoId);
    expect(songs.map((s) => s.raw_title)).toEqual(['Old Song']);
  });
});
