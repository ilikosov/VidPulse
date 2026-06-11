import knex from '../../db';
import type Knex from 'knex';
import { type DbClient, normalizeName, attachSongs } from './utils';
import { config } from '../../config';

export class SongService {
  async findSongByTitleOrAlias(trx: DbClient, title: string) {
    const normalized = normalizeName(title);
    const byTitle = await trx('dictionary_songs')
      .whereRaw('LOWER(title) = ?', [normalized])
      .first();
    if (byTitle) return byTitle;
    const alias = await trx('dictionary_aliases')
      .where({ entity_type: 'song' })
      .andWhereRaw('LOWER(alias) = ?', [normalized])
      .first();
    if (!alias) return null;
    return trx('dictionary_songs').where({ id: alias.entity_id }).first();
  }

  async getSongs(q?: string, limit = 20, offset = 0) {
    const query = knex('dictionary_songs as s')
      .select('s.id', 's.title', 's.artist')
      .leftJoin('dictionary_song_artists as sa', 'sa.song_id', 's.id')
      .leftJoin('dictionary_artists as a', 'a.id', 'sa.artist_id')
      .leftJoin('dictionary_song_groups as sg', 'sg.song_id', 's.id')
      .leftJoin('dictionary_groups as g', 'g.id', 'sg.group_id')
      .leftJoin('dictionary_aliases as soa', function joinSongAliasCount() {
        this.on('soa.entity_id', '=', 's.id').andOnVal('soa.entity_type', 'song');
      })
      .groupBy('s.id')
      .orderBy('s.title')
      .select(
        knex.raw('MIN(a.id) as artist_id'),
        knex.raw('MIN(a.name) as artist_name'),
        knex.raw('MIN(g.id) as group_id'),
        knex.raw('MIN(g.name) as group_name'),
      )
      .countDistinct('vs.video_id as videos_count')
      .countDistinct('soa.id as aliases_count')
      .leftJoin('video_songs as vs', 'vs.song_id', 's.id');

    if (q) {
      query.where((builder) => {
        builder.whereILike('s.title', `%${q}%`).orWhereILike('soa.alias', `%${q}%`);
      });
    }

    return query.limit(limit).offset(offset);
  }

  async getAllSongs(q?: string) {
    return this.getSongs(q, Number.MAX_SAFE_INTEGER, 0);
  }

  async countSongs(q?: string) {
    const query = knex('dictionary_songs as s').countDistinct('s.id as count');
    if (q) {
      query
        .leftJoin('dictionary_aliases as sa', function joinAlias() {
          this.on('sa.entity_id', '=', 's.id').andOnVal('sa.entity_type', 'song');
        })
        .where((builder) =>
          builder.whereILike('s.title', `%${q}%`).orWhereILike('sa.alias', `%${q}%`),
        );
    }
    const row = await query.first();
    return Number(row?.count || 0);
  }

  async getSongById(id: number) {
    const song = await knex('dictionary_songs')
      .select('id', 'title', 'artist')
      .where({ id })
      .first();
    if (!song) return null;

    const artists = await knex('dictionary_song_artists as sa')
      .select('a.id', 'a.name', 'a.group_id', 'g.name as group_name')
      .leftJoin('dictionary_artists as a', 'a.id', 'sa.artist_id')
      .leftJoin('dictionary_groups as g', 'g.id', 'a.group_id')
      .where('sa.song_id', id)
      .orderBy('a.name');

    const groups = await knex('dictionary_song_groups as sg')
      .select('g.id', 'g.name', 'g.type', 'g.active')
      .leftJoin('dictionary_groups as g', 'g.id', 'sg.group_id')
      .where('sg.song_id', id)
      .orderBy('g.name');

    return {
      ...song,
      artist_id: artists[0]?.id,
      artist_name: artists[0]?.name,
      group_id: groups[0]?.id ?? artists[0]?.group_id,
      group_name: groups[0]?.name ?? artists[0]?.group_name,
      artists,
      groups,
    };
  }

  async getVideosBySongId(songId: number, page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const offset = (safePage - 1) * safeLimit;
    const base = knex('videos_display as videos').whereIn(
      'videos.id',
      knex('video_songs').select('video_id').where('song_id', songId),
    );
    if (config.hideFlaggedVideos) {
      base.whereNotIn('videos.id', function () {
        this.select('v2.id')
          .from('videos as v2')
          .join('video_tags as vt2', 'vt2.video_id', 'v2.id')
          .join('tags as t2', 't2.id', 'vt2.tag_id')
          .whereIn('t2.name', ['shorts', 'private']);
      });
    }
    const videos = await base
      .clone()
      .select('videos.*')
      .orderBy('videos.created_at', 'desc')
      .limit(safeLimit)
      .offset(offset);
    const totalRow = await base.clone().count('* as count').first();
    const total = Number(totalRow?.count || 0);
    return {
      videos: await attachSongs(videos),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async createSong(payload: {
    title: string;
    artist: string;
    artist_ids?: number[];
    group_ids?: number[];
  }) {
    const [songId] = await knex('dictionary_songs').insert({
      title: payload.title,
      artist: payload.artist,
    });

    if (payload.artist_ids?.length) {
      const links = payload.artist_ids.map((artistId) => ({
        song_id: songId,
        artist_id: artistId,
      }));
      await knex('dictionary_song_artists')
        .insert(links)
        .onConflict(['song_id', 'artist_id'])
        .ignore();
    }
    if (payload.group_ids?.length) {
      const links = payload.group_ids.map((groupId) => ({ song_id: songId, group_id: groupId }));
      await knex('dictionary_song_groups')
        .insert(links)
        .onConflict(['song_id', 'group_id'])
        .ignore();
    }
    return songId;
  }

  async updateSong(
    id: number,
    payload: { title: string; artist: string; artist_ids?: number[]; group_ids?: number[] },
  ) {
    await knex('dictionary_songs')
      .where({ id })
      .update({ title: payload.title, artist: payload.artist });

    if (payload.artist_ids) {
      await knex('dictionary_song_artists').where({ song_id: id }).delete();
      if (payload.artist_ids.length) {
        const links = payload.artist_ids.map((artistId) => ({ song_id: id, artist_id: artistId }));
        await knex('dictionary_song_artists')
          .insert(links)
          .onConflict(['song_id', 'artist_id'])
          .ignore();
      }
    }

    if (payload.group_ids) {
      await knex('dictionary_song_groups').where({ song_id: id }).delete();
      if (payload.group_ids.length) {
        const links = payload.group_ids.map((groupId) => ({ song_id: id, group_id: groupId }));
        await knex('dictionary_song_groups')
          .insert(links)
          .onConflict(['song_id', 'group_id'])
          .ignore();
      }
    }
    return id;
  }

  async deleteSong(id: number) {
    return knex('dictionary_songs').where({ id }).delete();
  }
}

export const songService = new SongService();
