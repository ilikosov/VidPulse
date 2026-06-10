import type { IParser, ITagService, IYouTubeService } from '../../interfaces/services';
import type { IVideoRepository } from '../../interfaces/repositories';
import { parseVideoMetadata } from './metadata.utils';
import { syncVideoSongs } from '../parser/videoSongs.service';

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
  if (await deps.videos.findByYoutubeId(item.videoId)) return null;

  const details = await deps.youtube.getVideoDetails(item.videoId);
  const { metadata, songTitle, songTitles } = await parseVideoMetadata(
    deps.parser,
    details.title || item.title,
    details.publishedAt || item.publishedAt,
    details.tags,
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
    status: 'needs_review',
    ...metadata,
    created_at: now,
    updated_at: now,
  });

  await syncVideoSongs(id, songTitle, songTitles);
  await deps.tags.assignAutoTags(id, details.durationSeconds, details.privacyStatus);
  return id;
}
