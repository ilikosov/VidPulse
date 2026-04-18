# 3. Архитектура системы

## 3.1 Основные компоненты

- API сервер (Node.js + Fastify)
- Worker (BullMQ consumer)
- Redis (очереди)
- PostgreSQL (хранилище)
- Web Admin (Next.js)

---

## 3.2 Поток данных

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

