# Local Development Environment Setup

This guide explains how to set up a local development environment for VidPulse. You'll learn how to run all components locally for development and testing.

## Prerequisites

### Required Software

1. **Node.js** (v18 or later)

   ```bash
   # Check version
   node --version
   ```

2. **npm** or **yarn**

   ```bash
   npm --version
   # or
   yarn --version
   ```

3. **Docker** and **Docker Compose**

   ```bash
   docker --version
   docker-compose --version
   ```

4. **Git**

   ```bash
   git --version
   ```

5. **PostgreSQL** (optional, can use Docker)

   ```bash
   psql --version
   ```

6. **Redis** (optional, can use Docker)
   ```bash
   redis-cli --version
   ```

### Optional but Recommended

- **VS Code** or your preferred IDE
- **Postman** or **curl** for API testing
- **pgAdmin** or **TablePlus** for database management

## Project Structure

VidPulse consists of multiple services:

```
vidpulse/
├── api/                 # Fastify API server
├── worker/              # BullMQ worker for sync/classification
├── admin-ui/            # Next.js admin interface
├── shared/              # Shared utilities and types
├── docker-compose.yml   # Development environment
└── .env.example         # Environment variables template
```

## Setup Methods

### Method 1: Docker Compose (Quick Start)

#### Step 1: Clone the Repository

```bash
git clone https://github.com/your-org/vidpulse.git
cd vidpulse
```

#### Step 2: Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit the .env file with your values
nano .env
```

Key environment variables to set:

```env
# Database
POSTGRES_USER=vidpulse
POSTGRES_PASSWORD=vidpulse_password
POSTGRES_DB=vidpulse
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# YouTube API
YOUTUBE_API_KEY=your_youtube_api_key_here

# OpenAI/LLM (optional)
OPENAI_API_KEY=your_openai_api_key_here

# JWT Secret
JWT_SECRET=your_jwt_secret_here
```

#### Step 3: Start Services

```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f api
docker-compose logs -f worker
docker-compose logs -f admin-ui
```

#### Step 4: Initialize Database

```bash
# Run migrations
docker-compose exec api npm run db:migrate

# Seed initial data (optional)
docker-compose exec api npm run db:seed
```

#### Step 5: Access Services

- **API**: http://localhost:3000
- **Admin UI**: http://localhost:3001
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
- **pgAdmin** (if enabled): http://localhost:5050

### Method 2: Manual Setup (For Development)

#### Step 1: Clone and Install Dependencies

```bash
git clone https://github.com/your-org/vidpulse.git
cd vidpulse

# Install root dependencies (if any)
npm install

# Install API dependencies
cd api
npm install

# Install worker dependencies
cd ../worker
npm install

# Install admin-ui dependencies
cd ../admin-ui
npm install

cd ..
```

#### Step 2: Start Infrastructure Services

Using Docker for infrastructure:

```bash
# Start PostgreSQL and Redis
docker-compose -f docker-compose.infrastructure.yml up -d
```

Or manually install and run:

**PostgreSQL:**

```bash
# macOS with Homebrew
brew install postgresql
brew services start postgresql

# Create database
createdb vidpulse
```

**Redis:**

```bash
# macOS with Homebrew
brew install redis
brew services start redis
```

#### Step 3: Configure Environment

Create `.env` files in each service directory:

**api/.env:**

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://vidpulse:vidpulse_password@localhost:5432/vidpulse
REDIS_URL=redis://localhost:6379
YOUTUBE_API_KEY=your_youtube_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
JWT_SECRET=development_jwt_secret
```

**worker/.env:**

```env
NODE_ENV=development
DATABASE_URL=postgresql://vidpulse:vidpulse_password@localhost:5432/vidpulse
REDIS_URL=redis://localhost:6379
YOUTUBE_API_KEY=your_youtube_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

**admin-ui/.env.local:**

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_APP_ENV=development
```

#### Step 4: Set Up Database

```bash
# Navigate to API directory
cd api

# Run migrations
npm run db:migrate

# Seed data (optional)
npm run db:seed
```

#### Step 5: Start Services

**Terminal 1 - API Server:**

```bash
cd api
npm run dev
```

**Terminal 2 - Worker:**

```bash
cd worker
npm run dev
```

**Terminal 3 - Admin UI:**

```bash
cd admin-ui
npm run dev
```

## YouTube API Key Setup

VidPulse requires a YouTube Data API v3 key:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "YouTube Data API v3"
4. Create credentials (API key)
5. Restrict the key to:
   - YouTube Data API v3
   - IP restrictions (optional for development)
6. Copy the API key to your `.env` file

## OpenAI API Key (Optional)

For LLM-based classification:

1. Sign up at [OpenAI Platform](https://platform.openai.com/)
2. Create an API key
3. Add to `.env` as `OPENAI_API_KEY`
4. Without this key, the system will use rule-based classification only

## Development Workflow

### Running Tests

```bash
# API tests
cd api
npm test

# Worker tests
cd ../worker
npm test

# Admin UI tests
cd ../admin-ui
npm test
```

### Code Quality

```bash
# Lint code
npm run lint

# Format code
npm run format

# Type checking (TypeScript)
npm run type-check
```

### Database Management

```bash
# Create migration
cd api
npm run db:create-migration --name=add_feature

# Run migrations
npm run db:migrate

# Rollback last migration
npm run db:rollback

# Reset database (development only)
npm run db:reset
```

### Queue Management

```bash
# View queue status
curl http://localhost:3000/api/admin/queue

# Retry failed jobs
curl -X POST http://localhost:3000/api/admin/queue/retry-failed

# Clean completed jobs
curl -X POST http://localhost:3000/api/admin/queue/clean
```

## Debugging

### Common Issues

#### "Cannot connect to PostgreSQL"

```bash
# Check if PostgreSQL is running
psql -U vidpulse -d vidpulse -h localhost

# If using Docker, check container status
docker-compose ps postgres
```

#### "Redis connection failed"

```bash
# Test Redis connection
redis-cli ping

# Check Redis logs
docker-compose logs redis
```

#### "YouTube API quota exceeded"

- Check quota usage in Google Cloud Console
- Reduce sync frequency during development
- Use mock data for testing

#### "Worker not processing jobs"

```bash
# Check worker logs
docker-compose logs worker

# Check queue status
curl http://localhost:3000/api/admin/queue

# Manually trigger a job
curl -X POST http://localhost:3000/api/admin/queue/test-job
```

### Logs

**Docker Compose:**

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f worker
docker-compose logs -f admin-ui
```

**Manual Setup:**

- API logs: Console output from `npm run dev`
- Worker logs: Console output from worker process
- Admin UI logs: Browser developer console + server logs

## Testing with Mock Data

For development without YouTube API:

1. Enable mock mode in `.env`:

   ```env
   USE_MOCK_DATA=true
   YOUTUBE_API_KEY=mock
   ```

2. Use the mock data generator:

   ```bash
   cd api
   npm run generate-mock-data
   ```

3. The system will use pre-defined mock responses instead of calling YouTube API.

## Development Tips

### Hot Reload

- API: Uses nodemon for automatic restart on file changes
- Worker: Restarts when source files change
- Admin UI: Next.js hot reload enabled

### Database Seeding

```bash
# Seed with test channels and videos
cd api
npm run db:seed -- --test-data
```

### API Documentation

- Swagger UI: http://localhost:3000/documentation
- OpenAPI spec: http://localhost:3000/documentation/json

### Monitoring

- **Admin UI**: http://localhost:3001/admin
- **Queue dashboard**: http://localhost:3001/admin/queue
- **System metrics**: http://localhost:3000/api/admin/metrics

## Production vs Development Differences

| Aspect         | Development           | Production                               |
| -------------- | --------------------- | ---------------------------------------- |
| Database       | Local PostgreSQL      | Managed PostgreSQL (RDS, Cloud SQL)      |
| Redis          | Local instance        | Managed Redis (ElastiCache, Redis Cloud) |
| Logging        | Console output        | Structured logging (JSON)                |
| Error handling | Detailed stack traces | Generic error messages                   |
| CORS           | Allow all origins     | Restricted to specific domains           |
| HTTPS          | HTTP only             | HTTPS required                           |
| Monitoring     | Basic logs            | Full observability stack                 |

## Next Steps

After setting up your local environment:

1. **Test the API**: `curl http://localhost:3000/api/health`
2. **Add a test channel**: Use the Admin UI or API
3. **Trigger a sync**: Test the sync workflow
4. **Explore the codebase**: Understand the architecture
5. **Run the test suite**: Ensure everything works

## Troubleshooting

### Port Conflicts

If ports are already in use:

```bash
# Check what's using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change ports in .env
PORT=3001
```

### Docker Issues

```bash
# Reset Docker
docker-compose down -v
docker-compose up -d

# Rebuild images
docker-compose build --no-cache
```

### Database Issues

```bash
# Reset database
docker-compose exec postgres psql -U vidpulse -c "DROP DATABASE IF EXISTS vidpulse;"
docker-compose exec postgres psql -U vidpulse -c "CREATE DATABASE vidpulse;"
docker-compose exec api npm run db:migrate
```

### Node.js Version Issues

Use nvm to manage Node.js versions:

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Use correct Node.js version
nvm install 18
nvm use 18
```

## Getting Help

- **Documentation**: Check other guides in `/docs/en/`
- **Issues**: GitHub issue tracker
- **Discord/Slack**: Community channels
- **Code review**: Submit PRs for review

## Related Guides

- [Installation Guide](../getting-started/installation.md)
- [Basic Usage Guide](../guides/basic-usage.md)
- [API Reference](../reference/api/overview.md)
- [Deployment Guide](../deployment/production.md)
