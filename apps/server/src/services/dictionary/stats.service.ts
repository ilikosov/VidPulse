import { knex } from '@vidpulse/db';
import { groupService } from './group.service';
import { artistService } from './artist.service';
import { songService } from './song.service';
import { eventService } from './event.service';

export interface DictionaryStats {
  groups: number;
  artists: number;
  songs: number;
  events: number;
  aliases: number;
  videosLinkedToGroups: number;
  videosLinkedToArtists: number;
  videosLinkedToSongs: number;
  videosLinkedToEvents: number;
  unmatched: {
    groups: number;
    artists: number;
    songs: number;
    events: number;
  };
}

export class StatsService {
  async getStats(): Promise<DictionaryStats> {
    const [groups, artists, songs, events, aliases, hasGroupId, hasArtistId, hasEventId] =
      await Promise.all([
        groupService.countGroups(),
        artistService.countArtists(),
        songService.countSongs(),
        eventService.countEvents(),
        knex('dictionary_aliases').count('* as count').first(),
        knex.schema.hasColumn('videos', 'group_id'),
        knex.schema.hasColumn('videos', 'artist_id'),
        knex.schema.hasColumn('videos', 'event_id'),
      ]);

    const [groupLinkedRow, artistLinkedRow, songLinkedRow, eventLinkedRow] = await Promise.all([
      hasGroupId
        ? knex('videos').whereNotNull('group_id').count('* as count').first()
        : knex('videos').whereNotNull('group_name').count('* as count').first(),
      hasArtistId
        ? knex('videos').whereNotNull('artist_id').count('* as count').first()
        : knex('videos').whereNotNull('artist_name').count('* as count').first(),
      knex('video_songs').whereNotNull('song_id').countDistinct('video_id as count').first(),
      hasEventId
        ? knex('videos').whereNotNull('event_id').count('* as count').first()
        : knex('videos').whereNotNull('event').count('* as count').first(),
    ]);

    return {
      groups,
      artists,
      songs,
      events,
      aliases: Number(aliases?.count || 0),
      videosLinkedToGroups: Number(groupLinkedRow?.count || 0),
      videosLinkedToArtists: Number(artistLinkedRow?.count || 0),
      videosLinkedToSongs: Number(songLinkedRow?.count || 0),
      videosLinkedToEvents: Number(eventLinkedRow?.count || 0),
      unmatched: {
        groups: Math.max(groups - Number(groupLinkedRow?.count || 0), 0),
        artists: Math.max(artists - Number(artistLinkedRow?.count || 0), 0),
        songs: Math.max(songs - Number(songLinkedRow?.count || 0), 0),
        events: Math.max(events - Number(eventLinkedRow?.count || 0), 0),
      },
    };
  }
}

export const statsService = new StatsService();
