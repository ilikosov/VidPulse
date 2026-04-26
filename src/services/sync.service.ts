import knex from '../db';
import { youtubeService } from './youtube.service';
import { parseTitle } from './parser/parser.service';

const SYNC_INTERVAL_HOURS = 1;

/**
 * Parse metadata from title and return update data with status
 */
async function parseVideoMetadata(
  originalTitle: string,
  publishedAt?: string,
  tags?: string[],
): Promise<{
  metadata: Record<string, any>;
  status: string;
}> {
  const { metadata, needsReview } = await parseTitle(originalTitle, publishedAt, tags);

  const updateData: Record<string, any> = {};

  if (metadata.perf_date) {
    // Convert YYMMDD to proper date
    const dateStr = metadata.perf_date;
    updateData.perf_date = new Date(
      `20${dateStr.slice(0, 2)}-${dateStr.slice(2, 4)}-${dateStr.slice(4, 6)}`,
    ).toISOString();
  }

  if (metadata.group_name !== undefined) {
    updateData.group_name = metadata.group_name || null;
  }

  if (metadata.artist_name !== undefined) {
    updateData.artist_name = metadata.artist_name || null;
  }

  if (metadata.song_title !== undefined) {
    updateData.song_title = metadata.song_title || null;
  }

  if (metadata.event !== undefined) {
    updateData.event = metadata.event || null;
  }

  if (metadata.camera_type !== undefined) {
    updateData.camera_type = metadata.camera_type || null;
  }

  return {
    metadata: updateData,
    status: needsReview ? 'needs_review' : 'new',
  };
}

/**
 * Sync all channels - fetch new videos published since last check
 */
export async function syncChannels(): Promise<void> {
  console.log('Starting channel sync...');

  const channels = await knex('channels').select('*');

  for (const channel of channels) {
    try {
      const now = new Date();
      const lastCheckedAt = channel.last_checked_at ? new Date(channel.last_checked_at) : null;

      // Skip if checked within the last hour
      if (lastCheckedAt) {
        const hoursSinceLastCheck = (now.getTime() - lastCheckedAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastCheck < SYNC_INTERVAL_HOURS) {
          console.log(
            `Skipping channel ${channel.youtube_id} - checked ${hoursSinceLastCheck.toFixed(2)} hours ago`,
          );
          continue;
        }
      }

      // Determine publishedAfter date
      const publishedAfter = lastCheckedAt ? lastCheckedAt.toISOString() : now.toISOString();

      console.log(`Syncing channel ${channel.youtube_id} (since ${publishedAfter})...`);

      // Fetch new videos
      const videos = await youtubeService.fetchChannelVideos(channel.youtube_id, publishedAfter);

      // Insert new videos in a transaction
      if (videos.length > 0) {
        await knex.transaction(async (trx) => {
          for (const video of videos) {
            const existingVideo = await trx('videos').where('youtube_id', video.videoId).first();

            if (!existingVideo) {
              const details = await youtubeService.getVideoDetails(video.videoId);
              // Parse metadata from title
              const { metadata, status } = await parseVideoMetadata(
                details.title || video.title,
                details.publishedAt || video.publishedAt,
                details.tags,
              );

              await trx('videos').insert({
                youtube_id: video.videoId,
                channel_id: channel.id,
                original_title: details.title || video.title,
                published_at: details.publishedAt || video.publishedAt,
                status: status,
                ...metadata,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            }
          }
        });
        console.log(`Inserted ${videos.length} new videos for channel ${channel.youtube_id}`);
      } else {
        console.log(`No new videos for channel ${channel.youtube_id}`);
      }

      // Update last_checked_at
      await knex('channels').where('id', channel.id).update({ last_checked_at: now.toISOString() });
    } catch (error) {
      console.error(`Error syncing channel ${channel.youtube_id}:`, error);
      // Continue with next channel even if this one fails
    }
  }

  console.log('Channel sync completed.');
}

/**
 * Sync all playlists - fetch new videos added to playlists
 */
export async function syncPlaylists(): Promise<void> {
  console.log('Starting playlist sync...');

  const playlists = await knex('playlists').select('*');

  for (const playlist of playlists) {
    try {
      console.log(`Syncing playlist ${playlist.youtube_id}...`);

      // Fetch all playlist items
      const videos = await youtubeService.fetchPlaylistItems(playlist.youtube_id);

      // Get existing video IDs for this playlist
      const existingVideos = await knex('videos')
        .where('playlist_id', playlist.id)
        .select('youtube_id');
      const existingVideoIds = new Set(existingVideos.map((v) => v.youtube_id));

      // Insert new videos in a transaction
      const newVideos = videos.filter((v) => !existingVideoIds.has(v.videoId));

      if (newVideos.length > 0) {
        await knex.transaction(async (trx) => {
          for (const video of newVideos) {
            // Also check if video exists in DB at all (might be from another playlist/channel)
            const anyExistingVideo = await trx('videos').where('youtube_id', video.videoId).first();

            if (!anyExistingVideo) {
              const details = await youtubeService.getVideoDetails(video.videoId);
              // Parse metadata from title
              const { metadata, status } = await parseVideoMetadata(
                details.title || video.title,
                details.publishedAt || video.publishedAt,
                details.tags,
              );

              await trx('videos').insert({
                youtube_id: video.videoId,
                playlist_id: playlist.id,
                original_title: details.title || video.title,
                published_at: details.publishedAt || video.publishedAt,
                status: status,
                ...metadata,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            }
          }
        });
        console.log(`Inserted ${newVideos.length} new videos for playlist ${playlist.youtube_id}`);
      } else {
        console.log(`No new videos for playlist ${playlist.youtube_id}`);
      }

      // Update last_checked_at
      await knex('playlists')
        .where('id', playlist.id)
        .update({ last_checked_at: new Date().toISOString() });
    } catch (error) {
      console.error(`Error syncing playlist ${playlist.youtube_id}:`, error);
      // Continue with next playlist even if this one fails
    }
  }

  console.log('Playlist sync completed.');
}

/**
 * Start the cron scheduler for daily sync
 */
export function runScheduler(): void {
  const cronTime = process.env.SYNC_CRON_TIME || '0 3 * * *'; // Default: 3 AM daily

  import('node-cron')
    .then((cron) => {
      const job = cron.schedule(cronTime, async () => {
        console.log('Running scheduled sync...');
        try {
          await syncChannels();
          await syncPlaylists();
          console.log('Scheduled sync completed.');
        } catch (error) {
          console.error('Scheduled sync failed:', error);
        }
      });

      console.log(`Sync scheduler started with cron pattern: ${cronTime}`);
    })
    .catch((error) => {
      console.error('Failed to start sync scheduler:', error);
    });
}
