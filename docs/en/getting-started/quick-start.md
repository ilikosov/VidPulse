# Quick Start Guide

Get VidPulse up and running in 5 minutes with this quick start guide.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- [Node.js](https://nodejs.org/) 18+ (for development)
- [PostgreSQL](https://www.postgresql.org/download/) 14+ (or use Docker)
- [Redis](https://redis.io/download/) 7+ (or use Docker)

## Step 1: Clone the Repository

```bash
git clone https://github.com/your-org/vidpulse.git
cd vidpulse
```

## Step 2: Set Up Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```bash
# Basic configuration
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/vidpulse

# Redis
REDIS_URL=redis://localhost:6379

# YouTube API
YOUTUBE_API_KEY=your_youtube_api_key_here
```

## Step 3: Start Services with Docker Compose

Use the provided Docker Compose file to start PostgreSQL and Redis:

```bash
docker-compose up -d postgres redis
```

## Step 4: Install Dependencies and Run Migrations

```bash
npm install
npm run db:migrate
```

## Step 5: Start the Application

Start the API server and worker:

```bash
# Terminal 1: Start API server
npm run dev:api

# Terminal 2: Start worker
npm run dev:worker
```

## Step 6: Access the Admin Interface

Open your browser and navigate to:

```
http://localhost:3000/admin
```

## Step 7: Add Your First YouTube Channel

1. Go to the Admin UI at `http://localhost:3000/admin`
2. Navigate to "Channels" section
3. Click "Add Channel"
4. Enter a YouTube channel ID (e.g., `UC_x5XG1OV2P6uZZ5FSM9Ttw` for Google Developers)
5. Click "Save"

The system will automatically start syncing videos from the channel.

## Next Steps

- Configure additional settings in [Configuration Guide](./configuration.md)
- Learn about the API in [API Overview](../reference/api/overview.md)
- Explore advanced features in [Basic Usage Guide](../guides/basic-usage.md)

## Troubleshooting

### Common Issues

**Database connection errors**: Ensure PostgreSQL is running and DATABASE_URL is correct.

**YouTube API errors**: Verify your YouTube API key has proper permissions.

**Redis connection issues**: Check if Redis is running on the correct port.

### Getting Help

- Check the [Troubleshooting Guide](../guides/troubleshooting.md)
- Review the [FAQ](../resources/faq.md)
- Open an issue on GitHub

---

**Congratulations!** You now have VidPulse running locally. The system will automatically sync videos from your added channels and classify them using hybrid (rules + LLM) classification.
