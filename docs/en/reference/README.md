# Technical Reference

This section contains technical reference documentation for VidPulse, including API documentation, CLI commands, data models, and configuration details.

## API Reference

The VidPulse REST API allows programmatic access to all system features.

### Core API Documentation

- **[API Overview](./api/overview.md)** - Introduction to the REST API
- **[Authentication](./api/authentication.md)** - API authentication methods
- **[Videos API](./api/videos-api.md)** - Video-related endpoints
- **[Channels API](./api/channels-api.md)** - Channel management endpoints
- **[Sync API](./api/sync-api.md)** - Video synchronization endpoints
- **[Admin API](./api/admin-api.md)** - Administrative endpoints
- **[Webhooks](./api/webhooks.md)** - Event notifications

### API Clients

- **JavaScript/TypeScript** - Official SDK (coming soon)
- **Python** - Python client library (coming soon)
- **cURL** - Examples provided in each endpoint documentation

## CLI Reference

Command-line interface for managing VidPulse.

- **[CLI Overview](./cli/overview.md)** - Introduction to the CLI
- **[CLI Commands](./cli/commands.md)** - Complete command reference

## Data Model

Detailed documentation of the VidPulse data structures.

- **[Data Model Overview](./data-model/overview.md)** - Introduction to the data model
- **[Entities](./data-model/entities.md)** - Database entities and their fields
- **[Relationships](./data-model/relationships.md)** - Relationships between entities
- **[Migrations](./data-model/migrations.md)** - Database migration history

## Configuration Reference

Detailed configuration options for VidPulse.

- **[Configuration Overview](./configuration/overview.md)** - Introduction to configuration
- **[Environment Variables](./configuration/environment-variables.md)** - All environment variables
- **[Database Configuration](./configuration/database.md)** - Database setup and tuning
- **[Redis Configuration](./configuration/redis.md)** - Redis setup and optimization

## SDKs and Libraries

### Official SDKs

- **JavaScript/TypeScript SDK** - (coming soon)
- **Python SDK** - (coming soon)

### Community Libraries

- **Go Client** - (community contribution)
- **Ruby Gem** - (community contribution)

## Rate Limits and Quotas

- **API Rate Limits**: 100 requests per minute per authenticated user
- **YouTube API Quotas**: Managed automatically with configurable limits
- **Classification Limits**: Configurable based on your OpenAI/LLM provider

## Error Codes

Common error codes and their meanings:

- `VALIDATION_ERROR` - Invalid input parameters
- `AUTHENTICATION_ERROR` - Authentication failed
- `AUTHORIZATION_ERROR` - Insufficient permissions
- `RESOURCE_NOT_FOUND` - Requested resource doesn't exist
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INTERNAL_SERVER_ERROR` - Server error

## Versioning

The API uses semantic versioning. Current version: `v1`.

- **v1** - Current stable version
- **v0** - Deprecated, not supported

## Russian Documentation

For Russian-language reference documentation, visit the [Russian reference section](../../ru/reference/README.md).
