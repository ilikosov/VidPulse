import { google } from 'googleapis';

export interface YouTubeVideo {
  videoId: string;
  title: string;
  publishedAt: Date;
}

export class YouTubeService {
  private youtube: ReturnType<typeof google.youtube>;

  constructor(apiKey: string) {
    this.youtube = google.youtube({
      version: 'v3',
      auth: apiKey,
    });
  }

  /**
   * Fetch channel details including uploads playlist ID
   */
  async getChannelUploadsPlaylistId(channelId: string): Promise<string> {
    const response = await this.youtube.channels.list({
      id: [channelId],
      part: ['contentDetails'],
    });

    const channel = response.data.items?.[0];
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }

    return channel.contentDetails?.relatedPlaylists?.uploads || '';
  }

  /**
   * Fetch videos from a playlist (uploads playlist)
   * Uses playlistItems.list as required (NOT search.list)
   */
  async getVideosFromPlaylist(playlistId: string, maxResults = 50): Promise<YouTubeVideo[]> {
    const response = await this.youtube.playlistItems.list({
      playlistId,
      part: ['snippet'],
      maxResults,
    });

    const items = response.data.items || [];
    
    return items
      .filter((item) => item.snippet?.resourceId?.videoId)
      .map((item) => ({
        videoId: item.snippet!.resourceId!.videoId!,
        title: item.snippet!.title!,
        publishedAt: new Date(item.snippet!.publishedAt!),
      }));
  }

  /**
   * Full flow: get channel uploads playlist and fetch videos
   */
  async syncChannelVideos(channelId: string, maxResults = 50): Promise<YouTubeVideo[]> {
    const uploadsPlaylistId = await this.getChannelUploadsPlaylistId(channelId);
    return this.getVideosFromPlaylist(uploadsPlaylistId, maxResults);
  }
}
