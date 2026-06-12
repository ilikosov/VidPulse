import { afterEach, describe, expect, it } from 'vitest';
import { knex } from '@vidpulse/db';
import { mediaLibraryService } from './media-library.service';

// Reproduction: re-importing the same media library must not duplicate artists.

const TAG = 'dedup-test';
const SOLO_NAME = `${TAG} SOLOIST`;

async function cleanup() {
  // Deleting the test group cascades to its artists (group_id ON DELETE CASCADE)
  // and their memberships (artist_id ON DELETE CASCADE). Leaves seed data intact.
  await knex('dictionary_groups').where('name', `${TAG} GROUP`).del();
  // Remove only the uniquely-named test soloist; never drop the shared "Solo Artists"
  // group, which holds seeded solo artists.
  await knex('dictionary_artists').where('name', SOLO_NAME).del();
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

  it('does not duplicate membership when seed stores ISO timestamp and import stores a date string', async () => {
    // The seed writes started_at via new Date(from), which better-sqlite3 serializes to an ISO
    // timestamp ("2024-01-01T00:00:00.000Z"); the import passes the raw JSON string ("2024-01-01").
    // addOrUpdateArtistMembership must treat these as the same date and update, not insert a second
    // membership — a duplicate membership row makes the artist appear twice on export.
    const [groupId] = await knex('dictionary_groups').insert({
      name: `${TAG} GROUP`,
      type: 'female',
      active: true,
    });
    const [artistId] = await knex('dictionary_artists').insert({
      name: 'SEEDARTIST',
      group_id: groupId,
    });
    await knex('dictionary_artist_memberships').insert({
      artist_id: artistId,
      group_id: groupId,
      activity_type: 'group',
      status: 'active',
      started_at: new Date('2024-01-01').toISOString(),
      is_primary: 1,
    });

    await mediaLibraryService.importMediaLibrary({
      version: 1,
      mode: 'merge',
      groups: [
        {
          name: `${TAG} GROUP`,
          type: 'female',
          artists: [
            {
              name: 'SEEDARTIST',
              membership: {
                activityType: 'group',
                status: 'active',
                from: '2024-01-01',
                isPrimary: true,
              },
            },
          ],
          songs: [],
        },
      ],
      soloArtists: [],
      events: [],
    });

    const memberships = await knex('dictionary_artist_memberships').where({ artist_id: artistId });
    expect(memberships.length).toBe(1);
  });

  it('reuses a group artist that already exists from a prior run (seed-then-import)', async () => {
    // Simulate the seed having created the artist in the group already.
    const [groupId] = await knex('dictionary_groups').insert({
      name: `${TAG} GROUP`,
      type: 'female',
      active: true,
    });
    await knex('dictionary_artists').insert({ name: 'YUNA', group_id: groupId });

    // Importing the same group artist must find the existing row, not insert a second.
    await mediaLibraryService.importMediaLibrary(payload('YUNA'));

    const rows = await knex('dictionary_artists').where({ name: 'YUNA', group_id: groupId });
    expect(rows.length).toBe(1);
  });

  function soloPayload() {
    return {
      version: 1,
      mode: 'merge',
      groups: [],
      soloArtists: [
        { name: SOLO_NAME, membership: { activityType: 'solo', status: 'active' }, songs: [] },
      ],
      events: [],
    };
  }

  it('imports a solo artist without crashing and does not duplicate on re-import', async () => {
    // Previously crashed: solo artists were inserted with group_id: null (NOT NULL column).
    await mediaLibraryService.importMediaLibrary(soloPayload());
    await mediaLibraryService.importMediaLibrary(soloPayload());

    const rows = await knex('dictionary_artists').where('name', SOLO_NAME);
    expect(rows.length).toBe(1);
  });
});
