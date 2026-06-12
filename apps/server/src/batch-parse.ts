import { knex } from '@vidpulse/db';
import { parseTitle } from './services/parser/parser.service';
import {
  hasUnresolvedEntity,
  resolveParsedMetadata,
} from './services/parser/metadataResolver.service';
import { syncVideoSongs } from './services/parser/videoSongs.service';

async function batchParse() {
  const videos = await knex('videos').where('status', 'new').whereNull('group_name');
  for (const v of videos) {
    const { metadata, needsReview } = await parseTitle(v.original_title);
    const resolved = await resolveParsedMetadata(metadata);
    const forceReview = hasUnresolvedEntity(metadata, resolved);
    await knex('videos')
      .where('id', v.id)
      .update({
        perf_date: metadata.perf_date || v.published_at || null,
        group_id: resolved.group_id,
        artist_id: resolved.artist_id,
        song_id: resolved.song_id,
        event_id: resolved.event_id,
        group_name: resolved.group_name,
        artist_name: resolved.artist_name,
        song_title: resolved.song_title,
        event: resolved.event,
        camera_type: metadata.camera_type || null,
        is_fancam: metadata.is_fancam ?? null,
        fancam_confidence: metadata.fancam_confidence ?? null,
        status: needsReview || forceReview ? 'needs_review' : 'new',
      });
    await syncVideoSongs(v.id, resolved.song_title ?? undefined, metadata.song_titles);
  }
  console.log('Done');
  process.exit();
}
batchParse();
