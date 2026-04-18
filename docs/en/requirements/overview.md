# 1. Project Overview

_This document is a placeholder. The full Russian version is available at [Russian Overview](../ru/requirements/01_overview.md)._

## Project Goal

Develop a backend service with web admin interface that:

- Retrieves video lists from subscribed YouTube channels via YouTube Data API
- Synchronizes new videos to a local database
- Extracts and structures video metadata
- Performs hybrid classification (rules + LLM)
- Provides API and web interface for system monitoring and management

## Key Features

- **YouTube Integration**: Connect to YouTube Data API v3
- **Video Synchronization**: Regular checking for new videos, support for backfill (history up to a specified date)
- **Metadata Enrichment**: Extract and structure video metadata
- **Hybrid Classification**: Combine rule-based and LLM-based classification
- **API & Admin UI**: REST API and web interface for management

## Target Audience

- Content managers and moderators
- Developers integrating with video platforms
- Researchers analyzing video content

---

_Note: This is a machine-translated summary. For complete and accurate requirements, please refer to the Russian version or contribute to the translation._
