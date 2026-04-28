import { Router, Request, Response } from 'express';
import multer from 'multer';
import knex from '../db/';
import { youtubeService } from '../services/youtube.service';
import { logEvent } from '../services/eventLog.service';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: unknown, file, cb) => {
    const isTxtFile = file.originalname.toLowerCase().endsWith('.txt');
    const isTextMimeType = file.mimetype.startsWith('text/');

    if (isTxtFile || isTextMimeType) {
      cb(null, true);
      return;
    }

    cb(new Error('Only text (.txt) files are allowed'));
  },
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class DuplicateChannelError extends Error {
  constructor() {
    super('Channel already exists');
    this.name = 'DuplicateChannelError';
  }
}

async function addChannelByUrl(url: string) {
  const channelId = await youtubeService.getChannelIdFromUrl(url);

  const existingChannel = await knex('channels').where('youtube_id', channelId).first();
  if (existingChannel) {
    throw new DuplicateChannelError();
  }

  const channelDetails = await youtubeService.getChannelDetails(channelId);

  const [newChannel] = await knex('channels')
    .insert({
      youtube_id: channelId,
      title: channelDetails.title,
      thumbnail_url: channelDetails.thumbnail_url,
      added_at: new Date().toISOString(),
      last_checked_at: new Date().toISOString(),
    })
    .returning('*');

  await logEvent('channel_added', `Added channel ${channelDetails.title} (${channelId})`, {
    youtube_id: channelId,
    title: channelDetails.title,
    channel_id: newChannel.id,
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const publishedAfter = thirtyDaysAgo.toISOString();

  const videos = await youtubeService.fetchChannelVideos(channelId, publishedAfter);

  await knex.transaction(async (trx) => {
    for (const video of videos) {
      const existingVideo = await trx('videos').where('youtube_id', video.videoId).first();

      if (!existingVideo) {
        await trx('videos').insert({
          youtube_id: video.videoId,
          channel_id: newChannel.id,
          original_title: video.title,
          published_at: video.publishedAt,
          status: 'new',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }
  });

  return newChannel;
}

// GET /api/channels - List all channels with pagination
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const channels = await knex('channels')
      .select(
        'id',
        'youtube_id',
        'title',
        'thumbnail_url',
        'is_favorite',
        'added_at',
        'last_checked_at',
      )
      .orderBy('added_at', 'desc')
      .limit(limit)
      .offset(offset);

    const total = await knex('channels').count('* as count').first();
    const totalCount = parseInt(total?.count as string) || 0;

    res.json({
      channels,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching channels:', error);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

// POST /api/channels - Add a new channel
router.post('/', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const newChannel = await addChannelByUrl(url);
    res.status(201).json(newChannel);
  } catch (error: any) {
    console.error('Error adding channel:', error);
    if (error instanceof DuplicateChannelError) {
      return res.status(409).json({ error: 'Channel already exists' });
    }
    if (error.message.includes('Could not extract channel ID')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to add channel' });
  }
});

// POST /api/channels/import - Import channels from a text file
router.post('/import', (req: Request, res: Response) => {
  upload.single('file')(req, res, async (uploadError: unknown) => {
    if (uploadError instanceof Error && uploadError.name === 'MulterError' && (uploadError as { code?: string }).code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size must be 5 MB or less' });
    }

    if (uploadError && uploadError instanceof Error) {
      return res.status(400).json({ error: uploadError.message });
    }

    try {
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'File is required' });
      }

      const lines = file.buffer
        .toString('utf-8')
        .split(/\r?\n/)
        .map((line: string) => line.trim());

      const importUrls = lines.filter((line: string) => line.length > 0 && !line.startsWith('#'));

      const errors: string[] = [];
      let added = 0;
      let skipped = 0;

      for (let index = 0; index < importUrls.length; index += 1) {
        const url = importUrls[index];

        try {
          await addChannelByUrl(url);
          added += 1;
        } catch (error: any) {
          if (error instanceof DuplicateChannelError) {
            skipped += 1;
          } else {
            errors.push(`Line ${index + 1}: ${url} - ${error?.message ?? 'Unknown error'}`);
          }
        }

        if (index < importUrls.length - 1) {
          await sleep(150);
        }
      }

      return res.json({
        total: importUrls.length,
        added,
        skipped,
        errors,
      });
    } catch (error: any) {
      console.error('Error importing channels:', error);
      if (error?.message) {
        return res.status(400).json({ error: error.message });
      }

      return res.status(500).json({ error: 'Failed to import channels' });
    }
  });
});

// DELETE /api/channels/:id - Delete a channel
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const removeVideos = req.query.removeVideos === 'true';

    const channel = await knex('channels').where('id', id).first();
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    if (removeVideos) {
      // Delete associated videos
      await knex('videos').where('channel_id', id).delete();
    } else {
      // Set channel_id to NULL for associated videos
      await knex('videos').where('channel_id', id).update({ channel_id: null });
    }

    // Delete the channel
    await knex('channels').where('id', id).delete();

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting channel:', error);
    res.status(500).json({ error: 'Failed to delete channel' });
  }
});

export default router;
