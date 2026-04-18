# Basic Usage Guide

Learn how to use VidPulse for YouTube video synchronization and classification.

## Overview

VidPulse is a backend service that:

1. **Syncs videos** from YouTube channels you subscribe to
2. **Enriches metadata** with detailed information
3. **Classifies videos** using hybrid (rules + LLM) classification
4. **Provides APIs** and admin UI for management

## Core Concepts

### Channels

YouTube channels that VidPulse monitors for new videos. Each channel has:

- YouTube channel ID
- Sync frequency
- Classification settings
- Sync history

### Videos

Individual YouTube videos with:

- Basic metadata (title, description, published date)
- Statistics (views, likes, comments)
- Classification results
- Sync status

### Classification

Process of categorizing videos using:

1. **Rule-based**: Fast, deterministic rules (keywords, patterns)
2. **LLM-based**: AI-powered extraction of structured data
3. **Hybrid**: Combination of both for optimal results

## Common Workflows

### Workflow 1: Adding and Monitoring a Channel

#### Step 1: Add a Channel

**Via Admin UI:**

1. Navigate to `http://localhost:3000/admin`
2. Click "Channels" in the sidebar
3. Click "Add Channel"
4. Enter YouTube channel ID (e.g., `UC_x5XG1OV2P6uZZ5FSM9Ttw`)
5. Configure sync settings (optional)
6. Click "Save"

**Via API:**

```bash
curl -X POST http://localhost:3000/api/channels \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "youtubeChannelId": "UC_x5XG1OV2P6uZZ5FSM9Ttw",
    "name": "Google Developers",
    "syncInterval": 60,
    "autoClassify": true
  }'
```

#### Step 2: Monitor Sync Progress

Check sync status in Admin UI:

1. Go to "Channels" section
2. Click on the channel name
3. View "Last Sync" timestamp and status
4. Check "Sync History" for detailed logs

Or via API:

```bash
curl http://localhost:3000/api/channels/UC_x5XG1OV2P6uZZ5FSM9Ttw/sync-status
```

#### Step 3: View Synced Videos

In Admin UI:

1. Go to "Videos" section
2. Filter by channel
3. View video list with classification results

Via API:

```bash
curl http://localhost:3000/api/videos?channelId=UC_x5XG1OV2P6uZZ5FSM9Ttw
```

### Workflow 2: Manual Video Classification

#### Step 1: Trigger Classification

For a specific video:

```bash
curl -X POST http://localhost:3000/api/videos/VIDEO_ID/classify \
  -H "Authorization: Bearer YOUR_API_KEY"
```

For all unclassified videos in a channel:

```bash
curl -X POST http://localhost:3000/api/channels/CHANNEL_ID/reclassify \
  -H "Authorization: Bearer YOUR_API_KEY"
```

#### Step 2: Check Classification Results

View classification in Admin UI:

1. Go to "Videos" section
2. Click on a video
3. View "Classification" tab
4. See extracted data (artist, song, event, etc.)

Or via API:

```bash
curl http://localhost:3000/api/videos/VIDEO_ID/classification
```

#### Step 3: Adjust Classification Rules

If classification needs improvement:

1. Go to "Classification Rules" in Admin UI
2. Add or modify rules
3. Test with sample videos
4. Apply to existing videos

### Workflow 3: Exporting Data

#### Step 1: Export Videos as CSV

Via Admin UI:

1. Go to "Videos" section
2. Apply filters if needed
3. Click "Export CSV"
4. Download the file

Via API:

```bash
curl http://localhost:3000/api/videos/export?format=csv \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -o videos.csv
```

#### Step 2: Export Classification Results

Get structured classification data:

```bash
curl http://localhost:3000/api/classification/export?format=json \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -o classification.json
```

#### Step 3: Webhook Integration

Set up webhooks for real-time notifications:

```bash
curl -X POST http://localhost:3000/api/webhooks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "url": "https://your-service.com/webhook",
    "events": ["video.synced", "video.classified"],
    "secret": "your-webhook-secret"
  }'
```

## Admin UI Navigation

### Dashboard

- System health overview
- Recent activity
- Sync statistics
- Queue status

### Channels Section

- List of monitored channels
- Add/remove channels
- Channel details and settings
- Manual sync trigger

### Videos Section

- Browse all synced videos
- Filter by channel, date, classification
- View video details
- Manual classification trigger
- Export functionality

### Classification Section

- Rule management
- Classification results
- Accuracy metrics
- Test classification

### System Section

- Queue management
- Log viewer
- Configuration
- User management (if enabled)

## API Usage Examples

### Authentication

Most API endpoints require authentication:

```bash
# Using API Key
curl -H "X-API-Key: YOUR_API_KEY" http://localhost:3000/api/videos

# Using JWT Token
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" http://localhost:3000/api/videos
```

### Common API Calls

**List videos with pagination:**

```bash
curl "http://localhost:3000/api/videos?page=1&limit=20&sort=-publishedAt"
```

**Search videos:**

```bash
curl "http://localhost:3000/api/videos/search?q=concert&channelId=CHANNEL_ID"
```

**Get video statistics:**

```bash
curl http://localhost:3000/api/stats/videos
```

**Get system health:**

```bash
curl http://localhost:3000/api/health
```

## Advanced Usage

### Batch Operations

**Sync multiple channels:**

```bash
curl -X POST http://localhost:3000/api/sync/batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "channelIds": ["CHANNEL_ID_1", "CHANNEL_ID_2"],
    "force": false
  }'
```

**Bulk classification:**

```bash
curl -X POST http://localhost:3000/api/classification/batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "videoIds": ["VIDEO_ID_1", "VIDEO_ID_2"],
    "mode": "hybrid"
  }'
```

### Custom Classification Rules

Create custom classification rules via API:

```bash
curl -X POST http://localhost:3000/api/classification/rules \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "name": "K-pop Concert Detection",
    "pattern": "/(concert|live|performance).*(bts|blackpink|twice)/i",
    "category": "concert",
    "priority": 10,
    "enabled": true
  }'
```

## Monitoring and Maintenance

### Daily Tasks

1. Check sync status in Dashboard
2. Review classification accuracy
3. Monitor queue health
4. Check for YouTube API quota usage

### Weekly Tasks

1. Review and clean up old rules
2. Export backup of classification data
3. Review system logs for errors
4. Update YouTube API keys if needed

### Monthly Tasks

1. Archive old video data
2. Review and optimize database performance
3. Update classification models/rules
4. Review security settings

## Troubleshooting Common Issues

### Videos Not Syncing

1. Check channel exists in YouTube
2. Verify YouTube API key has sufficient quota
3. Check sync job queue status
4. Review logs for specific errors

### Poor Classification Results

1. Check classification mode in settings
2. Review and adjust classification rules
3. Verify LLM API key and configuration
4. Test with sample videos

### API Authentication Failures

1. Verify API key or JWT token is valid
2. Check token expiration
3. Verify IP whitelist (if configured)
4. Check rate limiting

### Performance Issues

1. Monitor database connection pool
2. Check Redis memory usage
3. Review queue backlog
4. Adjust worker concurrency settings

## Next Steps

- Learn about [Advanced Classification](../guides/classification-setup.md)
- Explore [API Reference](../reference/api/overview.md)
- Set up [Production Deployment](../operations/deployment/production.md)
- Configure [Monitoring and Alerts](../operations/monitoring/metrics.md)
