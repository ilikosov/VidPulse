import type { Knex } from 'knex';

/**
 * TASK-2 / ADR 0002: `video_songs` becomes the full record of a video's songs.
 *
 * Each row stores the raw parsed title (evidence) + its order (`position`) and,
 * when matched, a nullable `song_id` to the canonical dictionary song. Display is
 * derived on read as COALESCE(dictionary.title, raw_title), which also covers
 * songs that have no dictionary match.
 *
 * SQLite can't change a primary key / column nullability in place, so the table
 * is rebuilt. Nothing references `video_songs`, so the drop/rename is safe.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE video_songs_new (
      video_id  INTEGER NOT NULL,
      position  INTEGER NOT NULL,
      raw_title TEXT    NOT NULL,
      song_id   INTEGER NULL,
      PRIMARY KEY (video_id, position),
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
      FOREIGN KEY (song_id)  REFERENCES dictionary_songs(id) ON DELETE SET NULL
    );
  `);

  // Preserve existing matched links. The original raw title wasn't stored, so use
  // the canonical title as the best-available evidence; order is assigned per video.
  await knex.raw(`
    INSERT INTO video_songs_new (video_id, position, raw_title, song_id)
    SELECT vs.video_id,
           ROW_NUMBER() OVER (PARTITION BY vs.video_id ORDER BY ds.title) - 1,
           ds.title,
           vs.song_id
    FROM video_songs vs
    JOIN dictionary_songs ds ON ds.id = vs.song_id;
  `);

  // Backfill the legacy single-value snapshot for videos that have no junction rows.
  await knex.raw(`
    INSERT INTO video_songs_new (video_id, position, raw_title, song_id)
    SELECT v.id, 0, v.song_title, v.song_id
    FROM videos v
    WHERE v.song_title IS NOT NULL AND TRIM(v.song_title) <> ''
      AND v.id NOT IN (SELECT video_id FROM video_songs_new);
  `);

  await knex.raw('DROP TABLE video_songs;');
  await knex.raw('ALTER TABLE video_songs_new RENAME TO video_songs;');
  await knex.raw('CREATE INDEX IF NOT EXISTS video_songs_song_id_idx ON video_songs(song_id);');
}

export async function down(knex: Knex): Promise<void> {
  // Revert to the matched-only (video_id, song_id) shape; unmatched rows are dropped.
  await knex.raw(`
    CREATE TABLE video_songs_old (
      video_id INTEGER NOT NULL,
      song_id  INTEGER NOT NULL,
      PRIMARY KEY (video_id, song_id),
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
      FOREIGN KEY (song_id)  REFERENCES dictionary_songs(id) ON DELETE CASCADE
    );
  `);
  await knex.raw(`
    INSERT OR IGNORE INTO video_songs_old (video_id, song_id)
    SELECT video_id, song_id FROM video_songs WHERE song_id IS NOT NULL;
  `);
  await knex.raw('DROP TABLE video_songs;');
  await knex.raw('ALTER TABLE video_songs_old RENAME TO video_songs;');
}
