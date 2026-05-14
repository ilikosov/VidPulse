# Entity Unification Audit (groups/artists)

## Роль и рамки анализа

- Использована роль: **Analyst** (по инструкции AGENTS).
- Анализ выполнен только по текущему репозиторию (migrations + backend/frontend/tests), без изменения бизнес-логики.

## 1) Миграции, где создаются/затрагиваются целевые таблицы

| Таблица              | Миграция                                              | Что происходит                                                                             |
| -------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `videos`             | `migrations/20260423161338_create_tables.ts`          | Создание таблицы `videos` + индексы по `group_name`, `artist_name`, `song_title`, `event`. |
| `dictionary_groups`  | `migrations/20260504110000_dictionary_db.ts`          | Создание и сидирование словаря групп.                                                      |
| `dictionary_artists` | `migrations/20260504110000_dictionary_db.ts`          | Создание и сидирование словаря артистов (`group_id` -> `dictionary_groups.id`).            |
| `dictionary_songs`   | `migrations/20260504110000_dictionary_db.ts`          | Создание словаря песен.                                                                    |
| `dictionary_events`  | `migrations/20260504110000_dictionary_db.ts`          | Создание и сидирование словаря событий.                                                    |
| `dictionary_aliases` | `migrations/20260505120000_add_dictionary_aliases.ts` | Создание таблицы алиасов сущностей.                                                        |
| `groups`             | —                                                     | **Не создаётся** ни в одной миграции.                                                      |
| `artists`            | —                                                     | **Не создаётся** ни в одной миграции.                                                      |

### Дополнительно по `videos`

Структура `videos` расширяется отдельными миграциями:

- `migrations/20260503100000_add_video_description.ts` (поле `description`),
- `migrations/20260428123000_add_tags_and_video_duration.ts` (поле `duration_seconds`),
- `migrations/20260512120000_add_fancam_fields_to_videos.ts` (`is_fancam`, `fancam_confidence`, `fancam_reasoning`).

## 2) Где в коде используются целевые сущности и поля

## 2.1 `groups` и `artists` (как API-entity names)

Физических таблиц `groups`/`artists` нет, но entity names активно используются в API/логике словаря:

- `src/routes/dictionary.routes.ts`
  - `TemplateEntity = 'groups' | 'artists' | 'songs' | 'events'`
  - endpoints: `/groups/*`, `/artists/*`.
- `src/services/dictionary.service.ts`
  - ветки импорта/апдейта шаблонов для `kind === 'groups'` / `kind === 'artists'`.
- `src/services/parser/dictionary.module.ts`
  - in-memory dictionary model: `groups: string[]`, `artists: Record<string, string[]>`.

## 2.2 `dictionary_groups` и `dictionary_artists`

Ключевые места использования:

- `src/services/dictionary.service.ts`
  - CRUD, join и пагинация по `dictionary_groups`/`dictionary_artists`;
  - связка с `videos` через text-поля (`videos.group_name`, `videos.artist_name`).
- `src/services/parser/dictionary.module.ts`
  - загрузка справочников и нормализация метаданных по каноническим именам.
- `src/services/dictionary.service.import-aliases.test.ts`
  - тестовые фикстуры содержат `dictionary_groups`, `dictionary_artists`.

## 2.3 Поля `group_name`, `artist_name`, `song_title`, `event`

Эти поля массово используются в нескольких слоях:

1. **Schema / DB**
   - `migrations/20260423161338_create_tables.ts` (определение колонок и композитный индекс `videos_perf_meta_idx`).

2. **Routes (read/write API)**
   - `src/routes/video.routes.ts`
   - `src/routes/parser.routes.ts`
   - `src/routes/channel.routes.ts`
   - `src/routes/playlist.routes.ts`
   - `src/routes/dictionary.routes.ts` (`getVideosByField('group_name'|'artist_name'|'song_title')`)

3. **Services**
   - `src/services/sync/metadata.utils.ts`
   - `src/services/parser/parser.service.ts`
   - `src/services/parser/regex.module.ts`
   - `src/services/parser/dictionary.module.ts`
   - `src/services/ai.service.ts`
   - `src/batch-parse.ts`

4. **Tests / e2e fixtures**
   - `tests/e2e/channel.e2e.ts`
   - `tests/e2e/pages/VideoDetailPage.ts`
   - `tests/e2e/pages/ReviewPage.ts`
   - parser/unit tests в `src/services/parser/*.test.ts`

## 3) Выводы по текущей схеме

## 3.1 Какие таблицы существуют (из запрошенного списка)

Существуют:

- `videos`
- `dictionary_groups`
- `dictionary_artists`
- `dictionary_songs`
- `dictionary_events`
- `dictionary_aliases`

Не существуют:

- `groups`
- `artists`

## 3.2 Какие реально используются

Реально (runtime) используются:

- `videos` — основная рабочая таблица;
- `dictionary_groups`, `dictionary_artists`, `dictionary_songs`, `dictionary_events` — в dictionary service + parser normalization;
- `dictionary_aliases` — поддерживается сервисом словаря/алиасов.

## 3.3 Какие являются дублями

Явных дублей-таблиц `groups`/`artists` в БД нет, но есть **семантическое дублирование**:

- Канонические сущности уже есть в `dictionary_*`.
- В `videos` параллельно хранятся те же сущности строками (`group_name`, `artist_name`, `song_title`, `event`), а не ссылками.

Итог: дублирование не на уровне таблиц-двойников, а на уровне **денормализованных строковых полей в `videos`** относительно справочников `dictionary_*`.

## 3.4 Какие поля `videos` сейчас строковые

В контексте unification на foreign keys сейчас строковые:

- `videos.group_name` (`string`)
- `videos.artist_name` (`string`)
- `videos.song_title` (`string`)
- `videos.event` (`string`)

## 4) Что менять при переходе на foreign keys

Ниже список зон, которые потребуется поменять при миграции к ссылочной модели (например, `group_id`, `artist_id`, `song_id`, `event_id`).

## 4.1 Database / migrations

- Новая миграция для добавления FK-колонок в `videos`.
- Backfill данных: маппинг строковых значений (`*_name`, `song_title`, `event`) на `dictionary_*` IDs.
- Индексы/уникальности: перенос индекса `videos_perf_meta_idx` на FK-поля.
- Переходный период: оставить старые string-колонки временно (read compatibility), затем удалить.

## 4.2 Dictionary service (главный блок)

- `src/services/dictionary.service.ts`
  - `getVideosByField(...)`: сейчас join по `videos.group_name = dg.name`, `videos.artist_name = da.name`, `videos.song_title = ds.title`; нужно переписать на join по FK;
  - CRUD/import paths, где поля словарей сравниваются со строками из `videos`.

## 4.3 Video/Parser/Sync routes and services

- `src/routes/video.routes.ts`
- `src/routes/parser.routes.ts`
- `src/routes/channel.routes.ts`
- `src/routes/playlist.routes.ts`
- `src/services/sync/metadata.utils.ts`
- `src/batch-parse.ts`

Во всех этих местах сейчас формируются/обновляются payloads со строковыми `group_name`, `artist_name`, `song_title`, `event`; при FK-модели нужен слой резолвинга в IDs.

## 4.4 Parser normalization / AI contracts

- `src/services/parser/dictionary.module.ts`
- `src/services/parser/parser.service.ts`
- `src/services/ai.service.ts`

Сейчас контракт parser/AI возвращает текстовые поля. Для FK-перехода:

- либо сохранять текущий контракт и добавлять post-processing (text -> id),
- либо расширять контракт дополнительными `*_id` (с сохранением обратной совместимости API).

## 4.5 Tests and E2E

- E2E страницы/спеки и unit/integration tests, где ассертятся строковые поля:
  - `tests/e2e/channel.e2e.ts`
  - `tests/e2e/pages/VideoDetailPage.ts`
  - `tests/e2e/pages/ReviewPage.ts`
  - parser tests в `src/services/parser/*.test.ts`

Понадобится обновление фикстур, ожиданий API и DB-helper-логики на новый формат.

## Краткое резюме

- `groups`/`artists` как таблицы отсутствуют; фактический canonical source — `dictionary_groups`/`dictionary_artists`.
- Основной technical debt: `videos` хранит identity-поля строками и дублирует словари.
- Наибольший объём изменений для FK-перехода: `dictionary.service.ts`, `video.routes.ts`, parser/sync pipeline и e2e+unit тесты.
