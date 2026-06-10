import { afterEach, describe, expect, it } from 'vitest';
import knex from '../../db';
import { mediaLibraryService } from './media-library.service';

// Reproduction: re-importing the same media library must not duplicate artists.

const TAG = 'dedup-test';

async function cleanup() {
  // Deleting the test group cascades to its artists (group_id ON DELETE CASCADE)
  // and their memberships (artist_id ON DELETE CASCADE). Leaves seed data intact.
  await knex('dictionary_groups').where('name', `${TAG} GROUP`).del();
}

function payload(groupArtistName: string) {
  return {
    version: 1,
    mode: 'merge',
    groups: [
      {
        name: `${TAG} GROUP`,
        type: 'female',
        artists: [
          { name: groupArtistName, membership: { activityType: 'group', status: 'active' } },
        ],
        songs: [],
      },
    ],
    soloArtists: [],
    events: [],
  };
}

describe('media library import — artist dedup', () => {
  afterEach(cleanup);

  it('does not duplicate ASCII group artists on re-import', async () => {
    await mediaLibraryService.importMediaLibrary(payload('GROUPARTIST'));
    await mediaLibraryService.importMediaLibrary(payload('GROUPARTIST'));

    const rows = await knex('dictionary_artists').where('name', 'GROUPARTIST');
    expect(rows.length).toBe(1);
  });

  it('does not duplicate when stored name has irregular whitespace', async () => {
    await mediaLibraryService.importMediaLibrary(payload('RED  VELVET'));
    // Re-import with collapsed single space — normalizeName collapses, SQL LOWER does not.
    await mediaLibraryService.importMediaLibrary(payload('RED VELVET'));

    const rows = await knex('dictionary_artists').whereRaw("LOWER(name) LIKE 'red%velvet'");
    expect(rows.length).toBe(1);
  });
});
