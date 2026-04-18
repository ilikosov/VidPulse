# 4. Data Model (PostgreSQL)

## 4.1 Video

- id (string, primary key)
- channelId
- title
- description
- publishedAt
- metadata (json)
- extraction (json, structured output)
- classificationVersion (int)
- createdAt
- updatedAt

---

## 4.2 Channel

- id
- title
- uploadsPlaylistId
- lastSyncedAt
- backfillCursor

---

## 4.3 Queue Jobs

Job types:

- sync_channel
- enrich_videos
- backfill_channel
- reclassify_videos
