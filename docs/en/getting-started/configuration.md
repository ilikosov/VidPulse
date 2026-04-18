# Configuration Guide

Complete guide to configuring VidPulse for different environments and use cases.

## Environment Variables

VidPulse uses environment variables for configuration. Create a `.env` file in the project root or set them in your deployment environment.

### Required Variables

| Variable          | Description               | Default                  | Example                                          |
| ----------------- | ------------------------- | ------------------------ | ------------------------------------------------ |
| `NODE_ENV`        | Environment mode          | `development`            | `production`, `development`, `test`              |
| `PORT`            | API server port           | `3000`                   | `8080`                                           |
| `DATABASE_URL`    | PostgreSQL connection URL | -                        | `postgresql://user:pass@localhost:5432/vidpulse` |
| `REDIS_URL`       | Redis connection URL      | `redis://localhost:6379` | `redis://:password@redis-host:6379`              |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key   | -                        | `AIzaSyB...`                                     |

### Optional Variables

#### Application Settings

| Variable           | Description                   | Default |
| ------------------ | ----------------------------- | ------- |
| `API_BASE_PATH`    | Base path for API routes      | `/api`  |
| `ADMIN_UI_ENABLED` | Enable admin UI               | `true`  |
| `CORS_ORIGIN`      | CORS allowed origins          | `*`     |
| `LOG_LEVEL`        | Logging level                 | `info`  |
| `LOG_FORMAT`       | Log format (`json` or `text`) | `json`  |

#### Database & Redis

| Variable            | Description                  | Default |
| ------------------- | ---------------------------- | ------- |
| `DATABASE_POOL_MIN` | Minimum database connections | `2`     |
| `DATABASE_POOL_MAX` | Maximum database connections | `10`    |
| `REDIS_PASSWORD`    | Redis password (if required) | -       |
| `REDIS_DB`          | Redis database number        | `0`     |

#### YouTube Sync Settings

| Variable                  | Description                 | Default |
| ------------------------- | --------------------------- | ------- |
| `SYNC_INTERVAL_MINUTES`   | Minutes between sync checks | `60`    |
| `SYNC_BATCH_SIZE`         | Videos to fetch per batch   | `50`    |
| `SYNC_MAX_RETRIES`        | Maximum retry attempts      | `3`     |
| `SYNC_RETRY_DELAY_MS`     | Delay between retries (ms)  | `5000`  |
| `YOUTUBE_API_QUOTA_LIMIT` | Daily API quota limit       | `10000` |

#### Classification Settings

| Variable              | Description                                   | Default               |
| --------------------- | --------------------------------------------- | --------------------- |
| `CLASSIFICATION_MODE` | `rules`, `llm`, or `hybrid`                   | `hybrid`              |
| `LLM_PROVIDER`        | LLM provider (`openai`, `anthropic`, `local`) | `openai`              |
| `OPENAI_API_KEY`      | OpenAI API key (if using OpenAI)              | -                     |
| `ANTHROPIC_API_KEY`   | Anthropic API key (if using Claude)           | -                     |
| `LLM_MODEL`           | Model name                                    | `gpt-4-turbo-preview` |
| `LLM_TEMPERATURE`     | Model temperature                             | `0.1`                 |
| `LLM_MAX_TOKENS`      | Maximum tokens per request                    | `1000`                |

#### Queue & Worker Settings

| Variable                       | Description                   | Default |
| ------------------------------ | ----------------------------- | ------- |
| `QUEUE_CONCURRENCY`            | Number of concurrent workers  | `5`     |
| `QUEUE_RETRY_ATTEMPTS`         | Job retry attempts            | `3`     |
| `QUEUE_BACKOFF_MS`             | Exponential backoff base (ms) | `3000`  |
| `WORKER_HEALTH_CHECK_INTERVAL` | Health check interval (ms)    | `30000` |

#### Security

| Variable                  | Description                       | Default |
| ------------------------- | --------------------------------- | ------- |
| `JWT_SECRET`              | JWT secret for API authentication | -       |
| `API_KEY`                 | Static API key for simple auth    | -       |
| `RATE_LIMIT_WINDOW_MS`    | Rate limit window (ms)            | `60000` |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window           | `100`   |

## Configuration Files

### Docker Compose Configuration

Example `docker-compose.yml`:

```yaml
version: "3.8"

services:
  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-vidpulse}
      POSTGRES_DB: vidpulse
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD:-vidpulse}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  api:
    build: .
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD:-vidpulse}@postgres:5432/vidpulse
      REDIS_URL: redis://:${REDIS_PASSWORD:-vidpulse}@redis:6379
      YOUTUBE_API_KEY: ${YOUTUBE_API_KEY}
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis

  worker:
    build: .
    command: npm run start:worker
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD:-vidpulse}@postgres:5432/vidpulse
      REDIS_URL: redis://:${REDIS_PASSWORD:-vidpulse}@redis:6379
      YOUTUBE_API_KEY: ${YOUTUBE_API_KEY}
    depends_on:
      - postgres
      - redis

volumes:
  postgres_data:
  redis_data:
```

### Application Configuration

VidPulse can also be configured via a `config/` directory:

```
config/
├── default.js      # Default configuration
├── development.js  # Development overrides
├── production.js   # Production overrides
└── test.js        # Test overrides
```

Example `config/default.js`:

```javascript
module.exports = {
  app: {
    name: "VidPulse",
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || "development",
  },

  database: {
    url: process.env.DATABASE_URL,
    pool: {
      min: parseInt(process.env.DATABASE_POOL_MIN) || 2,
      max: parseInt(process.env.DATABASE_POOL_MAX) || 10,
    },
  },

  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },

  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY,
    syncInterval: parseInt(process.env.SYNC_INTERVAL_MINUTES) || 60,
    batchSize: parseInt(process.env.SYNC_BATCH_SIZE) || 50,
  },

  classification: {
    mode: process.env.CLASSIFICATION_MODE || "hybrid",
    llm: {
      provider: process.env.LLM_PROVIDER || "openai",
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.LLM_MODEL || "gpt-4-turbo-preview",
    },
  },
};
```

## Environment-Specific Configuration

### Development

`.env.development`:

```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://localhost:5432/vidpulse_dev
REDIS_URL=redis://localhost:6379
LOG_LEVEL=debug
LOG_FORMAT=text
```

### Production

`.env.production`:

```bash
NODE_ENV=production
PORT=8080
DATABASE_URL=postgresql://user:password@prod-db:5432/vidpulse
REDIS_URL=redis://:password@prod-redis:6379/0
LOG_LEVEL=info
LOG_FORMAT=json
CORS_ORIGIN=https://your-domain.com
JWT_SECRET=your-secure-jwt-secret
```

### Testing

`.env.test`:

```bash
NODE_ENV=test
PORT=3001
DATABASE_URL=postgresql://localhost:5432/vidpulse_test
REDIS_URL=redis://localhost:6380
LOG_LEVEL=error
```

## Advanced Configuration

### Database Connection Pool Tuning

For high-traffic deployments, adjust database connection pool:

```bash
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=50
DATABASE_STATEMENT_TIMEOUT=30000
```

### Redis Configuration for Production

```bash
REDIS_URL=redis://:strong-password@redis-host:6379/0
REDIS_TLS=true  # Enable TLS for cloud Redis
REDIS_CONNECTION_TIMEOUT=10000
```

### Rate Limiting Configuration

```bash
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=1000
RATE_LIMIT_SKIP_SUCCESSFUL_RESET=false
```

### YouTube API Quota Management

```bash
YOUTUBE_API_QUOTA_LIMIT=10000
YOUTUBE_API_QUOTA_RESET_HOUR=0  # UTC hour for quota reset
SYNC_BATCH_SIZE=25  # Smaller batches for quota conservation
```

## Validation

VidPulse validates configuration on startup. To check your configuration:

```bash
# Validate environment variables
npm run config:validate

# Show current configuration (without secrets)
npm run config:show
```

## Configuration Migration

When upgrading versions, check for configuration changes:

```bash
# Compare current config with defaults
npm run config:diff
```

## Troubleshooting Configuration Issues

### Common Problems

**Missing required variables**:

```bash
Error: Missing required environment variable: YOUTUBE_API_KEY
```

Solution: Set all required variables in `.env` file.

**Database connection errors**:

```bash
Error: connect ECONNREFUSED 127.0.0.1:5432
```

Solution: Verify `DATABASE_URL` and ensure PostgreSQL is running.

**Redis connection errors**:

```bash
Error: Redis connection failed
```

Solution: Check `REDIS_URL` format and Redis server status.

**Invalid YouTube API key**:

```bash
Error: YouTube API quota exceeded
```

Solution: Verify API key has YouTube Data API v3 enabled and sufficient quota.

### Debugging

Enable debug logging to see configuration loading:

```bash
LOG_LEVEL=debug
DEBUG=vidpulse:config*
```

## Next Steps

- Learn about [API Configuration](../reference/api/authentication.md)
- Set up [Monitoring and Alerts](../operations/monitoring/metrics.md)
- Configure [Backup and Recovery](../operations/backup-recovery.md)
