import dotenv from "dotenv";
// Load environment variables
dotenv.config();
import { YouTubeService } from "./services/youtube.service";

async function main() {
  try {
    const youtubeService = new YouTubeService();

    // Test getChannelIdFromUrl with Google's channel
    const url = "https://www.youtube.com/@Google";
    console.log(`Getting channel ID from URL: ${url}`);
    const channelId = await youtubeService.getChannelIdFromUrl(url);
    console.log(`Channel ID: ${channelId}`);

    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const publishedAfter = thirtyDaysAgo.toISOString();
    console.log(`\nFetching videos published after: ${publishedAfter}`);

    // Fetch channel videos
    const videos = await youtubeService.fetchChannelVideos(
      channelId,
      publishedAfter,
    );
    console.log(`\nFound ${videos.length} videos:`);
    for (const video of videos) {
      console.log(
        `  - ${video.title} (${video.videoId}) - ${video.publishedAt}`,
      );
    }

    // Get details for the first video
    if (videos.length > 0) {
      const firstVideo = videos[0];
      console.log(`\nGetting details for first video: ${firstVideo.videoId}`);
      const videoDetails = await youtubeService.getVideoDetails(
        firstVideo.videoId,
      );
      console.log("Video Details:");
      console.log(`  Title: ${videoDetails.title}`);
      console.log(`  Channel ID: ${videoDetails.channelId}`);
      console.log(`  Published At: ${videoDetails.publishedAt}`);
      console.log(
        `  Thumbnails: ${JSON.stringify(videoDetails.thumbnails, null, 2)}`,
      );
    }

    console.log("\n✅ All tests completed successfully!");
  } catch (error) {
    console.error("❌ Error during test execution:", error);
    process.exit(1);
  }
}

main();
