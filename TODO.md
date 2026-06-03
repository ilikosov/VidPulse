# TODO — backlog реализации

Этот файл — очередь задач на **реализацию в коде**, выведенных из проектной документации
(ADR и reference-доков). Документация описывает _что и почему_; здесь — _что сделать_.

**Как пользоваться (для Claude Code):**

- Каждая задача самодостаточна: контекст, ссылки на доки, конкретные шаги, файлы, критерии приёмки.
- Перед началом — прочитать связанные доки из блока **Docs**.
- Статусы чекбоксов: `[ ]` не начато · `[~]` в работе · `[x]` сделано.
- Соблюдать конвенции из [`AGENTS.md`](./AGENTS.md) (feature-ветка, Conventional Commits, тонкие роуты / логика в сервисах, миграции через `knex migrate:make`).
- **Только документация уже зафиксирована — код/схему меняем именно по этим задачам.**

---

## [ ] TASK-1 — Вариант 1: разделение «сырого парсинга» и канонических ссылок (group / artist / event)

**Priority:** high
**Docs:**

- [ADR 0002 — Разделение raw parse vs canonical](./docs/adr/0002-raw-parse-vs-canonical-display.md) (особенно §2 Decision и §4 Implementation plan)
- [ADR 0001 — Canonical dictionary entities](./docs/adr/0001-canonical-dictionary-entities.md)
- [Сущности и связи](./docs/entities.ru.md) → раздел `videos`, заметка «Целевая модель денормализации»

**Why:** сейчас `videos.group_name/artist_name/event` и FK `group_id/artist_id/event_id` — двойной
источник истины (текст перезаписывается каноникой → staleness при переименовании в словаре + потеря
результата парсинга). Цель: текст = только результат парсинга, FK = канон, отображение = производное
`COALESCE(словарь, парсинг)` (приоритет у словаря).

**Steps:**

- [ ] **Резолвер** `src/services/parser/metadataResolver.service.ts` (~строки 106–109): перестать
      перезаписывать `*_name` каноникой — писать сырой парсинг (`groupInput || null`) в `*_name` и
      резолв в `*_id`. Поправить тесты `metadataResolver.service.test.ts`.
- [ ] **Display-слой:** добавить SQL-VIEW `videos_display` (или единый query-хелпер), вычисляющий
      `group_display = COALESCE(dg.name, videos.group_name)` и аналогично для artist/event
      (event — с `@`-нормализацией). Новая миграция через `npx knex migrate:make add_videos_display_view`.
- [ ] **Read-path** `src/services/dictionary.service.ts`: заменить хрупкий `OR`-джойн
      (`ON v.group_id = g.id OR v.group_name = g.name`, ~строка 404) и текст-джойн в `getVideosByField`
      (~строка 596) на джойны строго по FK; перевести чтение/сериализацию видео на `videos_display`/хелпер.
- [ ] **Роуты-потребители:** проверить `src/routes/{video,parser,channel,playlist,dictionary}.routes.ts` —
      отдавать display-поля.
- [ ] **Индекс:** пересмотреть составной `videos_perf_meta_idx` (`perf_date, group_name, artist_name,
song_title, event`) — решить, оставить для текстового поиска или заменить индексами по `*_id`
      (см. ADR 0002 §3 Trade-offs).
- [ ] **Backfill (идемпотентный):** для строк, где текст уже равен канонике, изменений нет; зафиксировать
      поведение как baseline (см. ADR 0002 §4 п.4 и §3 Risks про невосстановимость исходного парсинга).
- [ ] **Фронтенд** (`client/`): читать display-поле вместо сырых `*_name`.

**Files:** `src/services/parser/metadataResolver.service.ts`, `src/services/dictionary.service.ts`,
`src/routes/*.routes.ts`, `migrations/`, `client/src/**`.

**Acceptance:**

- После переименования записи в `dictionary_*` отображение видео меняется **сразу**, а текстовое
  evidence-поле (`*_name`) — нет.
- Нет джойнов по тексту/`OR` в read-path; джойны только по FK.
- `npm test` и `npm run test:e2e` зелёные; добавлен тест на сценарий «rename словаря → display обновился, evidence сохранился».

**Out of scope:** песни (см. TASK-2), удаление legacy-колонок (см. TASK-3).

---

## [ ] TASK-2 — Расширить `video_songs` (raw_title + nullable song_id + position) и перенести резолв песен

**Priority:** medium
**Docs:**

- [ADR 0002 §2 «Песни (важная оговорка)»](./docs/adr/0002-raw-parse-vs-canonical-display.md)
- [ADR 0001 / Update про M:N](./docs/adr/0001-canonical-dictionary-entities.md)
- [Сущности и связи → `video_songs`](./docs/entities.ru.md)

**Why:** у видео несколько песен; сейчас несопоставленные песни «проваливаются» (в `video_songs`
только matched), а `videos.song_title/song_id` — одиночный legacy snapshot. Цель: `video_songs` хранит
и сырое, и каноническое, покрывая все песни.

**Steps:**

- [ ] Миграция: в `video_songs` добавить `raw_title TEXT`, сделать `song_id` nullable, добавить
      `position INTEGER`; пересмотреть PK (сейчас `(video_id, song_id)` → напр. `(video_id, position)`,
      т.к. `song_id` может быть NULL). См. текущую миграцию `migrations/20260516100000_create_videos_songs.ts`.
- [ ] `src/services/parser/videoSongs.service.ts` (+ `songTitles.util.ts`): писать каждую распознанную
      песню строкой `video_songs` с `raw_title` и, при совпадении, `song_id`; сохранять порядок (`position`).
- [ ] Отображение песни = `COALESCE(ds.title, raw_title)`; обновить чтения в `dictionary.service.ts`
      (`getVideosBySongId` и пр.).
- [ ] Рассмотреть перенос флагов `is_own_group_song` / `is_own_artist_song` с `videos` на строку
      `video_songs` (при нескольких песнях на уровне видео они неоднозначны).
- [ ] Backfill: перенести существующие `videos.song_title/song_id` в `video_songs` как `position=0`.

**Files:** `migrations/`, `src/services/parser/videoSongs.service.ts`,
`src/services/parser/songTitles.util.ts`, `src/services/dictionary.service.ts`.

**Acceptance:** видео с несколькими песнями (в т.ч. несопоставленными) корректно хранит и отдаёт весь
набор; тесты `videoSongs.service.test.ts` обновлены и зелёные.

**Depends on:** желательно после TASK-1 (общий display-подход).

---

## [ ] TASK-3 — (gated) Судьба legacy-колонок `videos.song_id` / `song_title` (и при желании `*_name`)

**Priority:** low · **Blocked by:** TASK-1, TASK-2
**Docs:**

- [ADR 0001 §4 Phase C/D + §5 Rollback](./docs/adr/0001-canonical-dictionary-entities.md)
- [Entity Unification: Final Migration Readiness](./docs/entity-unification-final-migration.md)
- [Entity Unification: Audit](./docs/entity-unification-audit.md)

**Why:** после стабилизации raw+FK+display и переноса песен в `video_songs` одиночные legacy-колонки
становятся избыточны. Удаление — **destructive**, делать только по readiness-gate из доков.

**Steps:**

- [ ] Снять метрики заполнения `videos.*_id` (SQL из final-migration §2) и достичь порогов (§Phase A).
- [ ] Убедиться, что ни один read-path не зависит от legacy-колонок напрямую (всё через display/FK/`video_songs`).
- [ ] Отдельная destructive-миграция (rename-before-drop), применять только после явного approve.

**Acceptance:** колонки удалены, приложение и тесты зелёные; есть backup/rollback-план.

---

> **Примечание.** Технические находки из разбора миграций (дублирующиеся индексы на `videos.status`/
> `duplicate_group_id`, общая dev/test SQLite-БД, явный `PRAGMA foreign_keys=ON` в `afterCreate`) пока
> **не внесены в документацию**, поэтому здесь не зафиксированы как задачи. Если нужно — добавлю
> отдельную секцию/доки и заведу под них TODO.
