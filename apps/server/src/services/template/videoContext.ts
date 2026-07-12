import type { VideoEntity } from '@vidpulse/db';
import type { EntityContext } from './template.engine';

/** Shape returned by videoService.getVideoById (display row + joined relations). */
export type VideoForContext = VideoEntity & {
  channel_title?: string | null;
  playlist_title?: string | null;
  tags?: Array<{ name: string }>;
  songs?: Array<{ title: string }>;
  file_width?: number | null;
  file_height?: number | null;
};

/** Convert ISO date string (2026-05-21T00:00:00.000Z) → YYMMDD (260521). */
function toYYMMDD(iso: string): string {
  const d = new Date(iso);
  const yy = String(d.getUTCFullYear()).slice(-2);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

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
    song_title: (video.songs ?? []).map((song) => song.title).join(' + ') || null,
    songs: (video.songs ?? []).map((song) => song.title),
    perf_date: video.perf_date ? toYYMMDD(video.perf_date) : null,
    event: video.event ?? null,
    camera_type: video.camera_type ?? null,
    channel_title: video.channel_title ?? null,
    playlist_title: video.playlist_title ?? null,
    tags: (video.tags ?? []).map((tag) => tag.name),
    duration_seconds: video.duration_seconds ?? null,
    status: video.status,
    orientation:
      video.file_width != null && video.file_height != null
        ? video.file_width >= video.file_height
          ? 'horizontal'
          : 'vertical'
        : null,
  };
}
