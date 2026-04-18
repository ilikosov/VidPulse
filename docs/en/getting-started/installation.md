# Installation Guide

Detailed installation instructions for VidPulse - YouTube video synchronization and classification system.

## System Requirements

### Minimum Requirements

- **CPU**: 2 cores
- **RAM**: 4 GB
- **Storage**: 10 GB free space
- **OS**: Linux, macOS, or Windows (WSL2 recommended for Windows)

### Recommended for Production

- **CPU**: 4+ cores
- **RAM**: 8+ GB
- **Storage**: 50+ GB (for video metadata storage)
- **OS**: Linux (Ubuntu 20.04+, Debian 11+, or similar)

## Installation Methods

### Method 1: Docker Compose (Recommended)

#### Step 1: Install Docker and Docker Compose

**Ubuntu/Debian:**

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

**macOS:**

```bash
# Install via Homebrew
brew install docker docker-compose
```

**Windows:**
Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)

#### Step 2: Clone the Repository

```bash
git clone https://github.com/your-org/vidpulse.git
cd vidpulse
```

#### Step 3: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` file with your settings:

```bash
# Required: YouTube API Key
YOUTUBE_API_KEY=your_api_key_here

# Optional: Customize if needed
POSTGRES_PASSWORD=secure_password
REDIS_PASSWORD=another_secure_password
```

#### Step 4: Start All Services

```bash
docker-compose up -d
```

This will start:

- PostgreSQL database on port 5432
- Redis on port 6379
- VidPulse API on port 3000
- VidPulse Worker (background jobs)
- Admin UI on port 3000 (served by API)

#### Step 5: Verify Installation

```bash
# Check running containers
docker-compose ps

# Check API health
curl http://localhost:3000/api/health
```

### Method 2: Manual Installation

#### Step 1: Install Dependencies

**Ubuntu/Debian:**

```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# Install Redis
sudo apt-get install -y redis-server

# Install build tools
sudo apt-get install -y build-essential
```

**macOS:**

```bash
# Install via Homebrew
brew install node@18 postgresql@14 redis
```

#### Step 2: Set Up Database

```bash
# Create database user
sudo -u postgres createuser vidpulse_user
sudo -u postgres createdb vidpulse
sudo -u postgres psql -c "ALTER USER vidpulse_user WITH PASSWORD 'secure_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE vidpulse TO vidpulse_user;"
```

#### Step 3: Clone and Configure

```bash
git clone https://github.com/your-org/vidpulse.git
cd vidpulse

# Install Node.js dependencies
npm install

# Configure environment
cp .env.example .env
```

Edit `.env` with manual configuration:

```env
DATABASE_URL=postgresql://vidpulse_user:secure_password@localhost:5432/vidpulse
REDIS_URL=redis://localhost:6379
YOUTUBE_API_KEY=your_api_key_here
```

#### Step 4: Run Database Migrations

```bash
npm run db:migrate
npm run db:seed  # Optional: seed with sample data
```

#### Step 5: Start Services

```bash
# Terminal 1: Start API server
npm run start:api

# Terminal 2: Start worker
npm run start:worker

# Terminal 3: Start admin UI (if separate)
npm run start:admin
```

### Method 3: Kubernetes (Production)

See the [Kubernetes Deployment Guide](../operations/deployment/kubernetes.md) for production deployment on Kubernetes clusters.

## YouTube API Key Setup

VidPulse requires a YouTube Data API v3 key:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "YouTube Data API v3"
4. Create credentials (API Key)
5. Restrict the key to:
   - YouTube Data API v3 only
   - IP restrictions (for production)
6. Copy the API key to your `.env` file

## Verification

After installation, verify everything is working:

1. **Check API**: `curl http://localhost:3000/api/health` should return `{"status":"ok"}`
2. **Check Database**: `npm run db:check` should show database connection
3. **Check Redis**: `redis-cli ping` should return `PONG`
4. **Access Admin UI**: Open `http://localhost:3000/admin` in browser

## Next Steps

1. **Configure the system**: See [Configuration Guide](./configuration.md)
2. **Add your first channel**: Follow [Quick Start Guide](./quick-start.md)
3. **Set up monitoring**: See [Operations Guide](../operations/monitoring/metrics.md)

## Troubleshooting

### Common Issues

**Database connection failed**:

- Check PostgreSQL is running: `sudo systemctl status postgresql`
- Verify credentials in `.env` match database setup
- Check firewall settings: `sudo ufw allow 5432`

**Redis connection failed**:

- Check Redis is running: `sudo systemctl status redis`
- Test connection: `redis-cli ping`

**YouTube API errors**:

- Verify API key is valid and has YouTube Data API v3 enabled
- Check quota limits in Google Cloud Console

**Port already in use**:

- Change `PORT` in `.env` file
- Stop conflicting services: `sudo lsof -i :3000`

### Getting Help

- Check the [Troubleshooting Guide](../guides/troubleshooting.md)
- Review [FAQ](../resources/faq.md)
- Open an issue on [GitHub](https://github.com/your-org/vidpulse/issues)

## Uninstallation

To completely remove VidPulse:

**Docker Compose:**

```bash
cd vidpulse
docker-compose down -v  # Removes containers and volumes
```

**Manual Installation:**

```bash
# Stop services
pkill -f "node.*vidpulse"

# Remove database
sudo -u postgres dropdb vidpulse
sudo -u postgres dropuser vidpulse_user

# Remove application files
rm -rf /path/to/vidpulse
```
