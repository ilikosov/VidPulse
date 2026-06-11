import type { VideoEntity } from '../../interfaces/repositories';
import type { EntityContext } from './template.engine';

/** Shape returned by videoService.getVideoById (display row + joined relations). */
export type VideoForContext = VideoEntity & {
  channel_title?: string | null;
  playlist_title?: string | null;
  tags?: Array<{ name: string }>;
  songs?: Array<{ title: string }>;
};

/**
 * Map a video to the curated set of template params exposed under the `video` entity.
 * Only these keys are addressable as `{{video.<param>}}` in SHELL_COMMAND_VIDEO.
 */
export function buildVideoContext(video: VideoForContext): EntityContext {
  return {
    youtube_id: video.youtube_id,
    youtube_url: `https://www.youtube.com/watch?v=${video.youtube_id}`,
    title: video.original_title,
    group_name: video.group_name ?? null,
    artist_name: video.artist_name ?? null,
    song_title: video.song_title ?? null,
    songs: (video.songs ?? []).map((song) => song.title),
    perf_date: video.perf_date ?? null,
    event: video.event ?? null,
    camera_type: video.camera_type ?? null,
    channel_title: video.channel_title ?? null,
    playlist_title: video.playlist_title ?? null,
    tags: (video.tags ?? []).map((tag) => tag.name),
    duration_seconds: video.duration_seconds ?? null,
    status: video.status,
  };
}
