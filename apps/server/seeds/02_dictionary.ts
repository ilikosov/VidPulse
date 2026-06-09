import { Knex } from 'knex';
import fs from 'fs';
import path from 'path';

type MediaLibraryData = {
  version: number;
  mode: 'merge' | 'replace';
  groups?: Array<{
    name: string;
    type?: string;
    active?: boolean;
    aliases?: string[];
    artists?: Array<{
      name: string;
      aliases?: string[];
      membership?: {
        activityType: string;
        status: string;
        from?: string;
        to?: string;
        isPrimary?: boolean;
      };
      songs?: Array<{ title: string; aliases?: string[] }>;
    }>;
    songs?: Array<{ title: string; aliases?: string[] }>;
  }>;
  soloArtists?: Array<{
    name: string;
    aliases?: string[];
    membership?: {
      activityType: string;
      status: string;
      from?: string;
      to?: string;
      isPrimary?: boolean;
    };
    songs?: Array<{ title: string; aliases?: string[] }>;
  }>;
  events?: Array<{
    name: string;
    aliases?: string[];
  }>;
};

export async function seed(knex: Knex): Promise<void> {
  // Load media-library.seed.json
  const seedPath = path.join(__dirname, '../examples/media-library.seed.json');
  const data: MediaLibraryData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));

  // ── Events ────────────────────────────────────────────────────────────────

  for (const event of data.events ?? []) {
    const existingEvent = await knex('dictionary_events').where({ name: event.name }).first();

    let eventId: number;
    if (existingEvent) {
      eventId = existingEvent.id;
    } else {
      const [id] = await knex('dictionary_events').insert({
        name: event.name,
      });
      eventId = id;
    }

    // Insert aliases
    for (const alias of event.aliases ?? []) {
      await knex('dictionary_aliases')
        .insert({
          entity_type: 'event',
          entity_id: eventId,
          alias,
        })
        .onConflict(['entity_type', 'entity_id', 'alias'])
        .ignore();
    }
  }

  // ── Groups ────────────────────────────────────────────────────────────────

  for (const group of data.groups ?? []) {
    const existingGroup = await knex('dictionary_groups').where({ name: group.name }).first();

    let groupId: number;
    if (existingGroup) {
      groupId = existingGroup.id;
    } else {
      const [id] = await knex('dictionary_groups').insert({
        name: group.name,
        type: group.type ?? 'mixed',
        active: group.active ?? true,
      });
      groupId = id;
    }

    // Insert group aliases
    for (const alias of group.aliases ?? []) {
      await knex('dictionary_aliases')
        .insert({
          entity_type: 'group',
          entity_id: groupId,
          alias,
        })
        .onConflict(['entity_type', 'entity_id', 'alias'])
        .ignore();
    }

    // ── Artists in group ──────────────────────────────────────────────────

    for (const artist of group.artists ?? []) {
      const existingArtist = await knex('dictionary_artists')
        .where({ name: artist.name, group_id: groupId })
        .first();

      let artistId: number;
      if (existingArtist) {
        artistId = existingArtist.id;
      } else {
        const [id] = await knex('dictionary_artists').insert({
          name: artist.name,
          group_id: groupId,
        });
        artistId = id;
      }

      // Insert artist aliases
      for (const alias of artist.aliases ?? []) {
        await knex('dictionary_aliases')
          .insert({
            entity_type: 'artist',
            entity_id: artistId,
            alias,
          })
          .onConflict(['entity_type', 'entity_id', 'alias'])
          .ignore();
      }

      // Insert/update artist membership
      if (artist.membership) {
        const existingMembership = await knex('dictionary_artist_memberships')
          .where({ artist_id: artistId, group_id: groupId })
          .first();

        const membershipData = {
          artist_id: artistId,
          group_id: groupId,
          activity_type: artist.membership.activityType,
          status: artist.membership.status,
          started_at: artist.membership.from ? new Date(artist.membership.from) : null,
          ended_at: artist.membership.to ? new Date(artist.membership.to) : null,
          is_primary: artist.membership.isPrimary ? 1 : 0,
        };

        if (existingMembership) {
          await knex('dictionary_artist_memberships')
            .where({ id: existingMembership.id })
            .update(membershipData);
        } else {
          await knex('dictionary_artist_memberships').insert(membershipData);
        }
      }

      // ── Songs for artist ──────────────────────────────────────────────

      for (const song of artist.songs ?? []) {
        const existingSong = await knex('dictionary_songs').where({ title: song.title }).first();

        let songId: number;
        if (existingSong) {
          songId = existingSong.id;
        } else {
          const [id] = await knex('dictionary_songs').insert({
            title: song.title,
          });
          songId = id;
        }

        // Insert song aliases
        for (const alias of song.aliases ?? []) {
          await knex('dictionary_aliases')
            .insert({
              entity_type: 'song',
              entity_id: songId,
              alias,
            })
            .onConflict(['entity_type', 'entity_id', 'alias'])
            .ignore();
        }

        // Link song to artist
        await knex('dictionary_song_artists')
          .insert({
            song_id: songId,
            artist_id: artistId,
          })
          .onConflict(['song_id', 'artist_id'])
          .ignore();

        // Link song to group
        await knex('dictionary_song_groups')
          .insert({
            song_id: songId,
            group_id: groupId,
          })
          .onConflict(['song_id', 'group_id'])
          .ignore();
      }
    }

    // ── Group-level songs ─────────────────────────────────────────────

    for (const song of group.songs ?? []) {
      const existingSong = await knex('dictionary_songs').where({ title: song.title }).first();

      let songId: number;
      if (existingSong) {
        songId = existingSong.id;
      } else {
        const [id] = await knex('dictionary_songs').insert({
          title: song.title,
        });
        songId = id;
      }

      // Insert song aliases
      for (const alias of song.aliases ?? []) {
        await knex('dictionary_aliases')
          .insert({
            entity_type: 'song',
            entity_id: songId,
            alias,
          })
          .onConflict(['entity_type', 'entity_id', 'alias'])
          .ignore();
      }

      // Link song to group
      await knex('dictionary_song_groups')
        .insert({
          song_id: songId,
          group_id: groupId,
        })
        .onConflict(['song_id', 'group_id'])
        .ignore();
    }
  }

  // ── Solo Artists ──────────────────────────────────────────────────────────

  for (const artist of data.soloArtists ?? []) {
    // Solo artists stored with a special "Solo Artists" group (since group_id is required)
    const soloGroupName = 'Solo Artists';
    const existingSoloGroup = await knex('dictionary_groups')
      .where({ name: soloGroupName })
      .first();

    let soloGroupId: number;
    if (existingSoloGroup) {
      soloGroupId = existingSoloGroup.id;
    } else {
      const [id] = await knex('dictionary_groups').insert({
        name: soloGroupName,
        type: 'solo',
        active: true,
      });
      soloGroupId = id;
    }

    const existingArtist = await knex('dictionary_artists')
      .where({ name: artist.name, group_id: soloGroupId })
      .first();

    let artistId: number;
    if (existingArtist) {
      artistId = existingArtist.id;
    } else {
      const [id] = await knex('dictionary_artists').insert({
        name: artist.name,
        group_id: soloGroupId,
      });
      artistId = id;
    }

    // Insert artist aliases
    for (const alias of artist.aliases ?? []) {
      await knex('dictionary_aliases')
        .insert({
          entity_type: 'artist',
          entity_id: artistId,
          alias,
        })
        .onConflict(['entity_type', 'entity_id', 'alias'])
        .ignore();
    }

    // Insert membership as solo
    if (artist.membership) {
      const existingMembership = await knex('dictionary_artist_memberships')
        .where({ artist_id: artistId })
        .first();

      const membershipData = {
        artist_id: artistId,
        group_id: null,
        activity_type: 'solo',
        status: artist.membership.status,
        started_at: artist.membership.from ? new Date(artist.membership.from) : null,
        ended_at: artist.membership.to ? new Date(artist.membership.to) : null,
        is_primary: artist.membership.isPrimary ? 1 : 0,
      };

      if (existingMembership) {
        await knex('dictionary_artist_memberships')
          .where({ id: existingMembership.id })
          .update(membershipData);
      } else {
        await knex('dictionary_artist_memberships').insert(membershipData);
      }
    }

    // Insert songs
    for (const song of artist.songs ?? []) {
      const existingSong = await knex('dictionary_songs').where({ title: song.title }).first();

      let songId: number;
      if (existingSong) {
        songId = existingSong.id;
      } else {
        const [id] = await knex('dictionary_songs').insert({
          title: song.title,
        });
        songId = id;
      }

      // Insert song aliases
      for (const alias of song.aliases ?? []) {
        await knex('dictionary_aliases')
          .insert({
            entity_type: 'song',
            entity_id: songId,
            alias,
          })
          .onConflict(['entity_type', 'entity_id', 'alias'])
          .ignore();
      }

      // Link song to artist
      await knex('dictionary_song_artists')
        .insert({
          song_id: songId,
          artist_id: artistId,
        })
        .onConflict(['song_id', 'artist_id'])
        .ignore();
    }
  }
}
