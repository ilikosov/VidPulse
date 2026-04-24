import { Router, Request, Response } from 'express';
import knex from '../db/';
import { youtubeService } from '../services/youtube.service';

const router = Router();

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

    // Extract channel ID from URL
    const channelId = await youtubeService.getChannelIdFromUrl(url);

    // Check if channel already exists
    const existingChannel = await knex('channels').where('youtube_id', channelId).first();

    if (existingChannel) {
      return res.status(409).json({ error: 'Channel already exists' });
    }

    // Fetch channel details from YouTube
    const channelDetails = await youtubeService.getChannelDetails(channelId);

    // Insert channel into database
    const [newChannel] = await knex('channels')
      .insert({
        youtube_id: channelId,
        title: channelDetails.title,
        thumbnail_url: channelDetails.thumbnail_url,
        added_at: new Date().toISOString(),
        last_checked_at: new Date().toISOString(),
      })
      .returning('*');

    // Trigger initial sync - fetch videos from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const publishedAfter = thirtyDaysAgo.toISOString();

    const videos = await youtubeService.fetchChannelVideos(channelId, publishedAfter);

    // Insert videos in a transaction, skipping existing ones
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

    res.status(201).json(newChannel);
  } catch (error: any) {
    console.error('Error adding channel:', error);
    if (error.message.includes('Could not extract channel ID')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to add channel' });
  }
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
