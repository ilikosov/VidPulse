import type { IParser } from '../../interfaces/services';
import { hasUnresolvedEntity, resolveParsedMetadata } from '../metadataResolver.service';

export async function parseVideoMetadata(
  parser: IParser,
  originalTitle: string,
  publishedAt?: string,
  tags?: string[],
  description?: string,
) {
  const { metadata, needsReview } = await parser.parseTitle(
    originalTitle,
    publishedAt,
    tags,
    description,
  );
  const resolved = await resolveParsedMetadata(metadata);
  const forceReview = hasUnresolvedEntity(metadata, resolved);
  const updateData: Record<string, string | number | boolean | null> = {};
  if (metadata.perf_date)
    updateData.perf_date = new Date(
      `20${metadata.perf_date.slice(0, 2)}-${metadata.perf_date.slice(2, 4)}-${metadata.perf_date.slice(4, 6)}`,
    ).toISOString();
  updateData.group_id = resolved.group_id;
  updateData.artist_id = resolved.artist_id;
  updateData.event_id = resolved.event_id;
  updateData.group_name = resolved.group_name;
  updateData.artist_name = resolved.artist_name;
  updateData.event = resolved.event;
  if (metadata.camera_type !== undefined) updateData.camera_type = metadata.camera_type || null;
  updateData.is_fancam = metadata.is_fancam ?? null;
  updateData.fancam_confidence = metadata.fancam_confidence ?? null;
  updateData.is_own_group_song = metadata.is_own_group_song ?? null;
  updateData.is_own_artist_song = metadata.is_own_artist_song ?? null;
  return {
    metadata: updateData,
    status: needsReview || forceReview ? 'needs_review' : 'new',
    // Raw song info so callers can sync the video_songs junction (source of truth).
    songTitle: resolved.song_title ?? undefined,
    songTitles: metadata.song_titles,
  };
}
