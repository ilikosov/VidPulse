# YouTube Sync System

A queue-based YouTube video sync system built with Node.js, Fastify, BullMQ, PostgreSQL, and Prisma.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Fastify   │────▶│   BullMQ    │────▶│   Worker    │
│     API     │     │   (Redis)   │     │             │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │  YouTube    │
                                        │    API      │
                                        └──────┬──────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │  PostgreSQL │
                                        │  (Prisma)   │
                                        └─────────────┘
```

## Project Structure

```
youtube-sync/
├── apps/
│   ├── api/          # Fastify backend server
│   └── worker/       # BullMQ consumer for processing sync jobs
├── packages/
│   ├── db/           # Prisma ORM + database client
│   ├── youtube/      # YouTube Data API v3 wrapper
│   ├── queue/        # BullMQ queue abstraction
│   └── typescript-config/  # Shared TypeScript config
└── infra/
    └── docker-compose.yml  # Docker services (postgres, redis, api, worker)
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local development)
- YouTube Data API v3 key

### Environment Setup

1. Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

2. Add your YouTube API key to `.env`:

```
YOUTUBE_API_KEY=your_api_key_here
```

### Running with Docker

```bash
# Start all services
docker-compose -f infra/docker-compose.yml up --build

# The API will be available at http://localhost:3000
```

### Local Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate --workspace=@youtube-sync/db

# Push schema to database (ensure PostgreSQL is running)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/youtube_sync npm run db:push --workspace=@youtube-sync/db

# Start API server
npm run dev --workspace=@youtube-sync/api

# Start worker (in another terminal)
YOUTUBE_API_KEY=your_key npm run dev --workspace=@youtube-sync/worker
```

## API Endpoints

### POST /sync/:channelId

Queue a sync job for a YouTube channel.

**Request:**
```bash
curl -X POST http://localhost:3000/sync/UCxxxxxxxxxxxxxxxxxxx
```

**Response (202 Accepted):**
```json
{
  "message": "Sync job queued",
  "channelId": "UCxxxxxxxxxxxxxxxxxxx"
}
```

### GET /videos

Fetch all videos from the database.

**Query Parameters:**
- `channelId` (optional): Filter by channel ID

**Example:**
```bash
curl http://localhost:3000/videos
curl http://localhost:3000/videos?channelId=UCxxxxxxxxxxxxxxxxxxx
```

**Response:**
```json
{
  "videos": [
    {
      "id": "video_id",
      "channelId": "channel_id",
      "title": "Video Title",
      "publishedAt": "2024-01-01T00:00:00.000Z",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "channel": {
        "id": "channel_id",
        "title": "Channel Name",
        "uploadsPlaylistId": "UUxxxxxxxxxxxxxxxxxxx",
        "lastSyncedAt": "2024-01-01T00:00:00.000Z"
      }
    }
  ]
}
```

### GET /channels

Fetch all channels from the database.

**Example:**
```bash
curl http://localhost:3000/channels
```

### GET /health

Health check endpoint.

**Example:**
```bash
curl http://localhost:3000/health
```

## Database Schema

### Channel
- `id` (String, primary key): YouTube channel ID
- `title` (String): Channel title
- `uploadsPlaylistId` (String): YouTube uploads playlist ID
- `lastSyncedAt` (DateTime, nullable): Last sync timestamp

### Video
- `id` (String, primary key): YouTube video ID
- `channelId` (String, foreign key): Reference to Channel
- `title` (String): Video title
- `publishedAt` (DateTime): Video publish date
- `createdAt` (DateTime): Record creation timestamp

## Queue System

The system uses BullMQ with Redis for job processing:

- **Queue Name:** `sync_channel`
- **Job Payload:** `{ channelId: string }`
- **Processing:** Fetches videos from YouTube, deduplicates by videoId, and stores in PostgreSQL using UPSERT logic

## Features

- ✅ YouTube Data API v3 integration (using `playlistItems.list`, NOT `search.list`)
- ✅ Queue-based architecture with BullMQ
- ✅ PostgreSQL database with Prisma ORM
- ✅ Fastify REST API
- ✅ Deduplication by videoId
- ✅ UPSERT logic for videos
- ✅ Docker Compose setup for all services
- ✅ Graceful shutdown handling

## Notes

- This is Phase 1 (MVP) - no LLM, classification, or advanced features
- Videos are deduplicated by YouTube video ID
- Channel titles are set to "Channel {channelId}" as a placeholder (can be enhanced later)
- Maximum 50 videos fetched per sync (configurable)
