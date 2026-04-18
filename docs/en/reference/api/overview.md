# API Overview

Comprehensive guide to the VidPulse REST API for programmatic access to video synchronization and classification features.

## API Basics

### Base URL

```
http://localhost:3000/api  # Development
https://api.your-domain.com/api  # Production
```

### Versioning

The API uses URL versioning. Current version is `v1`:

```
http://localhost:3000/api/v1/
```

### Content Type

All requests and responses use JSON:

```http
Content-Type: application/json
Accept: application/json
```

### Response Format

**Success Response (200 OK):**

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

**Error Response (4xx/5xx):**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": { ... }
  }
}
```

## Authentication

VidPulse API supports multiple authentication methods:

### 1. API Key (Simplest)

Add API key to request headers:

```http
X-API-Key: your-api-key-here
```

### 2. JWT Token (Recommended for users)

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Session Cookie (Admin UI)

Automatically handled by browser for Admin UI.

### Getting API Credentials

**For development:**

```bash
# Generate API key
npm run cli:generate-api-key

# Output: VIDPULSE_API_KEY=sk_abc123...
```

**For production:** Create API keys via Admin UI or environment variables.

## Rate Limiting

| Tier          | Requests per minute | Burst |
| ------------- | ------------------- | ----- |
| Default       | 100                 | 150   |
| Authenticated | 1000                | 1500  |
| Admin         | 5000                | 10000 |

Headers included in responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Endpoints Overview

### Public API (No authentication required)

| Endpoint   | Method | Description                   |
| ---------- | ------ | ----------------------------- |
| `/health`  | GET    | System health check           |
| `/version` | GET    | API version information       |
| `/docs`    | GET    | OpenAPI/Swagger documentation |

### Core Resources

#### Videos

| Endpoint                      | Method | Description                |
| ----------------------------- | ------ | -------------------------- |
| `/videos`                     | GET    | List videos with filtering |
| `/videos/{id}`                | GET    | Get video details          |
| `/videos/search`              | GET    | Search videos              |
| `/videos/{id}/classification` | GET    | Get classification results |
| `/videos/{id}/classify`       | POST   | Trigger classification     |
| `/videos/export`              | GET    | Export videos (CSV/JSON)   |

#### Channels

| Endpoint                     | Method | Description         |
| ---------------------------- | ------ | ------------------- |
| `/channels`                  | GET    | List channels       |
| `/channels`                  | POST   | Add new channel     |
| `/channels/{id}`             | GET    | Get channel details |
| `/channels/{id}`             | PUT    | Update channel      |
| `/channels/{id}`             | DELETE | Remove channel      |
| `/channels/{id}/sync`        | POST   | Trigger sync        |
| `/channels/{id}/sync-status` | GET    | Get sync status     |
| `/channels/{id}/videos`      | GET    | Get channel videos  |

#### Sync

| Endpoint       | Method | Description                  |
| -------------- | ------ | ---------------------------- |
| `/sync`        | POST   | Manual sync trigger          |
| `/sync/batch`  | POST   | Batch sync multiple channels |
| `/sync/status` | GET    | Global sync status           |
| `/sync/queue`  | GET    | Sync queue status            |

#### Classification

| Endpoint                     | Method | Description                     |
| ---------------------------- | ------ | ------------------------------- |
| `/classification/rules`      | GET    | List classification rules       |
| `/classification/rules`      | POST   | Create rule                     |
| `/classification/rules/{id}` | PUT    | Update rule                     |
| `/classification/rules/{id}` | DELETE | Delete rule                     |
| `/classification/test`       | POST   | Test classification             |
| `/classification/batch`      | POST   | Batch classification            |
| `/classification/metrics`    | GET    | Classification accuracy metrics |

### Admin API (Requires admin privileges)

| Endpoint           | Method | Description          |
| ------------------ | ------ | -------------------- |
| `/admin/stats`     | GET    | System statistics    |
| `/admin/queue`     | GET    | Queue management     |
| `/admin/jobs`      | GET    | Background jobs      |
| `/admin/jobs/{id}` | DELETE | Cancel job           |
| `/admin/logs`      | GET    | System logs          |
| `/admin/users`     | GET    | User management      |
| `/admin/config`    | GET    | Configuration        |
| `/admin/config`    | PUT    | Update configuration |

## Common Operations

### Listing Videos with Pagination

```bash
curl "http://localhost:3000/api/v1/videos?page=1&limit=20&sort=-publishedAt"
```

**Query Parameters:**

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `sort`: Sort field with prefix (`+` for ascending, `-` for descending)
- `channelId`: Filter by channel ID
- `publishedAfter`: Filter by publish date (ISO 8601)
- `classification`: Filter by classification result
- `q`: Search in title/description

### Adding a YouTube Channel

```bash
curl -X POST http://localhost:3000/api/v1/channels \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "youtubeChannelId": "UC_x5XG1OV2P6uZZ5FSM9Ttw",
    "name": "Google Developers",
    "syncInterval": 60,
    "autoClassify": true,
    "settings": {
      "fetchDescription": true,
      "fetchStatistics": true,
      "maxVideosPerSync": 100
    }
  }'
```

### Triggering Video Sync

```bash
curl -X POST http://localhost:3000/api/v1/channels/UC_x5XG1OV2P6uZZ5FSM9Ttw/sync \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "force": false,
    "backfill": false,
    "maxVideos": 50
  }'
```

### Getting Classification Results

```bash
curl http://localhost:3000/api/v1/videos/VIDEO_ID/classification \
  -H "X-API-Key: YOUR_API_KEY"
```

**Response Example:**

```json
{
  "success": true,
  "data": {
    "videoId": "dQw4w9WgXcQ",
    "classification": {
      "type": "music_video",
      "artist": "Rick Astley",
      "song": "Never Gonna Give You Up",
      "genre": "pop",
      "year": 1987,
      "confidence": 0.95
    },
    "method": "hybrid",
    "processedAt": "2023-12-01T10:30:00Z",
    "ruleMatches": ["artist_rick_astley", "song_never_gonna_give_you_up"]
  }
}
```

## Webhooks

VidPulse can send webhook notifications for events:

### Supported Events

- `video.synced`: New video synced
- `video.classified`: Video classification completed
- `channel.sync.started`: Channel sync started
- `channel.sync.completed`: Channel sync completed
- `channel.sync.failed`: Channel sync failed
- `classification.rule.created`: New classification rule
- `system.alert`: System alert/error

### Setting Up Webhooks

```bash
curl -X POST http://localhost:3000/api/v1/webhooks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "url": "https://your-service.com/webhooks/vidpulse",
    "events": ["video.synced", "video.classified"],
    "secret": "your-webhook-secret",
    "enabled": true
  }'
```

### Webhook Payload Example

```json
{
  "event": "video.synced",
  "timestamp": "2023-12-01T10:30:00Z",
  "data": {
    "videoId": "dQw4w9WgXcQ",
    "channelId": "UC_x5XG1OV2P6uZZ5FSM9Ttw",
    "title": "Never Gonna Give You Up",
    "publishedAt": "2009-10-25T06:57:33Z"
  },
  "signature": "sha256=..."
}
```

## Error Handling

### Common Error Codes

| Code                  | HTTP Status | Description                     |
| --------------------- | ----------- | ------------------------------- |
| `VALIDATION_ERROR`    | 400         | Invalid request parameters      |
| `AUTH_REQUIRED`       | 401         | Authentication required         |
| `FORBIDDEN`           | 403         | Insufficient permissions        |
| `NOT_FOUND`           | 404         | Resource not found              |
| `RATE_LIMITED`        | 429         | Rate limit exceeded             |
| `INTERNAL_ERROR`      | 500         | Server error                    |
| `SERVICE_UNAVAILABLE` | 503         | Service temporarily unavailable |

### Error Response Example

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid YouTube channel ID format",
    "details": {
      "field": "youtubeChannelId",
      "value": "invalid-id",
      "constraint": "Must be a valid YouTube channel ID (UC- prefix)"
    }
  }
}
```

## SDKs and Client Libraries

### Official SDKs

- **JavaScript/Node.js**: `npm install vidpulse-client`
- **Python**: `pip install vidpulse-client`
- **Go**: `go get github.com/your-org/vidpulse-go`

### JavaScript Example

```javascript
import { VidPulseClient } from "vidpulse-client";

const client = new VidPulseClient({
  apiKey: "your-api-key",
  baseUrl: "http://localhost:3000/api/v1",
});

// List videos
const videos = await client.videos.list({
  page: 1,
  limit: 20,
  channelId: "UC_x5XG1OV2P6uZZ5FSM9Ttw",
});

// Add channel
const channel = await client.channels.create({
  youtubeChannelId: "UC_x5XG1OV2P6uZZ5FSM9Ttw",
  name: "Google Developers",
});
```

### Python Example

```python
from vidpulse import VidPulseClient

client = VidPulseClient(
    api_key="your-api-key",
    base_url="http://localhost:3000/api/v1"
)

# Get video classification
classification = client.videos.get_classification("VIDEO_ID")

# Trigger sync
result = client.channels.sync("CHANNEL_ID", force=True)
```

## Testing the API

### Using cURL

Test authentication:

```bash
curl http://localhost:3000/api/v1/health
```

Test with API key:

```bash
curl -H "X-API-Key: YOUR_API_KEY" http://localhost:3000/api/v1/videos
```

### Using OpenAPI/Swagger

Access interactive documentation at:

```
http://localhost:3000/api/docs
```

### Postman Collection

Import Postman collection from:

```
http://localhost:3000/api/postman.json
```

## Best Practices

### 1. Use Pagination for Large Datasets

Always specify `page` and `limit` parameters when fetching lists.

### 2. Implement Retry Logic

Handle rate limiting and temporary failures with exponential backoff.

### 3. Cache Responses

Cache GET responses when appropriate to reduce API calls.

### 4. Use Webhooks for Real-time Updates

Instead of polling, set up webhooks for event notifications.

### 5. Monitor Rate Limits

Check `X-RateLimit-Remaining` headers to avoid hitting limits.

### 6. Validate Responses

Always check `success` field before using `data`.

## Next Steps

- Explore [Videos API](../api/videos-api.md) for detailed video operations
- Learn about [Authentication](../api/authentication.md) and security
- Check [Webhooks](../api/webhooks.md) for real-time notifications
- Review [Error Handling](../api/errors.md) guide for robust integration
