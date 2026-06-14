import { afterEach, describe, expect, it } from 'vitest';
import { knex } from '@vidpulse/db';
import { groupService } from './group.service';

// Regression: a group's songs are resolved via the dictionary_song_groups link table,
// not by matching the denormalized dictionary_songs.artist against member names. The
// Wikidata importer stores group-level songs with artist = group name (not a member),
// so the old artist-name match hid them.

const TAG = 'group-songs-test';
const GROUP = `${TAG} GROUP`;
const SONG = `${TAG} Girls Will Be Girls`;

async function cleanup() {
  const group = await knex('dictionary_groups').where('name', GROUP).first();
  if (group) {
    const songIds = (
      await knex('dictionary_song_groups').where('group_id', group.id).select('song_id')
    ).map((r) => r.song_id);
    await knex('dictionary_song_groups').where('group_id', group.id).del();
    if (songIds.length) await knex('dictionary_songs').whereIn('id', songIds).del();
    await knex('dictionary_groups').where('id', group.id).del(); // cascades artists
  }
}

describe('group.service — group songs via dictionary_song_groups', () => {
  afterEach(cleanup);

  it('returns and counts a group-level song linked only via dictionary_song_groups', async () => {
    const [groupId] = await knex('dictionary_groups').insert({
      name: GROUP,
      type: 'female',
      active: true,
    });
    // A member exists but is NOT the song's artist (mirrors Wikidata group-level import).
    await knex('dictionary_artists').insert({ name: `${TAG} MEMBER`, group_id: groupId });
    const [songId] = await knex('dictionary_songs').insert({ title: SONG, artist: GROUP });
    await knex('dictionary_song_groups').insert({ song_id: songId, group_id: groupId });

    const songs = await groupService.getGroupSongs(groupId);
    expect(songs.map((s) => s.title)).toContain(SONG);

    expect(await groupService.countGroupSongs(groupId)).toBe(1);

    const groups = await groupService.getAllGroups();
    const row = groups.find((g) => g.id === groupId);
    expect(Number(row?.song_count)).toBe(1);
  });
});
