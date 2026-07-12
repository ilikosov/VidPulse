# VidPulse

> 🌐 **Языки:** [English](./overview.en.md) · **Русский**
>
> 📚 **См. также:** [Сущности и связи](./entities.ru.md)

VidPulse — full-stack приложение для архивации и управления **метаданными K-pop видео**. Оно загружает видео с YouTube-каналов и плейлистов, автоматически разбирает структурированные метаданные из их названий (группа, артист, песня, дата выступления, событие, определение fancam), позволяет проверять и исправлять эти метаданные и упорядочивает всё по кураторскому словарю групп, артистов, песен и событий.

---

## Содержание

- [Возможности](#возможности)
- [Архитектура](#архитектура)
- [Технологии](#технологии)
- [Требования](#требования)
- [Быстрый старт](#быстрый-старт)
- [Переменные окружения](#переменные-окружения)
- [NPM-скрипты](#npm-скрипты)
- [Структура проекта](#структура-проекта)
- [Модель данных](#модель-данных)
- [REST API](#rest-api)
- [Тестирование](#тестирование)
- [Соглашения](#соглашения)

---

## Возможности

- **Загрузка с YouTube** — добавляйте каналы и плейлисты; видео синхронизируются через YouTube Data API (плановая cron-задача поддерживает их в актуальном состоянии).
- **Автоматический разбор метаданных** — многоэтапный парсер извлекает из сырого названия группу, артиста, песню(и), дату выступления, событие и тип съёмки, а также определяет, является ли клип fancam.
- **Несколько песен на видео** — видео может ссылаться на несколько песен (например, попурри `Bubble + ASAP`); песни хранятся в junction-таблице `video_songs` — единственном источнике истины.
- **Кураторский словарь** — канонические группы, артисты, песни и события с алиасами, составами групп и связями песня↔артист/группа.
- **Очередь ревью** — разборы с низкой уверенностью помечаются для ручной проверки и редактирования.
- **Теги** — автоматические теги (shorts, длинное, приватное) плюс ручные.
- **Опциональный разбор через LLM** — для сложных названий можно использовать локальную OpenAI-совместимую модель (LM Studio).
- **Аудит и обучающие данные** — каждое изменение логируется; подтверждённые метаданные сохраняются как обучающие данные.

---

## Архитектура

VidPulse — это монорепозиторий со слоистым бэкендом и React-фронтендом.

```
┌─────────────┐     REST/JSON      ┌──────────────────────────────┐
│   Фронтенд  │ ◀────────────────▶ │            Бэкенд            │
│ React + AntD│                    │  routes → services → repos   │
│   (Vite)    │                    │        ↓                     │
└─────────────┘                    │   Knex / better-sqlite3      │
                                   │        ↓                     │
                                   │    SQLite + YouTube API      │
                                   └──────────────────────────────┘
```

- **Routes** (`apps/server/src/routes`) — тонкие HTTP-контроллеры.
- **Services** (`apps/server/src/services`) — бизнес-логика (парсер, словарь, синк, теги, YouTube, AI).
- **Repositories** (`packages/db/src/repositories.ts`) живут в workspace-пакете `@vidpulse/db` и закрывают доступ к данным.
- Runtime-конфигурация централизована в `apps/server/src/config.ts`; общие DB/source-модули вынесены в workspace-пакеты.

---

## Технологии

| Слой        | Технология                                                      |
| ----------- | --------------------------------------------------------------- |
| Бэкенд      | Node.js, TypeScript, Express 5                                  |
| База данных | SQLite через `better-sqlite3` + Knex (query builder и миграции) |
| Фронтенд    | React 18, Ant Design 5, React Router 6, Vite                    |
| Тесты       | Vitest (unit/интеграционные), Playwright (E2E)                  |
| Инструменты | Prettier, Husky + lint-staged, ts-node / tsx, nodemon           |

---

## Требования

- **Node.js 18+** и npm
- **Ключ YouTube Data API** (для синхронизации реальных видео)
- _(Опционально)_ **LM Studio** или другой локальный OpenAI-совместимый эндпоинт для разбора через LLM

---

## Быстрый старт

```bash
# 1. Клонировать и перейти в репозиторий
git clone <repo-url> VidPulse && cd VidPulse

# 2. Настроить окружение
cp .env.example .env
#   затем отредактируйте .env и задайте YOUTUBE_API_KEY

# 3. Установка «в один шаг»: ставит зависимости workspaces, применяет миграции, запускает BE+FE
npm run dev:all
```

`dev:all` — самый быстрый путь. Чтобы выполнить шаги вручную:

```bash
npm install                                                            # установить зависимости всех workspaces
npm run build -w @vidpulse/db && npm run build -w @vidpulse/kpop-sources
npm run migrate                                                        # применить DB-миграции
npm run launch                                                         # бэкенд + фронтенд вместе
```

- Бэкенд работает на **http://localhost:3000** (`PORT`)
- Dev-сервер фронтенда — на **http://localhost:5173** (Vite)

---

## Переменные окружения

Задаются в `.env` (см. `.env.example`):

| Переменная              | Описание                                               | По умолчанию                                |
| ----------------------- | ------------------------------------------------------ | ------------------------------------------- |
| `PORT`                  | HTTP-порт бэкенда                                      | `3000`                                      |
| `YOUTUBE_API_KEY`       | Ключ YouTube Data API                                  | —                                           |
| `LOG_YOUTUBE_API_CALLS` | Логировать каждый вызов YouTube API                    | `false`                                     |
| `SYNC_CRON_TIME`        | Cron-выражение для планировщика синхронизации          | `0 3 * * *`                                 |
| `HIDE_FLAGGED_VIDEOS`   | Скрывать помеченные видео в списках                    | `false`                                     |
| `LM_STUDIO_API_URL`     | Локальный OpenAI-совместимый эндпоинт chat-completions | `http://localhost:1234/v1/chat/completions` |
| `LM_STUDIO_MODEL`       | Имя запрашиваемой модели                               | `local-model`                               |
| `LM_STUDIO_API_KEY`     | Ключ для локального эндпоинта (часто пустой)           | —                                           |
| `LM_STUDIO_TIMEOUT`     | Таймаут запроса к LLM (мс)                             | `30000`                                     |

---

## NPM-скрипты

**Корень:**

| Скрипт                 | Описание                                         |
| ---------------------- | ------------------------------------------------ |
| `npm run dev`          | Только бэкенд (nodemon + ts-node)                |
| `npm run launch`       | Бэкенд + фронтенд одновременно                   |
| `npm run dev:all`      | Установка + миграции + запуск (полный bootstrap) |
| `npm run build`        | Сборка DB/source-пакетов, бэкенда и фронтенда    |
| `npm start`            | Запуск скомпилированного бэкенда                 |
| `npm test`             | Запуск unit/интеграционных тестов Vitest         |
| `npm run test:e2e`     | Запуск E2E-тестов Playwright                     |
| `npm run format`       | Форматирование Prettier                          |
| `npm run format:check` | Проверка форматирования                          |
| `npm run backfill:*`   | Разовые скрипты backfill/обслуживания данных     |

**Frontend workspace (`npm run <script> -w apps/web`):**

| Скрипт            | Описание                           |
| ----------------- | ---------------------------------- |
| `npm run dev`     | Dev-сервер Vite                    |
| `npm run build`   | Проверка типов + production-сборка |
| `npm run preview` | Просмотр production-сборки         |

---

## Структура проекта

```
VidPulse/
├── apps/
│   ├── server/              # Бэкенд (Express + TypeScript)
│   │   ├── src/
│   │   │   ├── routes/      # Express-контроллеры (videos, channels, playlists, dictionary, parser, …)
│   │   │   ├── services/    # Бизнес-логика (parser, sync, dictionary, youtube, ai, files, tags)
│   │   │   ├── middleware/  # Express middleware
│   │   │   ├── scripts/     # Скрипты backfill / обслуживания
│   │   │   └── index.ts     # App factory + точка входа сервера
│   │   ├── schemas/         # JSON-схемы для валидации requests/media-library
│   │   └── tests/e2e/       # E2E-тесты Playwright и page objects
│   └── web/                 # Фронтенд (React + Vite)
│       └── src/
│           ├── pages/       # Экраны уровня маршрутов
│           ├── components/  # Переиспользуемый UI (VideoTable, VideoCard, ReviewQueue, drawers, …)
│           ├── api/         # Слой API-клиента
│           ├── hooks/ utils/
├── packages/
│   ├── db/                  # @vidpulse/db: Knex config, connection, migrations, seeds, repositories
│   ├── kpop-sources/        # @vidpulse/kpop-sources: Wikidata/MusicBrainz → media-library snapshot
│   └── shared/              # @vidpulse/shared: общие API/domain contracts
├── docs/                    # ADR, заметки по API, аудиты, task-файлы
└── CLAUDE.md                # Соглашения и рабочий процесс для контрибьюторов
```

---

## Модель данных

> Полное описание колонок, ключей и ER-диаграмму см. в **[Сущности и связи](./entities.ru.md)**.

Основные сущности (заданы в `packages/db/migrations/`):

- **`videos`** — загруженные видео с денормализованными полями метаданных и FK на `channels`, `playlists`, `video_lists`, `duplicate_groups`.
- **`channels`, `playlists`** — источники YouTube.
- **Словарь:** `dictionary_groups`, `dictionary_artists`, `dictionary_songs`, `dictionary_events`, а также `dictionary_aliases` для альтернативных написаний.
- **Связи многие-ко-многим:**
  - `video_songs` — видео ↔ песни (**единственный источник истины для песен видео**)
  - `video_tags` — видео ↔ теги
  - `dictionary_song_artists`, `dictionary_song_groups` — песни ↔ артисты/группы
  - `dictionary_artist_memberships` — артисты ↔ группы
- **Вспомогательные:** `status_history`, `training_data`, `event_log`, `tags`, `video_lists`.

> **Примечание:** `videos.song_id` / `videos.song_title` — устаревшие денормализованные колонки, оставленные для обратной совместимости; авторитетный набор песен видео хранится в `video_songs`.

---

## REST API

Все эндпоинты смонтированы под `/api`:

| Базовый путь       | Назначение                                                           |
| ------------------ | -------------------------------------------------------------------- |
| `/api/channels`    | Управление и загрузка YouTube-каналов                                |
| `/api/playlists`   | Управление и загрузка YouTube-плейлистов                             |
| `/api/videos`      | Список/получение/обновление видео, метаданных, тегов, reparse/resync |
| `/api/dictionary`  | Группы, артисты, песни, события, алиасы, медиабиблиотека             |
| `/api/parser`      | Эндпоинты reparse / LLM-parse                                        |
| `/api/sync`        | Запуск/управление синхронизациями                                    |
| `/api/events`      | Журнал аудита                                                        |
| `/api/settings`    | Настройки приложения                                                 |
| `/api/video-lists` | Пользовательские подборки видео                                      |

---

## Тестирование

```bash
npm test          # Vitest (unit/интеграционные)
npm run test:e2e  # Playwright (E2E; поднимает бэкенд с замоканным YouTube API)
```

Unit-тесты лежат рядом с backend-кодом (`apps/server/src/**/*.test.ts`). Тесты, работающие с БД, используют изолированную SQLite test database, которую готовит Vitest global setup. E2E-тесты и page objects находятся в `apps/server/tests/e2e/`.

---

## Соглашения

Полное руководство для контрибьюторов — в [`CLAUDE.md`](../CLAUDE.md). Кратко:

- Работайте в feature-ветках; не коммитьте напрямую в основную ветку.
- **Коммиты** в формате Conventional Commits: `<type>(<scope>): <subject>` (`feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`).
- Держите **роуты тонкими**, а логику — в **сервисах**.
- Изменения схемы создавайте через `npx knex migrate:make <name> --knexfile packages/db/src/knexfile.ts` и применяйте через `npm run migrate` или `npx knex migrate:latest --knexfile packages/db/src/knexfile.ts`.
- Перед коммитом запускайте `npm run format` (Husky pre-commit hook также форматирует staged-файлы).
