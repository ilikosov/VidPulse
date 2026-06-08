import knex from '../db';
import { logger } from '../lib/logger';
import { youtubeService } from './youtube.service';
import { logEvent } from './eventLog.service';
import { parseTitle } from './parser/parser.service';
import { assignAutoTags } from './tag.service';
import { resolveParsedMetadata } from './parser/metadataResolver.service';
import { syncVideoSongs } from './parser/videoSongs.service';
import { channelRepository } from '../repositories/knex.repositories';
import { AppError } from '../middleware/AppError';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class DuplicateChannelError extends Error {
  constructor() {
    super('Channel already exists');
    this.name = 'DuplicateChannelError';
  }
}

class ChannelService {
  async getChannels(
    page: number,
    limit: number,
  ): Promise<{
    channels: any[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const offset = (page - 1) * limit;
    const channels = await channelRepository.findAllPaginated(limit, offset);
    const total = await channelRepository.count();
    const totalPages = Math.ceil(total / limit);
    return {
      channels,
      pagination: { page, limit, total, totalPages },
    };
  }

  async addChannelByUrl(url: string) {
    const channelId = await youtubeService.getChannelIdFromUrl(url);

    const existingChannel = await channelRepository.findByYoutubeId(channelId);
    if (existingChannel) {
      throw new DuplicateChannelError();
    }

    const channelDetails = await youtubeService.getChannelDetails(channelId);

    const newChannelId = await channelRepository.insert({
      youtube_id: channelId,
      title: channelDetails.title,
      thumbnail_url: channelDetails.thumbnail_url,
      added_at: new Date().toISOString(),
      last_checked_at: new Date().toISOString(),
    } as any);

    const newChannel = await channelRepository.findById(newChannelId);

    await logEvent('channel_added', `Added channel ${channelDetails.title} (${channelId})`, {
      youtube_id: channelId,
      title: channelDetails.title,
      channel_id: newChannelId,
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const publishedAfter = thirtyDaysAgo.toISOString();

    const videos = await youtubeService.fetchChannelVideos(channelId, publishedAfter);

    await knex.transaction(async (trx: any) => {
      for (const video of videos) {
        const existingVideo = await trx('videos').where('youtube_id', video.videoId).first();
        if (!existingVideo) {
          await trx('videos').insert({
            youtube_id: video.videoId,
            channel_id: newChannelId,
            original_title: video.title,
            published_at: video.publishedAt,
            status: 'new',
            description: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }
    });

    return newChannel;
  }

  async importChannels(
    urls: string[],
  ): Promise<{ total: number; added: number; skipped: number; errors: string[] }> {
    const errors: string[] = [];
    let added = 0;
    let skipped = 0;

    for (let index = 0; index < urls.length; index += 1) {
      const url = urls[index];
      try {
        await this.addChannelByUrl(url);
        added += 1;
      } catch (error: unknown) {
        if (error instanceof DuplicateChannelError) {
          skipped += 1;
        } else {
          errors.push(
            `Line ${index + 1}: ${url} - ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }
      if (index < urls.length - 1) {
        await sleep(150);
      }
    }

    return { total: urls.length, added, skipped, errors };
  }

  async getChannelDetails(id: number) {
    const channel = await channelRepository.findById(id);
    if (!channel) throw AppError.notFound('Channel not found');

    const total = await knex('videos').where('channel_id', id).count('* as count').first();
    const videoCount = Number(total?.count || 0);

    return { ...channel, videoCount };
  }

  async loadMoreVideos(id: number, count: number) {
    const channel = await channelRepository.findById(id);
    if (!channel) throw AppError.notFound('Channel not found');

    const oldest = await knex('videos')
      .where('channel_id', id)
      .min('published_at as oldest')
      .first();
    const fallbackDate = new Date();
    fallbackDate.setDate(fallbackDate.getDate() - 30);
    const publishedBefore = oldest?.oldest
      ? new Date(oldest.oldest).toISOString()
      : fallbackDate.toISOString();

    const fetchedVideos = await youtubeService.fetchChannelVideosOlderThan(
      channel.youtube_id,
      publishedBefore,
      count,
    );

    const errors: string[] = [];
    let loaded = 0;

    for (const item of fetchedVideos) {
      try {
        const exists = await knex('videos').where('youtube_id', item.videoId).first();
        if (exists) continue;

        const details = await youtubeService.getVideoDetails(item.videoId);
        const { metadata } = await parseTitle(
          details.title || item.title,
          details.publishedAt || item.publishedAt,
          details.tags,
        );

        const resolved = await resolveParsedMetadata(metadata);

        const [createdVideo] = await knex('videos')
          .insert({
            youtube_id: item.videoId,
            channel_id: channel.id,
            original_title: details.title || item.title,
            published_at: details.publishedAt || item.publishedAt,
            duration_seconds: details.durationSeconds ?? null,
            description: details.description ?? null,
            status: 'needs_review',
            perf_date: metadata.perf_date
              ? new Date(
                  `20${metadata.perf_date.slice(0, 2)}-${metadata.perf_date.slice(2, 4)}-${metadata.perf_date.slice(4, 6)}`,
                ).toISOString()
              : null,
            group_id: resolved.group_id,
            artist_id: resolved.artist_id,
            event_id: resolved.event_id,
            group_name: resolved.group_name,
            artist_name: resolved.artist_name,
            event: resolved.event,
            camera_type: metadata.camera_type || null,
            is_own_group_song: metadata.is_own_group_song ?? null,
            is_own_artist_song: metadata.is_own_artist_song ?? null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .returning('*');

        await assignAutoTags(createdVideo.id, details.durationSeconds, details.privacyStatus);
        await syncVideoSongs(
          createdVideo.id,
          resolved.song_title ?? undefined,
          metadata.song_titles,
        );
        loaded += 1;
      } catch (videoError: any) {
        errors.push(`${item.videoId}: ${videoError?.message ?? 'Unknown error'}`);
      }
    }

    return { loaded, total: fetchedVideos.length, errors };
  }

  async deleteChannel(id: number, removeVideos: boolean) {
    const channel = await channelRepository.findById(id);
    if (!channel) throw AppError.notFound('Channel not found');

    if (removeVideos) {
      await knex('videos').where('channel_id', id).delete();
    } else {
      await knex('videos').where('channel_id', id).update({ channel_id: null });
    }

    await channelRepository.delete(id);
  }
}

export const channelService = new ChannelService();
export { DuplicateChannelError };
