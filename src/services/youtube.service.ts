import { google } from 'googleapis';
import { LRUCache } from 'lru-cache';
import type { VideoInfo, VideoDetails } from '../models/youtube.types';

const youtube = google.youtube('v3');
const apiKey = process.env.YOUTUBE_API_KEY;

if (!apiKey) {
  console.error('YOUTUBE_API_KEY is not set in environment variables');
}

// LRU Cache configuration: max 500 entries, TTL 1 hour (3600000 ms)
const cache = new LRUCache<string, any>({
  max: 500,
  ttl: 3600000,
});

function getCacheKey(methodName: string, args: any[]): string {
  return `${methodName}:${JSON.stringify(args)}`;
}

export class YouTubeService {
  /**
   * Extract channel ID from various YouTube URL formats
   * Supports: @username, channel/UC..., /c/name, direct IDs
   */
  async getChannelIdFromUrl(url: string): Promise<string> {
    const cacheKey = getCacheKey('getChannelIdFromUrl', [url]);
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      let channelId: string | null = null;

      // Check if it's already a channel ID (starts with UC and is 24 chars)
      const channelIdMatch = url.match(/^UC[a-zA-Z0-9_-]{22}$/);
      if (channelIdMatch) {
        channelId = url;
      }

      // Handle @username format
      if (!channelId && url.includes('@')) {
        const usernameMatch = url.match(/@([a-zA-Z0-9_.-]+)/);
        if (usernameMatch) {
          const username = usernameMatch[1];
          const response = await youtube.channels.list({
            key: apiKey!,
            forUsername: username,
            part: ['id'],
          });
          channelId = response.data.items?.[0]?.id || null;
        }
      }

      // Handle /channel/UC... format
      if (!channelId) {
        const channelPathMatch = url.match(/\/channel\/(UC[a-zA-Z0-9_-]{22})/);
        if (channelPathMatch) {
          channelId = channelPathMatch[1];
        }
      }

      // Handle /c/name format
      if (!channelId) {
        const cNameMatch = url.match(/\/c\/([a-zA-Z0-9_.-]+)/);
        if (cNameMatch) {
          const customName = cNameMatch[1];
          const response = await youtube.search.list({
            key: apiKey!,
            q: customName,
            type: 'channel',
            part: ['snippet'],
            maxResults: 1,
          });
          channelId = response.data.items?.[0]?.snippet?.channelId || null;
        }
      }

      // Handle /user/name format
      if (!channelId) {
        const userMatch = url.match(/\/user\/([a-zA-Z0-9_.-]+)/);
        if (userMatch) {
          const username = userMatch[1];
          const response = await youtube.channels.list({
            key: apiKey!,
            forUsername: username,
            part: ['id'],
          });
          channelId = response.data.items?.[0]?.id || null;
        }
      }

      if (!channelId) {
        throw new Error(`Could not extract channel ID from URL: ${url}`);
      }

      cache.set(cacheKey, channelId);
      return channelId;
    } catch (error) {
      console.error('Error getting channel ID from URL:', error);
      throw error;
    }
  }

  /**
   * Fetch videos from a channel published after a specific date
   */
  async fetchChannelVideos(channelId: string, publishedAfter: string): Promise<VideoInfo[]> {
    const cacheKey = getCacheKey('fetchChannelVideos', [channelId, publishedAfter]);
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const videos: VideoInfo[] = [];
      let pageToken: string | undefined;

      do {
        const response = await youtube.search.list({
          key: apiKey!,
          channelId: channelId,
          publishedAfter: new Date(publishedAfter).toISOString(),
          part: ['snippet'],
          type: 'video',
          order: 'date',
          maxResults: 50,
          pageToken,
        });

        const items = response.data.items || [];
        for (const item of items) {
          if (item.id?.videoId && item.snippet) {
            videos.push({
              videoId: item.id.videoId,
              title: item.snippet.title || '',
              publishedAt: item.snippet.publishedAt || '',
            });
          }
        }

        pageToken = response.data.nextPageToken;
      } while (pageToken);

      cache.set(cacheKey, videos);
      return videos;
    } catch (error) {
      console.error('Error fetching channel videos:', error);
      throw error;
    }
  }

  /**
   * Fetch videos from a playlist with pagination support
   */
  async fetchPlaylistItems(playlistId: string): Promise<VideoInfo[]> {
    const cacheKey = getCacheKey('fetchPlaylistItems', [playlistId]);
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const videos: VideoInfo[] = [];
      let pageToken: string | undefined;

      do {
        const response = await youtube.playlistItems.list({
          key: apiKey!,
          playlistId: playlistId,
          part: ['snippet'],
          maxResults: 50,
          pageToken,
        });

        const items = response.data.items || [];
        for (const item of items) {
          if (item.snippet?.resourceId?.videoId) {
            videos.push({
              videoId: item.snippet.resourceId.videoId,
              title: item.snippet.title || '',
              publishedAt: item.snippet.publishedAt || '',
            });
          }
        }

        pageToken = response.data.nextPageToken;
      } while (pageToken);

      cache.set(cacheKey, videos);
      return videos;
    } catch (error) {
      console.error('Error fetching playlist items:', error);
      throw error;
    }
  }

  /**
   * Get detailed information about a video
   */
  async getVideoDetails(videoId: string): Promise<VideoDetails> {
    const cacheKey = getCacheKey('getVideoDetails', [videoId]);
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await youtube.videos.list({
        key: apiKey!,
        id: [videoId],
        part: ['snippet'],
      });

      const item = response.data.items?.[0];
      if (!item || !item.snippet) {
        throw new Error(`Video not found: ${videoId}`);
      }

      const result: VideoDetails = {
        title: item.snippet.title || '',
        channelId: item.snippet.channelId || '',
        publishedAt: item.snippet.publishedAt || '',
        thumbnails: item.snippet.thumbnails,
      };

      cache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error getting video details:', error);
      throw error;
    }
  }
}
