# VidPulse Documentation

Welcome to the VidPulse documentation! VidPulse is a backend service for YouTube video synchronization and classification.

## Language Selection

VidPulse documentation is available in multiple languages:

- **English** - [Go to English documentation](./README.md) (you are here)
- **Русский (Russian)** - [Перейти к документации на русском](../ru/README.md)

For the main documentation entry point with language selection, see [docs/README.md](../README.md).

## What is VidPulse?

VidPulse is a backend service that:

- **Syncs videos** from YouTube channels you subscribe to
- **Enriches metadata** with detailed information
- **Classifies videos** using hybrid (rules + LLM) classification
- **Provides APIs** and admin UI for management

## Quick Links

### Getting Started

- [Quick Start Guide](./getting-started/quick-start.md) - Get up and running in 5 minutes
- [Installation Guide](./getting-started/installation.md) - Detailed installation instructions
- [Configuration Guide](./getting-started/configuration.md) - Environment variables and settings

### User Guides

- [Basic Usage](./guides/basic-usage.md) - Common workflows and operations
- [Add YouTube Channel](./guides/add-channel.md) - How to add and manage channels
- [Manage Videos](./guides/manage-videos.md) - Working with synced videos
- [Classification Setup](./guides/classification-setup.md) - Configuring classification
- [Troubleshooting](./guides/troubleshooting.md) - Common issues and solutions

### API Reference

- [API Overview](./reference/api/overview.md) - Introduction to the REST API
- [Authentication](./reference/api/authentication.md) - API authentication methods
- [Videos API](./reference/api/videos-api.md) - Video-related endpoints
- [Channels API](./reference/api/channels-api.md) - Channel management endpoints
- [Sync API](./reference/api/sync-api.md) - Video synchronization endpoints
- [Admin API](./reference/api/admin-api.md) - Administrative endpoints
- [Webhooks](./reference/api/webhooks.md) - Event notifications

### Development

- [Architecture Overview](./development/architecture/system-overview.md) - System architecture
- [Local Development](./development/setup/local-development.md) - Setting up dev environment
- [Testing Guide](./development/setup/testing.md) - Running tests
- [Code Style](./development/contributing/code-style.md) - Coding standards
- [Contributing](./development/contributing/pull-requests.md) - How to contribute

### Operations

- [Production Deployment](./operations/deployment/production.md) - Deploying to production
- [Docker Deployment](./operations/deployment/docker.md) - Containerized deployment
- [Kubernetes Deployment](./operations/deployment/kubernetes.md) - Kubernetes setup
- [Monitoring](./operations/monitoring/metrics.md) - System monitoring
- [Backup & Recovery](./operations/backup-recovery.md) - Data backup procedures

### Reference

- [Data Model](./reference/data-model/entities.md) - Database schema and entities
- [CLI Reference](./reference/cli/commands.md) - Command-line interface
- [Configuration Reference](./reference/configuration/environment-variables.md) - All configuration options
- [FAQ](./resources/faq.md) - Frequently asked questions
- [Glossary](./resources/glossary.md) - Terminology definitions

## Getting Help

### Community Support

- [GitHub Issues](https://github.com/your-org/vidpulse/issues) - Report bugs and request features
- [Discussions](https://github.com/your-org/vidpulse/discussions) - Ask questions and share ideas

### Professional Support

For enterprise customers, contact support@your-org.com for:

- Priority support
- Custom deployment assistance
- Training and consulting

## Project Status

### Current Version

**v1.0.0** - Stable production release

### Roadmap

See [Roadmap](./roadmap/current.md) for upcoming features and improvements.

### Changelog

View [CHANGELOG.md](../CHANGELOG.md) for version history and changes.

## Contributing

We welcome contributions! Please see:

- [Contributing Guide](./development/contributing/pull-requests.md)
- [Code of Conduct](../CODE_OF_CONDUCT.md)
- [Development Setup](./development/setup/local-development.md)

## License

VidPulse is licensed under the [MIT License](../LICENSE).

## Translations

- [Russian Documentation](../ru/README.md) (Русская документация)

---

## Getting Started Example

```bash
# Clone the repository
git clone https://github.com/your-org/vidpulse.git
cd vidpulse

# Start with Docker Compose
docker-compose up -d

# Or install manually
npm install
npm run db:migrate
npm run dev:api
```

Visit `http://localhost:3000/admin` to access the admin interface.

## Need Help?

1. Check the [FAQ](./resources/faq.md) for common questions
2. Review the [Troubleshooting Guide](./guides/troubleshooting.md)
3. Open a [GitHub Issue](https://github.com/your-org/vidpulse/issues)

## Feedback

Your feedback helps improve VidPulse! Please share your experience:

- What works well?
- What could be better?
- What features would you like to see?

Submit feedback via [GitHub Discussions](https://github.com/your-org/vidpulse/discussions).
