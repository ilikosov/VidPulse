# 3. System Architecture

## 3.1 Core Components

- API Server (Node.js + Fastify)
- Worker (BullMQ consumer)
- Redis (queues)
- PostgreSQL (storage)
- Web Admin (Next.js)

---

## 3.2 Data Flow

```text
YouTube API
    ↓
Worker (sync)
    ↓
PostgreSQL (raw data)
    ↓
Worker (enrichment + classification)
    ↓
PostgreSQL (structured data)
    ↓
API → Admin UI
```
