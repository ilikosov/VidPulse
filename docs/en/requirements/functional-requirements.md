# 2. Core Functionality

## 2.1 Video Synchronization

- Channel list retrieval
- Regular check for new videos
- Backfill support (history up to a specified date)
- Incremental synchronization

Source: YouTube Data API v3

---

## 2.2 Metadata Enrichment

Preserved fields:

- title
- description
- publishedAt
- duration
- viewCount / likeCount / commentCount
- thumbnails
- channelId

---

## 2.3 Hybrid Classification

Modes:

1. Rule-based (fast)
2. LLM-based extraction (complex cases)
3. Hybrid (primary mode)

Example result:

```json
{
  "type": "fan_cam",
  "artist": "BLACKPINK",
  "group": "BLACKPINK",
  "song": "Pink Venom",
  "event": "World Tour",
  "location": "Seoul",
  "date": "2023-08-12"
}
```

---

## 2.4 Reclassification

- Support for classification logic changes
- Bulk reclassification
- Classifier versioning

---

## 2.5 Administrative Panel

- System statistics
- Synchronization management
- Backfill management
- Reclassification management
- LLM usage monitoring
