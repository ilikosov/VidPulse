import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { knex } from '@vidpulse/db';
import { channelService } from './channel.service';
import { playlistService } from './playlist.service';

// Integration tests against the migrated test DB (vitest global setup). Regression coverage for
// the data-loss bug where deleting a channel/playlist cascade-deleted videos it should preserve.

const TAG = 'chan-playlist-delete-test';

async function insertChannel(suffix: string): Promise<number> {
  const [row] = await knex('channels')
    .insert({ youtube_id: `${TAG}-chan-${suffix}`, title: TAG })
    .returning('id');
  return typeof row === 'object' ? row.id : row;
}

async function insertPlaylist(suffix: string): Promise<number> {
  const [row] = await knex('playlists')
    .insert({ youtube_id: `${TAG}-pl-${suffix}`, title: TAG })
    .returning('id');
  return typeof row === 'object' ? row.id : row;
}

async function insertVideo(suffix: string, fields: Record<string, unknown> = {}): Promise<number> {
  const [row] = await knex('videos')
    .insert({ youtube_id: `${TAG}-vid-${suffix}`, original_title: TAG, status: 'new', ...fields })
    .returning('id');
  return typeof row === 'object' ? row.id : row;
}

describe('channel / playlist deletion preserves videos', () => {
  afterEach(async () => {
    const ids = await knex('videos').where('original_title', TAG).pluck('id');
    if (ids.length) {
      await knex('video_channels').whereIn('video_id', ids).delete();
      await knex('video_playlists').whereIn('video_id', ids).delete();
    }
    await knex('videos').where('original_title', TAG).delete();
    await knex('channels').where('title', TAG).delete();
    await knex('playlists').where('title', TAG).delete();
  });

  it('deleteChannel(removeVideos=false) nulls channel_id instead of cascade-deleting the video', async () => {
    const channelId = await insertChannel('a');
    const videoId = await insertVideo('a', { channel_id: channelId });

    await channelService.deleteChannel(channelId, false);

    const video = await knex('videos').where('id', videoId).first();
    expect(video).toBeTruthy();
    expect(video.channel_id).toBeNull();
  });

  it('deletePlaylist(removeVideos=true) keeps a video still linked to a channel via video_channels', async () => {
    const channelId = await insertChannel('b');
    const playlistId = await insertPlaylist('b');
    // As ingestVideo does: channel link lives only in the junction, channel_id column stays null.
    const videoId = await insertVideo('b', { playlist_id: playlistId });
    await knex('video_playlists').insert({ video_id: videoId, playlist_id: playlistId });
    await knex('video_channels').insert({ video_id: videoId, channel_id: channelId });

    await playlistService.deletePlaylist(playlistId, true);

    const video = await knex('videos').where('id', videoId).first();
    expect(video).toBeTruthy();
  });

  it('deletePlaylist(removeVideos=true) still deletes a video whose only association is the playlist', async () => {
    const playlistId = await insertPlaylist('c');
    const videoId = await insertVideo('c', { playlist_id: playlistId });
    await knex('video_playlists').insert({ video_id: videoId, playlist_id: playlistId });

    await playlistService.deletePlaylist(playlistId, true);

    const video = await knex('videos').where('id', videoId).first();
    expect(video).toBeUndefined();
  });
});
