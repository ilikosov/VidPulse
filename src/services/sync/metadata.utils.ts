import type { IParser } from '../../interfaces/services';

export async function parseVideoMetadata(parser: IParser, originalTitle: string, publishedAt?: string, tags?: string[]) {
  const { metadata, needsReview } = await parser.parseTitle(originalTitle, publishedAt, tags);
  const updateData: Record<string, any> = {};
  if (metadata.perf_date) updateData.perf_date = new Date(`20${metadata.perf_date.slice(0,2)}-${metadata.perf_date.slice(2,4)}-${metadata.perf_date.slice(4,6)}`).toISOString();
  if (metadata.group_name !== undefined) updateData.group_name = metadata.group_name || null;
  if (metadata.artist_name !== undefined) updateData.artist_name = metadata.artist_name || null;
  if (metadata.song_title !== undefined) updateData.song_title = metadata.song_title || null;
  if (metadata.event !== undefined) updateData.event = metadata.event || null;
  if (metadata.camera_type !== undefined) updateData.camera_type = metadata.camera_type || null;
  return { metadata: updateData, status: needsReview ? 'needs_review' : 'new' };
}
