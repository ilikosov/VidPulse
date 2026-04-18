import { createWorker, SYNC_CHANNEL_QUEUE } from '@youtube-sync/queue';
import { prisma } from '@youtube-sync/db';
import { YouTubeService } from '@youtube-sync/youtube';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

if (!YOUTUBE_API_KEY) {
  console.error('YOUTUBE_API_KEY environment variable is required');
  process.exit(1);
}

const youtubeService = new YouTubeService(YOUTUBE_API_KEY);

/**
 * Process a sync channel job:
 * 1. Fetch videos from YouTube for the channel
 * 2. Ensure channel exists in DB (or create it)
 * 3. Upsert videos with deduplication by videoId
 * 4. Update lastSyncedAt timestamp
 */
async function processSyncJob(job: { data: { channelId: string } }) {
  const { channelId } = job.data;

  console.log(`Processing sync job for channel: ${channelId}`);

  try {
    // Fetch videos from YouTube
    const videos = await youtubeService.syncChannelVideos(channelId);

    if (videos.length === 0) {
      console.log(`No videos found for channel ${channelId}`);
      return;
    }

    // Get the uploads playlist ID for storing in channel record
    const uploadsPlaylistId = await youtubeService.getChannelUploadsPlaylistId(channelId);

    // Get first video title as channel title (fallback to channelId if needed)
    // In production, you'd fetch channel details separately
    const channelTitle = `Channel ${channelId}`;

    // Upsert channel and videos in a transaction
    await prisma.$transaction(async (tx) => {
      // Upsert channel
      await tx.channel.upsert({
        where: { id: channelId },
        update: {
          uploadsPlaylistId,
          lastSyncedAt: new Date(),
        },
        create: {
          id: channelId,
          title: channelTitle,
          uploadsPlaylistId,
          lastSyncedAt: new Date(),
        },
      });

      // Upsert all videos (deduplication by videoId)
      for (const video of videos) {
        await tx.video.upsert({
          where: { id: video.videoId },
          update: {
            title: video.title,
            publishedAt: video.publishedAt,
          },
          create: {
            id: video.videoId,
            channelId,
            title: video.title,
            publishedAt: video.publishedAt,
          },
        });
      }
    });

    console.log(`Successfully synced ${videos.length} videos for channel ${channelId}`);
  } catch (error) {
    console.error(`Error syncing channel ${channelId}:`, error);
    throw error; // Re-throw to let BullMQ handle retry logic
  }
}

// Create and start the worker
const worker = createWorker(processSyncJob);

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

console.log('Worker started, waiting for jobs...');

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down worker...');
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down worker...');
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});
