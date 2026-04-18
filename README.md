# VidPulse - YouTube Video Synchronization and Classification Service

Backend сервис с веб-админкой для синхронизации видео из YouTube-каналов и гибридной классификации (rules + LLM).

## Архитектура

Система состоит из трёх основных компонентов:

1. **API Server** (Node.js + Fastify) - REST API для управления системой
2. **Worker** (BullMQ) - обработка фоновых задач (синхронизация, классификация)
3. **Admin UI** (Next.js) - веб-интерфейс для мониторинга и управления

## Технологический стек

- **Backend**: Node.js, TypeScript, Fastify
- **База данных**: PostgreSQL (Prisma ORM)
- **Очереди**: Redis, BullMQ
- **Классификация**: Rule-based engine + OpenAI GPT
- **Админка**: Next.js, React, TailwindCSS, React Query

## Структура проекта

```
├── api/                    # Fastify API сервер
│   ├── src/
│   │   ├── config/        # Конфигурация
│   │   ├── routes/        # Маршруты API
│   │   ├── services/      # Бизнес-логика
│   │   └── index.ts       # Точка входа
│   └── prisma/            # Схема базы данных
├── worker/                # BullMQ worker
│   ├── src/
│   │   ├── jobs/         # Определения задач
│   │   ├── processors/   # Обработчики задач
│   │   └── index.ts      # Точка входа
├── admin/                 # Next.js админка
│   ├── app/              # App router
│   ├── components/       # React компоненты
│   └── lib/              # Утилиты
├── shared/               # Общие типы и утилиты
│   ├── types/           # TypeScript типы
│   ├── utils/           # Утилиты
│   └── constants/       # Константы
├── infra/                # Инфраструктура
│   ├── docker/          # Docker файлы
│   └── migrations/      # Миграции БД
└── scripts/             # Вспомогательные скрипты
```

## Быстрый старт

### Предварительные требования

- Node.js 18+
- Docker и Docker Compose
- YouTube Data API ключ
- OpenAI API ключ (опционально)

### Установка

1. Клонировать репозиторий:

   ```bash
   git clone <repository-url>
   cd vidpulse
   ```

2. Установить зависимости:

   ```bash
   npm install
   ```

3. Настроить переменные окружения:

   ```bash
   cp .env.example .env
   # Отредактировать .env файл
   ```

4. Запустить инфраструктуру:

   ```bash
   npm run docker:up
   ```

5. Применить миграции базы данных:

   ```bash
   npm run db:migrate
   ```

6. Запустить все сервисы в режиме разработки:
   ```bash
   npm run dev
   ```

### Запуск отдельных компонентов

- **API сервер**: `npm run dev:api`
- **Worker**: `npm run dev:worker`
- **Admin UI**: `npm run dev:admin`

## API Endpoints

### Public API

- `GET /api/v1/videos` - список видео
- `GET /api/v1/channels` - список каналов
- `POST /api/v1/channels/:id/sync` - запуск синхронизации канала

### Admin API

- `GET /api/v1/admin/stats` - статистика системы
- `GET /api/v1/admin/queue` - статус очередей
- `POST /api/v1/admin/reclassify` - переклассификация видео

### Health checks

- `GET /health` - статус сервиса
- `GET /health/ready` - проверка готовности (БД, Redis)
- `GET /health/live` - проверка живости

## Классификация видео

Система использует гибридный подход:

1. **Rule-based классификация** - быстрый анализ по ключевым словам
2. **LLM extraction** - структурированный анализ через GPT для сложных случаев
3. **Кеширование** - результаты LLM кешируются для одинаковых видео

Результат классификации включает:

- Тип видео (fan_cam, official_mv, live_performance и т.д.)
- Артист/группа
- Песня
- Мероприятие
- Локация
- Дата

## Мониторинг

- **Admin UI**: http://localhost:3001
- **API документация**: http://localhost:3000/docs
- **База данных**: http://localhost:8080 (Adminer)
- **Redis Insight**: http://localhost:8001 (если настроен)

## Разработка

### Добавление нового типа задачи

1. Добавить тип в `shared/types/index.ts` (enum JobType)
2. Создать обработчик в `worker/src/processors/`
3. Зарегистрировать обработчик в `worker/src/index.ts`

### Добавление нового поля в видео

1. Обновить схему Prisma в `api/prisma/schema.prisma`
2. Сгенерировать миграцию: `npm run db:generate`
3. Применить миграцию: `npm run db:migrate`
4. Обновить типы в `shared/types/index.ts`

## Лицензия

MIT
