import knex from '../../db';
import type Knex from 'knex';
import { groupService } from './group.service';
import { artistService } from './artist.service';
import { songService } from './song.service';
import { eventService } from './event.service';
import {
  type AliasEntityType,
  type DbClient,
  type DictionaryGroupType,
  type MembershipActivityType,
  type MembershipStatus,
  addAliasesIfMissing,
  normalizeName,
} from './utils';

export interface ImportSummary {
  total: number;
  inserted: number;
  updated: number;
  errors: string[];
}

export interface MediaLibraryImportSummary {
  mode: 'merge' | 'replace';
  groups: { inserted: number; updated: number; aliasesInserted: number };
  artists: {
    inserted: number;
    updated: number;
    aliasesInserted: number;
    membershipsInserted: number;
  };
  songs: {
    inserted: number;
    updated: number;
    aliasesInserted: number;
    artistLinksInserted: number;
    groupLinksInserted: number;
  };
  events: { inserted: number; updated: number; aliasesInserted: number };
  errors: string[];
}

export interface MediaLibraryExportPayload {
  version: 1;
  mode: 'merge';
  exportedAt: string;
  groups: any[];
  soloArtists: any[];
  events: any[];
}

export interface ClearMediaLibrarySummary {
  cleared: {
    groups: number;
    artists: number;
    songs: number;
    events: number;
    aliases: number;
    memberships: number;
    songArtistLinks: number;
    songGroupLinks: number;
  };
  videosUpdated: number;
}

type ImportRecord = Record<string, unknown> & { type?: string };

export class MediaLibraryService {
  // Dedupe artists within a single group. Same name in a different group is a
  // legitimately distinct row (dictionary_artists has UNIQUE(name, group_id)), so we
  // scope by group_id and only compare names — never match an artist from another group.
  // Names are compared via normalizeName (NFKC + collapsed whitespace), like
  // ArtistService.findArtistByNameOrAlias, because SQLite LOWER() only folds ASCII.
  private async findArtistInGroup(db: DbClient, name: string, groupId: number) {
    const normalized = normalizeName(name);
    const byName = await db('dictionary_artists')
      .where({ group_id: groupId })
      .whereRaw('LOWER(name) = ?', [normalized])
      .first();
    if (byName) return byName;
    const match = (
      await db('dictionary_artists').where({ group_id: groupId }).select('id', 'name')
    ).find((a) => normalizeName(a.name) === normalized);
    if (match) return db('dictionary_artists').where({ id: match.id }).first();
    return null;
  }

  private async importSongNode(
    db: DbClient,
    songPayload: any,
    context: {
      artist?: { id: number; name: string };
      group?: { id: number; name: string };
    },
    summary: MediaLibraryImportSummary,
  ) {
    const title = String(songPayload.title || '').trim();
    if (!title) return null;

    let song = await songService.findSongByTitleOrAlias(db, title);
    if (!song) {
      const [songId] = await db('dictionary_songs').insert({
        title,
        artist: context.artist?.name ?? context.group?.name ?? '',
      });
      song = await db('dictionary_songs').where({ id: songId }).first();
      summary.songs.inserted += 1;
    } else {
      summary.songs.updated += 1;
    }

    if (context.artist) {
      const insertedArtistLink = await db('dictionary_song_artists')
        .insert({ song_id: song.id, artist_id: context.artist.id })
        .onConflict(['song_id', 'artist_id'])
        .ignore();
      if (Array.isArray(insertedArtistLink) && insertedArtistLink.length > 0) {
        summary.songs.artistLinksInserted += 1;
      }
    }

    if (context.group) {
      const insertedGroupLink = await db('dictionary_song_groups')
        .insert({ song_id: song.id, group_id: context.group.id })
        .onConflict(['song_id', 'group_id'])
        .ignore();
      if (Array.isArray(insertedGroupLink) && insertedGroupLink.length > 0) {
        summary.songs.groupLinksInserted += 1;
      }
    }

    summary.songs.aliasesInserted += await addAliasesIfMissing(
      db,
      'song',
      song.id,
      songPayload.aliases,
      song.title,
    );

    return song;
  }

  async importRecords(records: ImportRecord[]): Promise<ImportSummary> {
    const summary: ImportSummary = { total: records.length, inserted: 0, updated: 0, errors: [] };
    for (const [index, row] of records.entries()) {
      try {
        const kind = String(row.type || '').toLowerCase();
        if (kind === 'groups') {
          const name = String(row.name || '').trim();
          const type = String(
            row.group_type ||
              row.type_value ||
              row.groupType ||
              row['type_group'] ||
              row['groupType'] ||
              row['type_name'] ||
              row['group_type'] ||
              row['category'] ||
              row['subtype'] ||
              row['type2'] ||
              row['groupTypeValue'] ||
              row['group_type_value'] ||
              row['group-type'] ||
              row['typeLabel'] ||
              row['type'] ||
              '',
          ).trim();
          const active =
            row.active === undefined
              ? true
              : String(row.active) !== '0' && String(row.active).toLowerCase() !== 'false';
          if (!name || !['male', 'female', 'mixed'].includes(type))
            throw new Error('Invalid group payload');
          const existing = await knex('dictionary_groups').where({ name }).first();
          if (existing) {
            await knex('dictionary_groups').where({ id: existing.id }).update({ type, active });
            summary.updated += 1;
          } else {
            await knex('dictionary_groups').insert({ name, type, active });
            summary.inserted += 1;
          }
        } else if (kind === 'artists') {
          const name = String(row.name || '').trim();
          const group_id =
            row.group_id == null || row.group_id === '' ? null : Number(row.group_id);
          if (!name) throw new Error('Invalid artist payload');
          let artist = await knex('dictionary_artists').where({ name }).first();
          if (!artist) {
            const [artistId] = await knex('dictionary_artists').insert({ name, group_id });
            artist = { id: artistId, name, group_id };
            summary.inserted += 1;
          } else {
            await knex('dictionary_artists')
              .where({ id: artist.id })
              .update({ name, group_id: group_id ?? artist.group_id });
            summary.updated += 1;
          }

          const activity_type = String(
            row.activity_type || (group_id ? 'group' : 'solo'),
          ).toLowerCase() as MembershipActivityType;
          const status = String(row.status || 'active').toLowerCase() as MembershipStatus;
          const started_at = row.started_at ? String(row.started_at) : null;
          const ended_at = row.ended_at ? String(row.ended_at) : null;
          const is_primary =
            String(row.is_primary ?? (group_id ? 'true' : 'false')).toLowerCase() === 'true';
          await artistService.addOrUpdateArtistMembership({
            artist_id: Number(artist.id),
            group_id,
            activity_type,
            status,
            started_at,
            ended_at,
            is_primary,
          });
        } else if (kind === 'songs') {
          const title = String(row.title || '').trim();
          const artist = String(row.artist || '').trim();
          if (!title || !artist) throw new Error('Invalid song payload');
          const existing = await knex('dictionary_songs').where({ title, artist }).first();
          if (existing) {
            await knex('dictionary_songs').where({ id: existing.id }).update({ title, artist });
            summary.updated += 1;
          } else {
            await knex('dictionary_songs').insert({ title, artist });
            summary.inserted += 1;
          }
        } else if (kind === 'aliases') {
          const entityType = String(row.entity_type || '')
            .trim()
            .toLowerCase() as AliasEntityType;
          const entityName = String(row.entity_name || '').trim();
          const alias = String(row.alias || '').trim();
          const normalizedAlias = alias.toLowerCase();
          if (!['group', 'artist', 'song'].includes(entityType) || !entityName || !alias) {
            throw new Error('Invalid alias payload');
          }

          let entityId: number | null = null;
          if (entityType === 'group') {
            const group = await knex('dictionary_groups')
              .whereRaw('LOWER(name) = ?', [entityName.toLowerCase()])
              .first();
            entityId = group?.id ?? null;
          } else if (entityType === 'artist') {
            const artist = await knex('dictionary_artists')
              .whereRaw('LOWER(name) = ?', [entityName.toLowerCase()])
              .first();
            entityId = artist?.id ?? null;
          } else {
            const song = await knex('dictionary_songs')
              .whereRaw('LOWER(title) = ?', [entityName.toLowerCase()])
              .first();
            entityId = song?.id ?? null;
          }

          if (!entityId) {
            throw new Error('Alias entity not found');
          }

          const existingAlias = await knex('dictionary_aliases')
            .where({ entity_type: entityType, entity_id: entityId })
            .andWhereRaw('LOWER(alias) = ?', [normalizedAlias])
            .first();
          if (existingAlias) {
            summary.updated += 1;
          } else {
            await knex('dictionary_aliases').insert({
              entity_type: entityType,
              entity_id: entityId,
              alias,
            });
            summary.inserted += 1;
          }
        } else if (kind === 'events') {
          const name = String(row.name || '').trim();
          if (!name) throw new Error('Invalid event payload');
          const existing = await knex('dictionary_events').where({ name }).first();
          if (existing) {
            summary.updated += 1;
          } else {
            await knex('dictionary_events').insert({ name });
            summary.inserted += 1;
          }
        } else throw new Error('Unknown type');
      } catch (e) {
        summary.errors.push(`row ${index + 1}: ${(e as Error).message}`);
      }
    }
    return summary;
  }

  async importMediaLibrary(
    payload: unknown,
    options?: {
      onProgress?: (progress: {
        phase:
          | 'queued'
          | 'validating'
          | 'clearing'
          | 'groups'
          | 'artists'
          | 'songs'
          | 'events'
          | 'completed'
          | 'failed';
        processed: number;
        total: number;
        message?: string;
        summary?: Partial<MediaLibraryImportSummary>;
      }) => void;
    },
  ): Promise<MediaLibraryImportSummary> {
    const data = (payload ?? {}) as Record<string, any>;
    const mode = data.mode === 'replace' ? 'replace' : 'merge';
    const summary: MediaLibraryImportSummary = {
      mode,
      groups: { inserted: 0, updated: 0, aliasesInserted: 0 },
      artists: { inserted: 0, updated: 0, aliasesInserted: 0, membershipsInserted: 0 },
      songs: {
        inserted: 0,
        updated: 0,
        aliasesInserted: 0,
        artistLinksInserted: 0,
        groupLinksInserted: 0,
      },
      events: { inserted: 0, updated: 0, aliasesInserted: 0 },
      errors: [],
    };

    const groups = Array.isArray(data.groups) ? data.groups : [];
    const soloArtists = Array.isArray(data.soloArtists) ? data.soloArtists : [];
    const events = Array.isArray(data.events) ? data.events : [];
    const groupArtistsCount = groups.reduce(
      (acc: number, g: any) => acc + (Array.isArray(g.artists) ? g.artists.length : 0),
      0,
    );
    const groupArtistSongsCount = groups.reduce(
      (acc: number, g: any) =>
        acc +
        (Array.isArray(g.artists)
          ? g.artists.reduce(
              (a: number, ar: any) => a + (Array.isArray(ar.songs) ? ar.songs.length : 0),
              0,
            )
          : 0),
      0,
    );
    const groupSongsCount = groups.reduce(
      (acc: number, g: any) => acc + (Array.isArray(g.songs) ? g.songs.length : 0),
      0,
    );
    const soloArtistSongsCount = soloArtists.reduce(
      (acc: number, a: any) => acc + (Array.isArray(a.songs) ? a.songs.length : 0),
      0,
    );
    const total =
      groups.length +
      groupArtistsCount +
      groupArtistSongsCount +
      groupSongsCount +
      soloArtists.length +
      soloArtistSongsCount +
      events.length;
    let processed = 0;
    const emit = (
      phase:
        | 'validating'
        | 'clearing'
        | 'groups'
        | 'artists'
        | 'songs'
        | 'events'
        | 'completed'
        | 'failed',
      message?: string,
    ) => {
      options?.onProgress?.({ phase, processed, total, message, summary });
    };

    emit('validating', 'Validating JSON payload');

    await knex.transaction(async (trx) => {
      for (const groupPayload of groups) {
        const groupName = String(groupPayload.name || '').trim();
        let group = await groupService.findGroupByNameOrAlias(
          trx as unknown as DbClient,
          groupName,
        );
        if (!group) {
          if (!groupPayload.type) throw new Error(`Group "${groupName}" requires type`);
          const [id] = await trx('dictionary_groups').insert({
            name: groupName,
            type: String(groupPayload.type),
            active: groupPayload.active ?? true,
          });
          group = await trx('dictionary_groups').where({ id }).first();
          summary.groups.inserted += 1;
        } else {
          summary.groups.updated += 1;
        }
        summary.groups.aliasesInserted += await addAliasesIfMissing(
          trx as unknown as DbClient,
          'group',
          group.id,
          groupPayload.aliases,
          group.name,
        );
        processed += 1;
        emit('groups', `Importing groups: ${groupName}`);

        for (const artistPayload of Array.isArray(groupPayload.artists)
          ? groupPayload.artists
          : []) {
          const artistName = String(artistPayload.name || '').trim();
          // Dedupe within this group only. A name-only lookup would treat "YUNA in ITZY"
          // and a solo "YUNA" as the same artist and skip the insert, attaching the artist
          // to the wrong group (and producing a phantom duplicate on export).
          let artist = await this.findArtistInGroup(
            trx as unknown as DbClient,
            artistName,
            group.id,
          );
          if (!artist) {
            const [artistId] = await trx('dictionary_artists').insert({
              name: artistName,
              group_id: group.id,
            });
            artist = await trx('dictionary_artists').where({ id: artistId }).first();
            summary.artists.inserted += 1;
          } else summary.artists.updated += 1;
          summary.artists.aliasesInserted += await addAliasesIfMissing(
            trx as unknown as DbClient,
            'artist',
            artist.id,
            artistPayload.aliases,
            artist.name,
          );
          await artistService.addOrUpdateArtistMembership(
            {
              artist_id: artist.id,
              group_id: group.id,
              activity_type: 'group',
              status: (artistPayload.membership?.status || 'active') as MembershipStatus,
              started_at: artistPayload.membership?.from ?? null,
              ended_at: artistPayload.membership?.to ?? null,
              is_primary: artistPayload.membership?.isPrimary ?? false,
            },
            trx as unknown as DbClient,
          );
          summary.artists.membershipsInserted += 1;
          processed += 1;
          emit('artists', `Importing artists: ${artistName}`);

          for (const songPayload of Array.isArray(artistPayload.songs) ? artistPayload.songs : []) {
            await this.importSongNode(
              trx as unknown as DbClient,
              songPayload,
              { artist, group },
              summary,
            );
            processed += 1;
            emit('songs', `Importing songs: ${String(songPayload.title || '').trim()}`);
          }
        }

        for (const songPayload of Array.isArray(groupPayload.songs) ? groupPayload.songs : []) {
          await this.importSongNode(trx as unknown as DbClient, songPayload, { group }, summary);
          processed += 1;
          emit('songs', `Importing songs: ${String(songPayload.title || '').trim()}`);
        }
      }

      // Solo artists live under a dedicated "Solo Artists" group, mirroring
      // seeds/02_dictionary.ts. dictionary_artists.group_id is NOT NULL, so a real
      // group id is required; inserting group_id: null here crashes the transaction.
      let soloGroupId: number | null = null;
      if (soloArtists.length > 0) {
        const soloGroupName = 'Solo Artists';
        let soloGroup = await trx('dictionary_groups').where({ name: soloGroupName }).first();
        if (!soloGroup) {
          const [id] = await trx('dictionary_groups').insert({
            name: soloGroupName,
            type: 'solo',
            active: true,
          });
          soloGroup = await trx('dictionary_groups').where({ id }).first();
        }
        soloGroupId = soloGroup.id;
      }

      for (const soloPayload of soloArtists) {
        const artistName = String(soloPayload.name || '').trim();
        // Dedupe within the "Solo Artists" group — consistent with the seed and group path.
        let artist = await this.findArtistInGroup(
          trx as unknown as DbClient,
          artistName,
          soloGroupId as number,
        );
        if (!artist) {
          const [artistId] = await trx('dictionary_artists').insert({
            name: artistName,
            group_id: soloGroupId,
          });
          artist = await trx('dictionary_artists').where({ id: artistId }).first();
          summary.artists.inserted += 1;
        } else summary.artists.updated += 1;
        summary.artists.aliasesInserted += await addAliasesIfMissing(
          trx as unknown as DbClient,
          'artist',
          artist.id,
          soloPayload.aliases,
          artist.name,
        );
        await artistService.addOrUpdateArtistMembership(
          {
            artist_id: artist.id,
            group_id: null,
            activity_type: 'solo',
            status: (soloPayload.membership?.status || 'active') as MembershipStatus,
            started_at: soloPayload.membership?.from ?? null,
            ended_at: soloPayload.membership?.to ?? null,
            is_primary: soloPayload.membership?.isPrimary ?? true,
          },
          trx as unknown as DbClient,
        );
        summary.artists.membershipsInserted += 1;
        processed += 1;
        emit('artists', `Importing artists: ${artistName}`);

        for (const songPayload of Array.isArray(soloPayload.songs) ? soloPayload.songs : []) {
          await this.importSongNode(trx as unknown as DbClient, songPayload, { artist }, summary);
          processed += 1;
          emit('songs', `Importing songs: ${String(songPayload.title || '').trim()}`);
        }
      }

      for (const eventPayload of events) {
        const name = String(eventPayload.name || '').trim();
        let event = await eventService.findEventByNameOrAlias(trx as unknown as DbClient, name);
        if (!event) {
          const [id] = await trx('dictionary_events').insert({ name });
          event = await trx('dictionary_events').where({ id }).first();
          summary.events.inserted += 1;
        } else summary.events.updated += 1;
        summary.events.aliasesInserted += await addAliasesIfMissing(
          trx as unknown as DbClient,
          'event',
          event.id,
          eventPayload.aliases,
          event.name,
        );
        processed += 1;
        emit('events', `Importing events: ${name}`);
      }
    });

    emit('completed', 'Completed');
    return summary;
  }

  async exportMediaLibrary(): Promise<MediaLibraryExportPayload> {
    const [groups, artists, songs, events, aliases, memberships, songArtists, songGroups] =
      await Promise.all([
        knex('dictionary_groups').select('*'),
        knex('dictionary_artists').select('*'),
        knex('dictionary_songs').select('*'),
        knex('dictionary_events').select('*'),
        knex('dictionary_aliases').select('*'),
        knex('dictionary_artist_memberships').select('*'),
        knex('dictionary_song_artists').select('*'),
        knex('dictionary_song_groups').select('*'),
      ]);

    const aliasesByEntity = new Map<string, string[]>();
    for (const a of aliases) {
      const key = `${a.entity_type}:${a.entity_id}`;
      if (!aliasesByEntity.has(key)) aliasesByEntity.set(key, []);
      aliasesByEntity.get(key)!.push(a.alias);
    }

    const artistById = new Map(artists.map((a) => [a.id, a]));
    const songsById = new Map(songs.map((s) => [s.id, s]));
    const songArtistSet = new Set(songArtists.map((r) => `${r.song_id}:${r.artist_id}`));
    const songGroupSet = new Set(songGroups.map((r) => `${r.song_id}:${r.group_id}`));

    const groupsPayload = groups.map((group) => {
      const groupMemberships = memberships.filter(
        (m) => m.group_id === group.id && m.activity_type === 'group',
      );

      const artistsPayload = groupMemberships.map((m) => {
        const artist = artistById.get(m.artist_id);
        const artistSongs = songs
          .filter(
            (s) =>
              songArtistSet.has(`${s.id}:${artist.id}`) && songGroupSet.has(`${s.id}:${group.id}`),
          )
          .map((s) => ({
            title: s.title,
            aliases: aliasesByEntity.get(`song:${s.id}`) ?? [],
          }));
        return {
          name: artist.name,
          aliases: aliasesByEntity.get(`artist:${artist.id}`) ?? [],
          membership: {
            activityType: m.activity_type,
            status: m.status,
            from: m.started_at ?? null,
            to: m.ended_at ?? null,
            isPrimary: Boolean(m.is_primary),
          },
          songs: artistSongs,
        };
      });

      const artistSongIdsInGroup = new Set<number>();
      for (const s of songs) {
        if (!songGroupSet.has(`${s.id}:${group.id}`)) continue;
        const hasArtistInGroup = artistsPayload.some((a) => {
          const ar = artists.find((x) => x.name === a.name);
          return ar ? songArtistSet.has(`${s.id}:${ar.id}`) : false;
        });
        if (hasArtistInGroup) artistSongIdsInGroup.add(s.id);
      }

      const groupSongs = songs
        .filter((s) => songGroupSet.has(`${s.id}:${group.id}`) && !artistSongIdsInGroup.has(s.id))
        .map((s) => ({ title: s.title, aliases: aliasesByEntity.get(`song:${s.id}`) ?? [] }));

      return {
        name: group.name,
        type: group.type,
        active: Boolean(group.active),
        aliases: aliasesByEntity.get(`group:${group.id}`) ?? [],
        artists: artistsPayload,
        songs: groupSongs,
      };
    });

    const soloArtistsPayload = memberships
      .filter((m) => m.activity_type === 'solo')
      .map((m) => {
        const artist = artistById.get(m.artist_id);
        const soloSongs = songs
          .filter((s) => songArtistSet.has(`${s.id}:${artist.id}`))
          .filter((s) => !songGroups.some((sg) => sg.song_id === s.id))
          .map((s) => ({ title: s.title, aliases: aliasesByEntity.get(`song:${s.id}`) ?? [] }));
        return {
          name: artist.name,
          aliases: aliasesByEntity.get(`artist:${artist.id}`) ?? [],
          membership: {
            activityType: 'solo',
            status: m.status,
            from: m.started_at ?? null,
            to: m.ended_at ?? null,
            isPrimary: Boolean(m.is_primary),
          },
          songs: soloSongs,
        };
      });

    const eventsPayload = events.map((e) => ({
      name: e.name,
      aliases: aliasesByEntity.get(`event:${e.id}`) ?? [],
    }));

    return {
      version: 1,
      mode: 'merge',
      exportedAt: new Date().toISOString(),
      groups: groupsPayload,
      soloArtists: soloArtistsPayload,
      events: eventsPayload,
    };
  }

  async clearMediaLibrary(): Promise<ClearMediaLibrarySummary> {
    return knex.transaction(async (trx) => {
      const [
        groups,
        artists,
        songs,
        events,
        aliases,
        memberships,
        songArtistLinks,
        songGroupLinks,
      ] = await Promise.all([
        trx('dictionary_groups').count<{ count: number }>('id as count').first(),
        trx('dictionary_artists').count<{ count: number }>('id as count').first(),
        trx('dictionary_songs').count<{ count: number }>('id as count').first(),
        trx('dictionary_events').count<{ count: number }>('id as count').first(),
        trx('dictionary_aliases').count<{ count: number }>('id as count').first(),
        trx('dictionary_artist_memberships').count<{ count: number }>('id as count').first(),
        trx('dictionary_song_artists').count<{ count: number }>('song_id as count').first(),
        trx('dictionary_song_groups').count<{ count: number }>('song_id as count').first(),
      ]);

      await trx('video_songs').update({ song_id: null });
      const videosUpdated = await trx('videos').update({
        group_id: null,
        artist_id: null,
        event_id: null,
        group_name: null,
        artist_name: null,
        event: null,
      });

      await trx('dictionary_aliases').del();
      await trx('dictionary_song_artists').del();
      await trx('dictionary_song_groups').del();
      await trx('dictionary_artist_memberships').del();
      await trx('dictionary_songs').del();
      await trx('dictionary_artists').del();
      await trx('dictionary_events').del();
      await trx('dictionary_groups').del();

      return {
        cleared: {
          groups: Number(groups?.count || 0),
          artists: Number(artists?.count || 0),
          songs: Number(songs?.count || 0),
          events: Number(events?.count || 0),
          aliases: Number(aliases?.count || 0),
          memberships: Number(memberships?.count || 0),
          songArtistLinks: Number(songArtistLinks?.count || 0),
          songGroupLinks: Number(songGroupLinks?.count || 0),
        },
        videosUpdated: Number(videosUpdated || 0),
      };
    });
  }
}

export const mediaLibraryService = new MediaLibraryService();
