import knex from './db';
import { parseTitle } from './services/parser/parser.service';

async function batchParse() {
  const videos = await knex('videos').where('status', 'new').whereNull('group_name');
  for (const v of videos) {
    const { metadata, needsReview } = await parseTitle(v.original_title);
    await knex('videos')
      .where('id', v.id)
      .update({
        perf_date: metadata.perf_date || v.published_at || null,
        group_name: metadata.group_name || null,
        artist_name: metadata.artist_name || null,
        song_title: metadata.song_title || null,
        event: metadata.event || null,
        camera_type: metadata.camera_type || null,
        status: needsReview ? 'needs_review' : 'new',
      });
  }
  console.log('Done');
  process.exit();
}
batchParse();
