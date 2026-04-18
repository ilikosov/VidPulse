import { Queue, Worker, QueueOptions } from 'bullmq';

export const SYNC_CHANNEL_QUEUE = 'sync_channel';

export interface SyncChannelJob {
  channelId: string;
}

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

/**
 * Create and export the sync channel queue
 */
export function createQueue() {
  const queueOptions: QueueOptions = { connection };
  return new Queue<SyncChannelJob>(SYNC_CHANNEL_QUEUE, queueOptions);
}

/**
 * Add a sync job to the queue
 */
export async function addSyncJob(channelId: string): Promise<void> {
  const queue = createQueue();
  await queue.add('sync_channel', { channelId });
  await queue.close();
}

/**
 * Create a worker to process sync channel jobs
 */
export function createWorker(
  processor: (job: { data: SyncChannelJob }) => Promise<void>
) {
  const worker = new Worker<SyncChannelJob>(
    SYNC_CHANNEL_QUEUE,
    processor,
    { connection }
  );

  return worker;
}
