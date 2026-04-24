import { Router, Request, Response } from 'express';
import knex from '../db/';
import { youtubeService } from '../services/youtube.service';

const router = Router();

// GET /api/playlists - List all playlists with pagination
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const playlists = await knex('playlists')
      .select('id', 'youtube_id', 'title', 'added_at', 'last_checked_at')
      .orderBy('added_at', 'desc')
      .limit(limit)
      .offset(offset);

    const total = await knex('playlists').count('* as count').first();
    const totalCount = parseInt(total?.count as string) || 0;

    res.json({
      playlists,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching playlists:', error);
    res.status(500).json({ error: 'Failed to fetch playlists' });
  }
});

// POST /api/playlists - Add a new playlist
router.post('/', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Extract playlist ID from URL
    const playlistId = youtubeService.getPlaylistIdFromUrl(url);

    // Check if playlist already exists
    const existingPlaylist = await knex('playlists').where('youtube_id', playlistId).first();

    if (existingPlaylist) {
      return res.status(409).json({ error: 'Playlist already exists' });
    }

    // Fetch playlist details from YouTube
    const playlistDetails = await youtubeService.getPlaylistDetails(playlistId);

    // Insert playlist into database
    const [newPlaylist] = await knex('playlists')
      .insert({
        youtube_id: playlistId,
        title: playlistDetails.title,
        added_at: new Date().toISOString(),
        last_checked_at: new Date().toISOString(),
      })
      .returning('*');

    // Fetch all playlist items
    const videos = await youtubeService.fetchPlaylistItems(playlistId);

    // Insert videos in a transaction, skipping existing ones
    await knex.transaction(async (trx) => {
      for (const video of videos) {
        const existingVideo = await trx('videos').where('youtube_id', video.videoId).first();

        if (!existingVideo) {
          await trx('videos').insert({
            youtube_id: video.videoId,
            playlist_id: newPlaylist.id,
            original_title: video.title,
            published_at: video.publishedAt,
            status: 'new',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }
    });

    res.status(201).json(newPlaylist);
  } catch (error: any) {
    console.error('Error adding playlist:', error);
    if (error.message.includes('Could not extract playlist ID')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to add playlist' });
  }
});

// DELETE /api/playlists/:id - Delete a playlist
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const removeVideos = req.query.removeVideos === 'true';

    const playlist = await knex('playlists').where('id', id).first();
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    if (removeVideos) {
      // Delete associated videos
      await knex('videos').where('playlist_id', id).delete();
    } else {
      // Set playlist_id to NULL for associated videos
      await knex('videos').where('playlist_id', id).update({ playlist_id: null });
    }

    // Delete the playlist
    await knex('playlists').where('id', id).delete();

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting playlist:', error);
    res.status(500).json({ error: 'Failed to delete playlist' });
  }
});

export default router;
