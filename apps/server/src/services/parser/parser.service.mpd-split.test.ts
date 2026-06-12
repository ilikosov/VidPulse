import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { knex } from '@vidpulse/db';
import { parseTitle } from './parser.service';

// MPD-style titles romanize artist names with spaces ("SE JEONG"), which broke the
// positional fancam-credit split: group="I.O.I SE", artist="JEONG". The dictionary
// re-split must restore the boundary against known groups.
//
// Fixtures live in their own file: DictionaryModule caches the dictionary on the first
// parseTitle call, so they must be inserted before any test in this module parses.

const GROUP_NAME = 'I.O.I';
const ARTIST_NAME = 'SEJEONG';
const PUBLISHED_AT = '2026-05-21T10:26:04Z';

let groupId: number;
let artistId: number;

beforeAll(async () => {
  [groupId] = await knex('dictionary_groups').insert({
    name: GROUP_NAME,
    type: 'female',
    active: false,
  });
  [artistId] = await knex('dictionary_artists').insert({
    name: ARTIST_NAME,
    group_id: groupId,
  });
  await knex('dictionary_aliases')
    .insert([
      { entity_type: 'group', entity_id: groupId, alias: '아이오아이' },
      { entity_type: 'artist', entity_id: artistId, alias: '세정' },
    ])
    .onConflict(['entity_type', 'entity_id', 'alias'])
    .ignore();
});

afterAll(async () => {
  await knex('dictionary_aliases').where({ entity_type: 'artist', entity_id: artistId }).del();
  await knex('dictionary_aliases').where({ entity_type: 'group', entity_id: groupId }).del();
  // Deleting the group cascades to its artists (group_id ON DELETE CASCADE).
  await knex('dictionary_groups').where({ id: groupId }).del();
});

describe('parseTitle - MPD fancam credits with multi-word artist names', () => {
  it('re-splits "(I.O.I SE JEONG FanCam)" into a known group and the remaining artist', async () => {
    const title =
      "[MPD직캠] 아이오아이 세정 직캠 4K 'IOI (Where My Girls At)' (I.O.I SE JEONG FanCam) | @MCOUNTDOWN_2026.5.21";
    const { metadata, needsReview } = await parseTitle(title, PUBLISHED_AT);

    expect(metadata.group_name).toBe('I.O.I');
    expect(metadata.artist_name).toBe('SEJEONG');
    expect(metadata.song_title).toBe('IOI (Where My Girls At)');
    expect(metadata.event).toBe('@MCOUNTDOWN');
    expect(metadata.camera_type).toBe('FANCAM');
    expect(needsReview).toBe(false);
  });

  it('keeps a solo MPD credit whole: 직캠 in the prefix is not a performer name', async () => {
    const title = "[MPD직캠] 세정 직캠 4K 'Flower Way' (SE JEONG FanCam) | @MCOUNTDOWN_2026.5.21";
    const { metadata, needsReview } = await parseTitle(title, PUBLISHED_AT);

    expect(metadata.group_name).toBe('SOLO');
    expect(metadata.artist_name).toBe('SEJEONG');
    expect(metadata.song_title).toBe('Flower Way');
    expect(needsReview).toBe(false);
  });

  it('flags a group-only fancam credit as the group, not a SOLO artist', async () => {
    const title = "[MPD직캠] 아이오아이 직캠 8K '갑자기' (I.O.I FanCam) | @MCOUNTDOWN_2026.5.21";
    const { metadata, needsReview } = await parseTitle(title, PUBLISHED_AT);

    expect(metadata.group_name).toBe('I.O.I');
    expect(metadata.artist_name).toBeUndefined();
    expect(metadata.song_title).toBe('갑자기');
    expect(metadata.event).toBe('@MCOUNTDOWN');
    expect(needsReview).toBe(false);
  });
});
