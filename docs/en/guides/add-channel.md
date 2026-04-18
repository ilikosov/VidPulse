# How to Add a YouTube Channel

This guide explains how to add YouTube channels to VidPulse for video synchronization and classification.

## Prerequisites

Before adding a channel, ensure you have:

1. **VidPulse instance** running (local or deployed)
2. **Admin access** to the VidPulse admin UI or API credentials
3. **YouTube channel ID** of the channel you want to add
4. **YouTube Data API v3** credentials configured in VidPulse

## Finding YouTube Channel IDs

A YouTube channel ID is a unique identifier that starts with `UC` followed by 22 characters (e.g., `UC_x5XG1OV2P6uZZ5FSM9Ttw`).

### Method 1: From YouTube URL

1. Navigate to the channel's YouTube page
2. Look at the URL in your browser:
   - **Custom URL**: `youtube.com/c/ChannelName` → Not the channel ID
   - **Channel ID URL**: `youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw` → `UC_x5XG1OV2P6uZZ5FSM9Ttw` is the channel ID
   - **User URL**: `youtube.com/user/username` → Not the channel ID

### Method 2: Using YouTube's "View Source"

1. Go to the channel's YouTube page
2. Right-click and select "View Page Source"
3. Search for `"channelId":"` in the source code
4. Copy the value after the colon (e.g., `"channelId":"UC_x5XG1OV2P6uZZ5FSM9Ttw"`)

### Method 3: Using YouTube Data API

If you have API access, you can use tools like:

- [YouTube Channel ID Finder](https://commentpicker.com/youtube-channel-id.php)
- Or query the API directly with the channel's custom URL

## Adding a Channel via Admin UI

### Step 1: Access Admin Panel

1. Open your browser and navigate to `http://localhost:3000/admin` (or your deployment URL)
2. Log in with your admin credentials

### Step 2: Navigate to Channels

1. Click "Channels" in the left sidebar
2. You'll see a list of existing channels (if any)
3. Click the "Add Channel" button in the top-right corner

### Step 3: Enter Channel Details

Fill in the form with the following information:

| Field                   | Description                                       | Required             |
| ----------------------- | ------------------------------------------------- | -------------------- |
| **YouTube Channel ID**  | The channel ID (e.g., `UC_x5XG1OV2P6uZZ5FSM9Ttw`) | Yes                  |
| **Display Name**        | Friendly name for the channel (optional)          | No                   |
| **Sync Interval**       | How often to check for new videos (minutes)       | No (default: 60)     |
| **Auto-classify**       | Automatically classify new videos                 | No (default: true)   |
| **Backfill Depth**      | Number of days of historical videos to sync       | No (default: 30)     |
| **Classification Mode** | Rule-based, LLM-based, or hybrid                  | No (default: hybrid) |

### Step 4: Save and Verify

1. Click "Save" to add the channel
2. The system will immediately start an initial sync
3. You'll be redirected to the channel details page
4. Monitor the "Sync Status" section for progress

## Adding a Channel via API

### Authentication

First, obtain an API key from the Admin UI (Settings → API Keys).

### API Endpoint

```
POST /api/channels
```

### Request Headers

```http
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY
```

### Request Body

```json
{
  "youtubeChannelId": "UC_x5XG1OV2P6uZZ5FSM9Ttw",
  "name": "Google Developers",
  "syncInterval": 60,
  "autoClassify": true,
  "backfillDays": 30,
  "classificationMode": "hybrid"
}
```

### Example using cURL

```bash
curl -X POST http://localhost:3000/api/channels \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "youtubeChannelId": "UC_x5XG1OV2P6uZZ5FSM9Ttw",
    "name": "Google Developers",
    "syncInterval": 60,
    "autoClassify": true,
    "backfillDays": 30,
    "classificationMode": "hybrid"
  }'
```

### Response

```json
{
  "id": "UC_x5XG1OV2P6uZZ5FSM9Ttw",
  "name": "Google Developers",
  "syncInterval": 60,
  "autoClassify": true,
  "backfillDays": 30,
  "classificationMode": "hybrid",
  "lastSyncedAt": null,
  "createdAt": "2023-10-15T14:30:00Z",
  "updatedAt": "2023-10-15T14:30:00Z"
}
```

## Channel Configuration Options

### Sync Interval

Controls how often VidPulse checks for new videos:

- **60 minutes** (default): Good for most channels
- **15 minutes**: For highly active channels
- **1440 minutes** (24 hours): For less active channels
- **0**: Manual sync only (no automatic checks)

### Backfill Depth

Determines how many days of historical videos to sync initially:

- **30 days** (default): Recent history
- **90 days**: Quarter of a year
- **365 days**: Full year
- **0**: No historical sync (only new videos)

### Classification Mode

Choose how videos should be classified:

- **hybrid** (default): Use rules first, then LLM for complex cases
- **rules**: Fast, rule-based classification only
- **llm**: Always use LLM for detailed extraction
- **none**: Don't classify automatically

## Verifying Channel Addition

### Check Channel Status

Via Admin UI:

1. Go to "Channels" section
2. Find your channel in the list
3. Check "Last Sync" column
4. Click on the channel to see details

Via API:

```bash
curl http://localhost:3000/api/channels/UC_x5XG1OV2P6uZZ5FSM9Ttw \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Monitor Initial Sync

The first sync may take several minutes depending on:

- Number of historical videos to backfill
- YouTube API rate limits
- System load

Check sync progress:

```bash
curl http://localhost:3000/api/channels/UC_x5XG1OV2P6uZZ5FSM9Ttw/sync-status \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Troubleshooting

### Common Issues

#### "Invalid channel ID" error

- Verify the channel ID format (starts with `UC`, 24 characters)
- Ensure the channel exists on YouTube
- Check YouTube API quota limits

#### "Channel already exists" error

- The channel is already added to VidPulse
- Check existing channels list
- Use the existing channel entry instead

#### Sync not starting

- Check worker processes are running
- Verify Redis connection
- Check YouTube API credentials

#### Backfill taking too long

- Reduce `backfillDays` parameter
- Check YouTube API rate limits
- Monitor system resources

### Debug Steps

1. Check system logs: `docker logs vidpulse-worker` (if using Docker)
2. Verify YouTube API quota: Google Cloud Console
3. Test API connectivity: `curl http://localhost:3000/api/health`
4. Check Redis queue: Admin UI → System → Queue

## Best Practices

### Channel Selection

- Start with 1-2 channels to test the system
- Add channels gradually to monitor performance
- Consider channel activity level when setting sync intervals

### Configuration Tips

- Use longer sync intervals for less active channels
- Enable auto-classification for most channels
- Set appropriate backfill based on your needs
- Monitor API usage with highly active channels

### Maintenance

- Regularly review sync status
- Remove inactive channels
- Update channel names if they change on YouTube
- Monitor classification accuracy

## Next Steps

After adding a channel:

1. **Monitor sync progress** in the Admin UI
2. **Review classified videos** in the Videos section
3. **Adjust classification rules** if needed
4. **Export data** via API or CSV export
5. **Set up alerts** for sync failures (if configured)

## Related Guides

- [Basic Usage Guide](./basic-usage.md)
- [Classification Configuration](./classification-config.md)
- [API Reference](../reference/api/overview.md)
- [Troubleshooting Guide](./troubleshooting.md)
