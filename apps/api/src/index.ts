import Fastify from 'fastify';
import { prisma } from '@youtube-sync/db';
import { addSyncJob } from '@youtube-sync/queue';

const fastify = Fastify({
  logger: true,
});

// Health check endpoint
fastify.get('/health', async () => {
  return { status: 'ok' };
});

/**
 * POST /sync/:channelId
 * Pushes a sync job into the queue for the given channel
 * Returns 202 Accepted
 */
fastify.post<{ Params: { channelId: string } }>('/sync/:channelId', async (request, reply) => {
  const { channelId } = request.params;

  if (!channelId) {
    return reply.status(400).send({ error: 'Channel ID is required' });
  }

  // Add job to queue
  await addSyncJob(channelId);

  reply.status(202).send({ 
    message: 'Sync job queued',
    channelId 
  });
});

/**
 * GET /videos
 * Returns list of videos from DB
 * Supports optional filter by channelId via query param
 */
fastify.get<{ Querystring: { channelId?: string } }>('/videos', async (request, reply) => {
  const { channelId } = request.query;

  try {
    const videos = await prisma.video.findMany({
      where: channelId ? { channelId } : undefined,
      include: {
        channel: true,
      },
      orderBy: {
        publishedAt: 'desc',
      },
    });

    return { videos };
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Failed to fetch videos' });
  }
});

/**
 * GET /channels
 * Returns list of channels from DB
 */
fastify.get('/channels', async (request, reply) => {
  try {
    const channels = await prisma.channel.findMany({
      include: {
        _count: {
          select: { videos: true },
        },
      },
      orderBy: {
        lastSyncedAt: 'desc',
      },
    });

    return { channels };
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Failed to fetch channels' });
  }
});

const start = async () => {
  try {
    await fastify.listen({ 
      host: '0.0.0.0',
      port: parseInt(process.env.PORT || '3000', 10) 
    });
    
    fastify.log.info(`Server listening on http://0.0.0.0:${process.env.PORT || '3000'}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
