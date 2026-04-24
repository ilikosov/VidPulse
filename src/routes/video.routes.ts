import { Router, Request, Response } from 'express';
import knex from '../db';
import { parseTitle } from '../services/parser/parser.service';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

/**
 * GET /api/videos - List all videos with filtering and pagination
 * Query params: status, page, limit
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string | undefined;
    const offset = (page - 1) * limit;

    let query = knex('videos')
      .leftJoin('channels', 'videos.channel_id', 'channels.id')
      .leftJoin('playlists', 'videos.playlist_id', 'playlists.id')
      .select(
        'videos.id',
        'videos.youtube_id',
        'videos.channel_id',
        'videos.playlist_id',
        'videos.original_title',
        'videos.perf_date',
        'videos.group_name',
        'videos.artist_name',
        'videos.song_title',
        'videos.event',
        'videos.camera_type',
        'videos.status',
        'videos.created_at',
        'videos.updated_at',
        'channels.title as channel_title',
        'playlists.title as playlist_title'
      );

    if (status) {
      query = query.where('videos.status', status);
    }

    query = query.orderBy('videos.created_at', 'desc');

    const videos = await query.limit(limit).offset(offset);

    const totalQuery = knex('videos');
    if (status) {
      totalQuery.where('status', status);
    }
    const total = await totalQuery.count('* as count').first();
    const totalCount = parseInt(total?.count as string) || 0;

    res.json({
      videos,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

/**
 * GET /api/videos/:id - Get single video details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const video = await knex('videos')
      .leftJoin('channels', 'videos.channel_id', 'channels.id')
      .leftJoin('playlists', 'videos.playlist_id', 'playlists.id')
      .select(
        'videos.*',
        'channels.title as channel_title',
        'channels.youtube_id as channel_youtube_id',
        'playlists.title as playlist_title'
      )
      .where('videos.id', id)
      .first();

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.json(video);
  } catch (error) {
    console.error('Error fetching video:', error);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

/**
 * PUT /api/videos/:id/metadata - Update video metadata manually
 * 
 * This endpoint allows manual editing of parsed metadata fields.
 * It validates the video exists and is in an editable state.
 */
router.put('/:id/metadata', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      perf_date,
      group_name,
      artist_name,
      song_title,
      event,
      camera_type
    } = req.body;

    // Find the video
    const video = await knex('videos').where('id', id).first();

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Check if video is in an editable state
    const editableStatuses = ['new', 'needs_review', 'pending'];
    if (!editableStatuses.includes(video.status)) {
      return res.status(400).json({
        error: `Cannot edit metadata for video with status '${video.status}'. Only videos with status 'new', 'needs_review', or 'pending' can be edited.`
      });
    }

    // Build update object with only provided fields
    const updateData: Record<string, any> = {};
    
    if (perf_date !== undefined) {
      // Validate perf_date format (YYMMDD)
      if (perf_date && !/^\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/.test(perf_date)) {
        return res.status(400).json({
          error: 'Invalid perf_date format. Expected YYMMDD (e.g., 240315 for March 15, 2024)'
        });
      }
      updateData.perf_date = perf_date ? new Date(`20${perf_date.slice(0,2)}-${perf_date.slice(2,4)}-${perf_date.slice(4,6)}`).toISOString() : null;
    }

    if (group_name !== undefined) {
      updateData.group_name = group_name || null;
    }

    if (artist_name !== undefined) {
      updateData.artist_name = artist_name || null;
    }

    if (song_title !== undefined) {
      updateData.song_title = song_title || null;
    }

    if (event !== undefined) {
      // Ensure @ prefix for events
      if (event && !event.startsWith('@')) {
        updateData.event = '@' + event.toUpperCase();
      } else {
        updateData.event = event || null;
      }
    }

    if (camera_type !== undefined) {
      updateData.camera_type = camera_type || null;
    }

    // If no fields to update, return current video
    if (Object.keys(updateData).length === 0) {
      return res.json(video);
    }

    // Determine new status
    let newStatus = video.status;
    if (video.status === 'needs_review') {
      // If editing from needs_review, set to 'new' (ready for processing)
      newStatus = 'new';
      updateData.status = newStatus;
    }

    // Update timestamp
    updateData.updated_at = new Date().toISOString();

    // Perform the update in a transaction
    const updatedVideo = await knex.transaction(async (trx) => {
      // Update the video
      await trx('videos').where('id', id).update(updateData);

      // Record status change if status was updated
      if (updateData.status && updateData.status !== video.status) {
        await trx('status_history').insert({
          video_id: id,
          old_status: video.status,
          new_status: updateData.status
        });
      }

      // Insert training data record with the final metadata
      const finalMetadata = {
        perf_date: updateData.perf_date ? perf_date : video.perf_date,
        group_name: updateData.group_name ?? video.group_name,
        artist_name: updateData.artist_name ?? video.artist_name,
        song_title: updateData.song_title ?? video.song_title,
        event: updateData.event ?? video.event,
        camera_type: updateData.camera_type ?? video.camera_type
      };

      await trx('training_data').insert({
        video_id: id,
        original_title: video.original_title,
        final_metadata_json: JSON.stringify(finalMetadata)
      });

      // Fetch and return the updated video
      const updated = await trx('videos').where('id', id).first();
      return updated;
    });

    res.json(updatedVideo);
  } catch (error) {
    console.error('Error updating video metadata:', error);
    res.status(500).json({ error: 'Failed to update video metadata' });
  }
});

/**
 * POST /api/videos/:id/parse - Re-parse video title
 * 
 * This endpoint re-runs the parser on the original title.
 * Useful when the parser logic has been updated.
 */
router.post('/:id/parse', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Find the video
    const video = await knex('videos').where('id', id).first();

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Re-parse the title
    const { metadata, needsReview } = await parseTitle(video.original_title);

    // Build update object
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (metadata.perf_date) {
      // Convert YYMMDD to proper date
      const dateStr = metadata.perf_date;
      updateData.perf_date = new Date(`20${dateStr.slice(0,2)}-${dateStr.slice(2,4)}-${dateStr.slice(4,6)}`).toISOString();
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

    // Set status based on parsing result
    const newStatus = needsReview ? 'needs_review' : 'new';
    updateData.status = newStatus;

    // Perform the update
    const updatedVideo = await knex.transaction(async (trx) => {
      // Update the video
      await trx('videos').where('id', id).update(updateData);

      // Record status change
      await trx('status_history').insert({
        video_id: id,
        old_status: video.status,
        new_status: newStatus
      });

      // Fetch and return the updated video
      const updated = await trx('videos').where('id', id).first();
      return updated;
    });

    res.json({
      video: updatedVideo,
      parsedMetadata: metadata,
      needsReview
    });
  } catch (error) {
    console.error('Error re-parsing video title:', error);
    res.status(500).json({ error: 'Failed to re-parse video title' });
  }
});

export default router;
