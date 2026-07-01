# Test plan — покрытие всего функционала VidPulse

Описание тестов на весь функционал приложения: бэкенд (routes → services), парсер, синхронизация,
словарь (Media Library), теги, файлы, списки видео, внешние источники K-pop, а также фронтенд-флоу
(e2e). Для каждой области — набор кейсов с типом теста и статусом покрытия.

## Как читать

- **Тип:** `unit` (чистая логика, замоканная БД), `int` (интеграция: реальный мигрированный
  SQLite `dev.test.sqlite3`), `e2e` (Playwright, UI+API).
- **Статус:** ✅ есть тест · ⚠️ частично / замокано · ❌ пробел (теста нет).
- ID кейса — префикс области + номер. Существующие спеки указаны в колонке «Файл».
- Формат описания кейса: что проверяем → ожидание. Для e2e — **Предусловие → Шаги → Ожидание**.

## Инфраструктура тестов (как в текущем suite)

- **Vitest:** `apps/server/vitest.config.ts` — паттерн `src/**/*.{test,spec}.ts`, `NODE_ENV=test`,
  `fileParallelism: false` (один писатель в общий SQLite, иначе `SQLITE_BUSY`). Глобальный сетап
  `tests/vitest.global-setup.ts` готовит тестовую БД (миграции).
- **Playwright:** `apps/server/playwright.config.ts` — `tests/e2e/**/*.{e2e,spec}.ts`, backend :3000,
  frontend :5173, YouTube API замокан (`tests/e2e/setup/youtube-mock.cjs`, фикстуры в `fixtures/`).
  Хелперы: `helpers/db.ts` (`resetDatabase`, `e2eDb`), page objects в `tests/e2e/pages/`.
- **Пакеты:** `packages/kpop-sources` имеет собственные vitest-тесты (Wikidata/MusicBrainz).
- Media Library drawer покрыт отдельным набором кейсов:
  [`apps/server/tests/e2e/media-library-drawer.cases.md`](../apps/server/tests/e2e/media-library-drawer.cases.md).

## Сводка текущего покрытия

| Слой                        | Покрыто                                         | Пробелы (главное)                       |
| --------------------------- | ----------------------------------------------- | --------------------------------------- |
| Parser (`services/parser/`) | ✅ хорошо (regex, dict, resolver, songs, split) | сегментация (3 skipped)                 |
| Dictionary import/export    | ⚠️ import/merge, dedup, schema                  | export, clear, replace-логика           |
| Dictionary routes (CRUD)    | ⚠️ замокано (`dictionary.routes.test.ts`)       | реальная БД, aliases-эджи               |
| Tags                        | ⚠️ unit (mock), 3 batch-роута                   | реальные изменения тегов                |
| Video routes                | ⚠️ pagination + 3 batch                         | detail/metadata/tags/большинство batch  |
| Video service               | ❌                                              | почти всё (CRUD, статусы, suggest)      |
| Sync / Channel / Playlist   | ❌ (кроме e2e channel add)                      | ingest, dedup, load-more, playlist sync |
| Files                       | ✅ service (int)                                | routes, unlink, delete                  |
| Video lists                 | ✅ service + filter (int)                       | routes, batch-операции, лимит           |
| YouTube / AI service        | ❌                                              | клиент, кэш, ошибки/квота, LLM          |
| Settings / Events / Health  | ❌                                              | все роуты                               |
| Template engine             | ✅                                              | —                                       |
| kpop-sources пакет          | ✅ (build, MB, normalize)                       | —                                       |
| Frontend (apps/web)         | ❌ компонентных нет; e2e — 3 флоу               | большинство UI-флоу                     |

---

# 1. Parser (услуги разбора заголовков)

`apps/server/src/services/parser/` — извлечение метаданных из YouTube-заголовка и резолв в
канонические сущности словаря. Ядро логики, покрывать тщательно.

| ID     | Что проверяем                                                                                 | Тип  | Статус | Файл                                                     |
| ------ | --------------------------------------------------------------------------------------------- | ---- | ------ | -------------------------------------------------------- |
| PAR-01 | Regex: дата в форматах `YYMMDD`, `YY.M.D`, `YYYYMMDD` → нормализованный `perf_date`           | unit | ✅     | `parser/regex.module.test.ts`                            |
| PAR-02 | Regex: `camera_type` (직캠/4K/FANCAM/페이스캠)                                                | unit | ⚠️     | там же (есть известные фейлы)                            |
| PAR-03 | Regex: `event` из префикса/сегмента (`@MCOUNTDOWN`, `@SBS INKIGAYO`)                          | unit | ⚠️     | `parser.service.test.ts`                                 |
| PAR-04 | Regex: fancam-детект (`is_fancam` + `fancam_confidence`)                                      | unit | ✅     | `regex.module.test.ts`                                   |
| PAR-05 | Dictionary module: fuzzy-резолв group/artist/song/event (Levenshtein + normalize)             | unit | ✅     | `parser/dictionary.module.test.ts`                       |
| PAR-06 | `resolveGroupOnlyCredit`: «артист» на деле группа → промоут в `group_name`                    | unit | ✅     | `dictionary.module.test.ts`                              |
| PAR-07 | Резолв через алиасы (exact → alias → null) + сохранение raw-имени как evidence                | unit | ✅     | `metadataResolver.service.test.ts`                       |
| PAR-08 | `hasUnresolvedEntity` → выставляет `needsReview`                                              | unit | ⚠️     | `metadataResolver.service.test.ts`                       |
| PAR-09 | Split нескольких песен (`A, B`, `A + B`, пайпы) + дедуп case-insensitive                      | unit | ✅     | `songTitles.util.test.ts`                                |
| PAR-10 | `syncVideoSongs`: полная замена набора в `video_songs`, порядок `position`, resolve `song_id` | int  | ✅     | `videoSongs.service.test.ts`                             |
| PAR-11 | Ownership: `is_own_group_song` / `is_own_artist_song`                                         | unit | ✅     | `parser.service.test.ts`                                 |
| PAR-12 | Полный pipeline: заголовок → `{metadata, needsReview, trace}` + confidence-скоринг            | int  | ✅     | `parser.service.test.ts`                                 |
| PAR-13 | Fallback по YouTube-тегам, когда group/artist пусты                                           | unit | ⚠️     | добавить                                                 |
| PAR-14 | Fallback по description (последняя инстанция)                                                 | unit | ❌     | добавить                                                 |
| PAR-15 | Сегментированные заголовки `[channel] group artist \| song \| SHOW`                           | unit | ⚠️     | `parser.service.segmented.test.ts` (3 skipped → TASK-16) |
| PAR-16 | MPD-split парсинг                                                                             | unit | ✅     | `parser.service.mpd-split.test.ts`                       |

---

# 2. Parser API (`/api/parser`) + wrapper `parser.service.ts`

| ID     | Что проверяем                                                                                  | Тип | Статус |
| ------ | ---------------------------------------------------------------------------------------------- | --- | ------ |
| PRR-01 | `POST /reparse/:id` — свежий fetch YouTube, разбор, апдейт, `reparseLog{input,output}`         | int | ❌     |
| PRR-02 | `POST /reparse-batch` — массовый reparse, ошибки на элемент не рушат батч                      | int | ❌     |
| PRR-03 | `POST /reparse-all?status=new` — reparse всех в статусе                                        | int | ❌     |
| PRR-04 | `POST /llm-parse/:id` — LLM-разбор (AI замокан), апдейт + sync songs                           | int | ❌     |
| PRR-05 | `POST /llm-parse-batch` — батч LLM, `{updated}`                                                | int | ❌     |
| PRR-06 | Побочки reparse: запись `status_history` при смене статуса; `training_data` при ручном апдейте | int | ❌     |

---

# 3. Videos API (`/api/videos`) + `video.service.ts`

| ID     | Что проверяем                                                                                     | Тип | Статус                                                  |
| ------ | ------------------------------------------------------------------------------------------------- | --- | ------------------------------------------------------- |
| VID-01 | `GET /` — пагинация + фильтры (status, channel_id, playlist_id, video_list_id, includeIgnored)    | int | ⚠️ (`video.routes.pagination.test.ts`)                  |
| VID-02 | `GET /` — display-имена через `videos_display` (COALESCE canonical/raw)                           | int | ✅ (`db/videos-display-view.test.ts`)                   |
| VID-03 | `GET /:id` — видео с тегами и песнями                                                             | int | ❌                                                      |
| VID-04 | `POST /:id/add` (add by URL) — валидация YouTube, дубликаты, статус `needs_review`, авто-теги     | int | ❌                                                      |
| VID-05 | `PUT /:id/metadata` — апдейт полей; **только** в статусах new/needs_review/pending                | int | ❌                                                      |
| VID-06 | `PUT /:id/metadata` — переход `needs_review → new`, sync songs, запись training_data              | int | ❌                                                      |
| VID-07 | `POST /:id/suggest` — LLM-подсказка (AI замокан)                                                  | int | ❌                                                      |
| VID-08 | `POST /:id/resync` — refetch + reparse                                                            | int | ❌                                                      |
| VID-09 | `GET/POST/DELETE /:id/tags` — получить/добавить (создать тег при отсутствии)/удалить              | int | ❌                                                      |
| VID-10 | `POST /batch/confirm-download` → статус `downloaded`, отчёт `{processed,succeeded,failed,errors}` | int | ⚠️ (e2e `channel.e2e.ts`)                               |
| VID-11 | `POST /batch/complete` → `completed`                                                              | int | ❌                                                      |
| VID-12 | `POST /batch/ignore` и `POST /:id/ignore` → `ignored`                                             | int | ❌                                                      |
| VID-13 | `POST /batch/tag-shorts-by-duration` — gating dangerous-actions                                   | int | ✅ (`video.routes.tag-shorts.test.ts`)                  |
| VID-14 | `POST /batch/tag-long-videos-by-duration` — gating                                                | int | ✅ (`video.routes.tag-long-videos.test.ts`)             |
| VID-15 | `POST /batch/merge-short-tags` — gating                                                           | int | ✅ (`video.routes.merge-short-tags.test.ts`)            |
| VID-16 | `POST /batch/file-command` — рендер команды по шаблону для набора                                 | int | ❌                                                      |
| VID-17 | `POST /batch/rename` — генерация `mv`-команд по шаблону                                           | int | ❌                                                      |
| VID-18 | Валидация тел/параметров (400 на кривой ввод) для ключевых роутов                                 | int | ⚠️ (`middleware/validate.test.ts` покрывает middleware) |

---

# 4. Dictionary API (`/api/dictionary`) + dictionary services

CRUD групп/артистов/песен/событий/алиасов + импорт/экспорт/статистика.

| ID     | Что проверяем                                                                            | Тип                                                        | Статус                                        |
| ------ | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------- | --- | --- |
| DIC-01 | Groups CRUD: create/update/delete/get + фильтры (type, q) + пагинация                    | int                                                        | ⚠️ (замокано в `dictionary.routes.test.ts`)   |
| DIC-02 | Artists CRUD (scoped to group) + фильтры (group_id, q)                                   | int                                                        | ⚠️                                            |
| DIC-03 | Songs CRUD + связи artist_ids/group_ids                                                  | int                                                        | ⚠️                                            |
| DIC-04 | Events CRUD                                                                              | int                                                        | ⚠️                                            |
| DIC-05 | Aliases: add (без дублей), list, delete для group/artist/song/event                      | int                                                        | ⚠️                                            |
| DIC-06 | `GET /groups/:id/artists                                                                 | songs                                                      | videos` — связанные сущности с пагинацией     | int | ❌  |
| DIC-07 | `GET /artists/:id/songs                                                                  | videos`, `GET /songs/:id/videos`, `GET /events/:id/videos` | int                                           | ❌  |
| DIC-08 | Каскады при delete: обнуление FK в `videos`, чистка memberships/song_links/aliases       | int                                                        | ❌                                            |
| DIC-09 | `group.service.getGroupSongs` через `dictionary_song_groups`                             | int                                                        | ✅ (`dictionary/group.service.songs.test.ts`) |
| DIC-10 | `GET /stats` — агрегаты (counts)                                                         | int                                                        | ❌                                            |
| DIC-11 | Поиск/резолв по имени и алиасу (`findGroup/Artist/Song ByNameOrAlias`, case-insensitive) | int                                                        | ⚠️                                            |

## 4.1 Import / Export / Clear (Media Library)

| ID     | Что проверяем                                                                                | Тип  | Статус                                                     |
| ------ | -------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------- |
| MLI-01 | Схема импорта: валидация payload + бизнес-правила                                            | unit | ✅ (`mediaLibrarySchema.service.test.ts`)                  |
| MLI-02 | `importMediaLibrary` mode=merge: вставка/мерж дерева, sync artists/groups песни              | int  | ✅ (`dictionary.service.import-media-library.test.ts`)     |
| MLI-03 | Дедупликация артистов per-group при импорте                                                  | int  | ✅ (`dictionary/media-library.import-dedup.test.ts`)       |
| MLI-04 | Импорт алиасов                                                                               | int  | ⚠️ (`dictionary.service.import-aliases.test.ts`, неполный) |
| MLI-05 | mode=replace — только при `MEDIA_LIBRARY_DANGEROUS_ACTIONS_ENABLED=true`, иначе 403          | int  | ❌                                                         |
| MLI-06 | Async-импорт: `POST /import` → `{jobId}` → прогресс `/import/:jobId/progress` → `/result`    | int  | ❌                                                         |
| MLI-07 | `GET /export` — полный дамп groups/soloArtists/events; round-trip export→import идемпотентен | int  | ❌                                                         |
| MLI-08 | `DELETE /clear` — gating + отчёт `ClearMediaLibrarySummary` + обнуление FK видео             | int  | ❌                                                         |
| MLI-09 | `GET /schema` и `GET /example` — отдаются валидные JSON                                      | int  | ❌                                                         |

---

# 5. K-pop dictionary refresh (`/api/kpop-dictionary`) + внешние источники

| ID     | Что проверяем                                                                              | Тип  | Статус                                   |
| ------ | ------------------------------------------------------------------------------------------ | ---- | ---------------------------------------- |
| KPD-01 | `refresh(merge)` — импорт снапшота (source замокан), запись event_log + settings timestamp | int  | ✅ (`kpopDictionary.service.test.ts`)    |
| KPD-02 | `refresh(replace)` без dangerous-actions → reject `/disabled/i`                            | int  | ✅ (там же)                              |
| KPD-03 | `POST /refresh` роут — проксирует mode, возвращает summary                                 | int  | ❌                                       |
| KPD-04 | MusicBrainz-чанкинг: приоритет по стейловому `songs_enriched_at`, штамповка обработанных   | int  | ❌                                       |
| KPS-01 | Пакет: build library из Wikidata (SPARQL застабан)                                         | unit | ✅ (`kpop-sources/buildLibrary.test.ts`) |
| KPS-02 | Пакет: MusicBrainz клиент/нормализация/пагинация                                           | unit | ✅ (`musicbrainz/musicbrainz.test.ts`)   |
| KPS-03 | Пакет: нормализация Wikidata (дедуп, языки)                                                | unit | ✅ (`wikidata/normalize.test.ts`)        |

---

# 6. Sync / Channels / Playlists

Главная фича продукта — почти без юнит/инт покрытия (только e2e channel add).

| ID     | Что проверяем                                                                                        | Тип                             | Статус                                     |
| ------ | ---------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------ | --- |
| SYN-01 | `syncAll()` вызывает channelSync + playlistSync                                                      | int                             | ❌                                         |
| SYN-02 | ChannelSync: пропуск канала, если `<1ч` с `last_checked_at`; fetch publishedAfter; апдейт таймстампа | int                             | ❌                                         |
| SYN-03 | PlaylistSync: fetch новых, персист `next_page_token`                                                 | int                             | ❌                                         |
| SYN-04 | `ingestVideo`: дедуп по youtube_id (skip, но линк к новому каналу/плейлисту)                         | int                             | ❌                                         |
| SYN-05 | `ingestVideo`: fetch details → parse → resolve → insert → sync songs → auto-tag                      | int                             | ❌                                         |
| SYN-06 | `POST /api/sync/trigger` — запуск, `sync_completed` в event_log                                      | int                             | ❌                                         |
| CHN-01 | `POST /api/channels` add by URL (@user/channel/ID), дубликат → отказ, ingest 30 дней                 | int                             | ❌                                         |
| CHN-02 | `POST /api/channels/import` — .txt, `{total,added,skipped,errors}`, `#`-комменты                     | int                             | ❌                                         |
| CHN-03 | `GET /api/channels` пагинация; `GET /:id` детали; `POST /:id/load-more` старые видео                 | int                             | ❌                                         |
| CHN-04 | `DELETE /:id?removeVideos=true                                                                       | false` — отвязка/удаление видео | int                                        | ❌  |
| PLS-01 | `POST /api/playlists` add by URL, ingest 50, персист курсора                                         | int                             | ❌                                         |
| PLS-02 | `POST /:id/sync`, `POST /:id/load-more` (курсор), `DELETE /:id?removeVideos`                         | int                             | ❌                                         |
| SYE-01 | **e2e:** добавить канал → синк → видео появились, авто-теги shorts/long                              | e2e                             | ✅ (`auto-tags.spec.ts`, `channel.e2e.ts`) |
| SYE-02 | **e2e:** ручной ревью метаданных `needs_review → new`; батч confirm-download                         | e2e                             | ✅ (`channel.e2e.ts`)                      |

---

# 7. Tags (`tag.service.ts`)

| ID     | Что проверяем                                                                                    | Тип  | Статус                           |
| ------ | ------------------------------------------------------------------------------------------------ | ---- | -------------------------------- |
| TAG-01 | `assignAutoTags`: `<90s`→shorts, `>20мин`→«длинное видео», private→private                       | unit | ✅ (`tag.service.test.ts`, mock) |
| TAG-02 | `tagShortsByDuration` — реальные изменения тегов на мигрированной БД `{checked,eligible,tagged}` | int  | ❌                               |
| TAG-03 | `tagLongVideosByDuration` — реальные изменения                                                   | int  | ❌                               |
| TAG-04 | `mergeShortTags` — миграция legacy `short` → `shorts` (без дублей)                               | int  | ❌                               |

---

# 8. Files (`/api/files` + `file.service.ts`)

| ID     | Что проверяем                                                                       | Тип    | Статус                      |
| ------ | ----------------------------------------------------------------------------------- | ------ | --------------------------- | --- |
| FIL-01 | Извлечение YouTube ID из имени (первые 11 символов), upsert, авто-линк по ID        | int    | ✅ (`file.service.test.ts`) |
| FIL-02 | `POST /scan` — скан `FILES_INPUT_DIR`, фильтр расширений, `{scanned,linked,errors}` | int    | ❌                          |
| FIL-03 | `GET /` — пагинация + фильтр по videoId; `GET /:id` с видео                         | int    | ❌                          |
| FIL-04 | `PUT /:id/link` — ручной линк/анлинк (`videoId                                      | null`) | int                         | ❌  |
| FIL-05 | `DELETE /:id` — удаление записи (не файла на диске)                                 | int    | ❌                          |

---

# 9. Video lists (`/api/video-lists` + `video-list.service.ts`)

| ID     | Что проверяем                                                         | Тип | Статус                            |
| ------ | --------------------------------------------------------------------- | --- | --------------------------------- |
| VLS-01 | Семантика статусов списка (гомогенность primary-статуса)              | int | ✅ (`video-list.service.test.ts`) |
| VLS-02 | Фильтрация видео по `video_list_id`                                   | int | ✅ (`video-list-filter.test.ts`)  |
| VLS-03 | `create` — авто-цвет, лимит `MAX_VIDEO_LIST_ITEMS` (default 100)      | int | ⚠️                                |
| VLS-04 | `addVideos` — проверка размера + однородности статуса; `removeVideos` | int | ⚠️                                |
| VLS-05 | `POST /:id/batch` — confirmDownload/complete/ignore/addTag/removeTag  | int | ❌                                |
| VLS-06 | `PATCH /:id` rename, `DELETE /:id` (детач видео), `recomputeStatus`   | int | ❌                                |

---

# 10. Прочие роуты и cross-cutting

| ID     | Что проверяем                                                             | Тип                            | Статус                                 |
| ------ | ------------------------------------------------------------------------- | ------------------------------ | -------------------------------------- | --------------------------------------- |
| SET-01 | `GET/PUT /api/settings` — чтение всех + upsert key/value                  | int                            | ❌                                     |
| EVT-01 | `GET /api/events` — пагинация + фильтр `event_type`                       | int                            | ❌                                     |
| EVL-01 | `eventLog.logEvent` — неблокирующая запись, ошибка не рушит вызывающего   | unit                           | ❌                                     |
| HLT-01 | `GET /api/health` (+ `/health/youtube`)                                   | int                            | ⚠️ (`bootstrap.test.ts` — 404/health)  |
| MW-01  | `validateBody/Params/Query` (AJV) → 400 с деталями                        | unit                           | ✅ (`middleware/validate.test.ts`)     |
| MW-02  | `errorHandler` (AppError → status/code; прочее → 500) + `notFoundHandler` | unit                           | ✅ (`middleware/errorHandler.test.ts`) |
| MW-03  | `requireDangerousActionsEnabled` — 403 при выключенном флаге              | unit                           | ⚠️ (косвенно через batch-роуты)        |
| TPL-01 | Template engine: `{{entity.param}}`, `{{...                               | sep}}`, `{{each}}...{{/each}}` | unit                                   | ✅ (`template/template.engine.test.ts`) |
| APP-01 | App factory + 404 + health                                                | int                            | ✅ (`bootstrap.test.ts`)               |
| PAG-01 | Клэмпинг пагинации (page/limit, эджи)                                     | unit                           | ✅ (`routes/pagination.test.ts`)       |

---

# 11. Frontend e2e (Playwright)

Сейчас 3 флоу; ниже — целевое покрытие ключевых UI-сценариев. Раздел Media Library вынесен в
отдельный файл кейсов (см. `media-library-drawer.cases.md`, кейсы MLD-01…MLD-60).

| ID     | Сценарий (Предусловие → Шаги → Ожидание)                                                              | Статус                                                                               |
| ------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| E2E-01 | Videos: фильтр по статусу/списку, `Show Ignored`, пагинация → таблица обновляется                     | ❌                                                                                   |
| E2E-02 | Videos: клик по строке → VideoCard drawer; правка метаданных (Edit → Save) → апдейт                   | ❌                                                                                   |
| E2E-03 | Videos: bulk — выбрать строки → Add Tag / Remove Tag / Add to List / Reparse → отчёт                  | ⚠️ (частично `channel.e2e.ts`)                                                       |
| E2E-04 | VideoCard: теги (preset Shorts/Private + кастомный с автокомплитом), Ignore/Resync/Reparse            | ❌                                                                                   |
| E2E-05 | Review Queue: инлайн-правка батча → `Save all & move to new`; per-video Suggest with AI (mock)        | ✅ (`channel.e2e.ts` частично)                                                       |
| E2E-06 | Sources → Channels: Add Channel по URL, Import from File (.txt), Delete (removeVideos)                | ⚠️                                                                                   |
| E2E-07 | Sources → Playlists: Add Playlist, Sync, Delete; Add Video (одиночный)                                | ❌                                                                                   |
| E2E-08 | Channel/Playlist detail: Load More, выбор строк → Add to List / Re-parse                              | ❌                                                                                   |
| E2E-09 | Video Lists: создать список, открыть детали, VideoListOperations (Confirm/Complete/Ignore/Tag/Remove) | ❌                                                                                   |
| E2E-10 | Files: Scan Files → таблица; Delete записи; клик по video-линку → VideoCard                           | ❌                                                                                   |
| E2E-11 | Activity Log: фильтр по типу события, пагинация                                                       | ❌                                                                                   |
| E2E-12 | Settings: чекбоксы типов групп → сохранение (влияет на видимость словаря)                             | ❌                                                                                   |
| E2E-13 | Dictionary Tools: импорт JSON (summary), скачивание schema/example/export                             | ⚠️ (`dictionary-navigation.e2e.ts` — но под старый URL, требует переписи под drawer) |
| E2E-14 | Media Library drawer — полный набор                                                                   | см. `media-library-drawer.cases.md` (MLD-01…60)                                      |

> ⚠️ `dictionary-navigation.e2e.ts` написан под старый маршрут `/dictionary/*` (page.goto + toHaveURL).
> После переноса раздела в drawer его нужно переписать на drawer-семантику (кейсы MLD-\*).

---

# 12. Слабые места / приоритеты

**Высокий приоритет (главная функциональность без покрытия):**

1. Sync/ingest (SYN-01…06, CHN-01…04, PLS-01…02) — ядро продукта, есть только e2e-порез.
2. Video service/routes CRUD и статусные переходы (VID-03…09), reparse-роуты (PRR-01…06).
3. Media Library import async / export / clear / replace-gating (MLI-05…09).

**Средний приоритет:** 4. Dictionary CRUD на реальной БД + каскады delete (DIC-06…08) — сейчас замокано. 5. Tags реальные изменения (TAG-02…04), Video lists batch (VLS-05…06). 6. Files routes (FIL-02…05), Settings/Events (SET-01, EVT-01).

**Низкий приоритет / долг:** 7. Parser сегментация (PAR-15, 3 skipped → TASK-16), fallback по тегам/описанию (PAR-13…14). 8. YouTube/AI сервисы (клиент, кэш, обработка квоты/ошибок) — сложно тестировать без моков сети. 9. Frontend e2e расширение (E2E-01…13) и компонентные тесты apps/web (сейчас 0).

**Cross-cutting долг (по областям):** пути ошибок (валидация, FK-нарушения, таймауты YouTube),
транзакционные откаты (import/sync), поиск/фильтрация по всем сущностям, большие выборки.

---

_Ссылки: функциональная карта — по коду `apps/server/src/` и `apps/web/src/`; известные фейлы —
[`docs/code-review.md`](code-review.md) (раздел Tests) и `docs/tasks/task-15-fix-tests.md`._
