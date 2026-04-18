# 📁 Структура проекта (youtube-sync)

## 🧱 Root

youtube-sync/
│
├── apps/
├── packages/
├── infra/
├── docs/
├── turbo.json
├── package.json
├── tsconfig.base.json
└── .env

---

# 🚀 apps (runtime-сервисы)

apps/
│
├── api/ # Fastify API (основной backend)
│ ├── src/
│ │ ├── routes/
│ │ ├── controllers/
│ │ ├── services/
│ │ ├── plugins/
│ │ └── server.ts
│ ├── package.json
│ └── tsconfig.json
│
├── worker/ # единый worker (sync + enrich + classify)
│ ├── src/
│ │ ├── jobs/
│ │ ├── processors/
│ │ ├── youtube/
│ │ └── index.ts
│ ├── package.json
│ └── tsconfig.json
│
└── admin-web/ # Next.js админка
├── app/
│ ├── dashboard/
│ ├── channels/
│ ├── videos/
│ └── system/
├── components/
├── lib/
├── package.json
└── next.config.js

---

# 🧩 packages (shared logic)

packages/
│
├── db/ # Prisma + DB client
│ ├── prisma/
│ │ ├── schema.prisma
│ ├── src/
│ │ └── client.ts
│ └── package.json
│
├── youtube/ # YouTube API wrapper
│ ├── src/
│ │ ├── client.ts
│ │ ├── playlist.ts
│ │ ├── videos.ts
│ │ └── types.ts
│ └── package.json
│
├── queue/ # BullMQ abstraction
│ ├── src/
│ │ ├── connection.ts
│ │ ├── queues.ts
│ │ └── worker.ts
│ └── package.json
│
├── config/ # env + config loader
│ ├── src/
│ └── package.json
│
├── logger/ # pino logger wrapper
│ ├── src/
│ └── package.json
│
└── utils/ # shared helpers
├── src/
│ ├── chunk.ts
│ ├── hash.ts
│ └── time.ts
└── package.json

---

# 🐳 infra (Docker + окружение)

infra/
│
├── docker/
│ ├── postgres/
│ ├── redis/
│ └── nginx/
│
└── docker-compose.yml

---

# 📚 docs (документация проекта)

docs/
│
├── ROADMAP.md
├── architecture.md
├── api.md
├── data-model.md
└── classification.md

---

# ⚙️ root config files

- turbo.json
- package.json
- tsconfig.base.json
- .env

---

# 🧠 Ключевая идея структуры

## apps/

→ всё что запускается

## packages/

→ всё что переиспользуется

## infra/

→ всё что связано с Docker/деплоем

## docs/

→ описание системы

---

# 🚀 Итог

Это структура:

- простая (не over-engineered)
- масштабируемая
- подходит для 100+ каналов
- легко превращается в production систему
