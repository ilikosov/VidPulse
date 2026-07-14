import type { IParser, ITagService, IYouTubeService } from '../../interfaces/services';
import type { IVideoRepository } from '@vidpulse/db';
import { parseVideoMetadata } from './metadata.utils';
import { syncVideoSongs } from '../parser/videoSongs.service';
import { knex } from '@vidpulse/db';

export interface IngestDeps {
  videos: IVideoRepository;
  youtube: IYouTubeService;
  parser: IParser;
  tags: ITagService;
}

export interface IngestItem {
  videoId: string;
  title: string;
  publishedAt?: string;
}

/**
 * Single entry point for adding a YouTube video to the library. Fetches full
 * details (description, duration, tags, privacy), parses/resolves metadata,
 * inserts the row, and syncs songs + auto tags. Returns the new video id, or
 * null if the video already exists.
 *
 * Used by channel add, "load more", and the periodic channel/playlist syncs so
 * every ingestion path produces identical rows.
 */
export async function ingestVideo(
  deps: IngestDeps,
  item: IngestItem,
  link: { channelId?: number | null; playlistId?: number | null },
): Promise<number | null> {
  const existing = await deps.videos.findByYoutubeId(item.videoId);
  if (existing) {
    // Video already exists — still link it to the new channel/playlist via junction tables.
    if (link.channelId)
      await knex('video_channels')
        .insert({ video_id: existing.id, channel_id: link.channelId })
        .onConflict(['video_id', 'channel_id'])
        .ignore();
    if (link.playlistId)
      await knex('video_playlists')
        .insert({ video_id: existing.id, playlist_id: link.playlistId })
        .onConflict(['video_id', 'playlist_id'])
        .ignore();
    return null;
  }

  const details = await deps.youtube.getVideoDetails(item.videoId);
  const { metadata, status, songTitle, songTitles } = await parseVideoMetadata(
    deps.parser,
    details.title || item.title,
    details.publishedAt || item.publishedAt,
    details.tags,
    details.description,
  );

  const now = new Date().toISOString();
  const id = await deps.videos.insert({
    youtube_id: item.videoId,
    channel_id: link.channelId ?? null,
    playlist_id: link.playlistId ?? null,
    original_title: details.title || item.title,
    published_at: details.publishedAt || item.publishedAt,
    duration_seconds: details.durationSeconds ?? null,
    description: details.description ?? null,
    // Use the parser-computed status (needs_review vs new) — hardcoding needs_review here made
    // channel sync disagree with the playlist ingestion path for cleanly-parsed videos.
    status,
    ...metadata,
    created_at: now,
    updated_at: now,
  });

  if (link.channelId)
    await knex('video_channels').insert({ video_id: id, channel_id: link.channelId });
  if (link.playlistId)
    await knex('video_playlists').insert({ video_id: id, playlist_id: link.playlistId });

  await syncVideoSongs(id, songTitle, songTitles);
  await deps.tags.assignAutoTags(id, details.durationSeconds, details.privacyStatus);
  return id;
}
