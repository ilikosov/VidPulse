# Entity Unification: Final Migration Readiness (no destructive changes)

## Scope

Этот документ фиксирует готовность к **финальной миграции удаления/переименования старых duplicated entities** и план действий.

> Важно: по текущему запросу **ничего не удаляется автоматически**. Только проверка, план и rollback strategy.

---

## 1) Pre-check: старые tables и legacy usage

## 1.1 Какие таблицы считаем legacy

- `groups` (если существует в старых окружениях)
- `artists` (если существует в старых окружениях)
- legacy string-поля в `videos`:
  - `group_name`
  - `artist_name`
  - `song_title`
  - `event`

## 1.2 Результат проверки кода

По коду репозитория:

- Основные dictionary-сущности: `dictionary_groups`, `dictionary_artists`, `dictionary_songs`, `dictionary_events`.
- В миграциях проекта **нет** создания таблиц `groups`/`artists` (только `dictionary_*`).
- Legacy string-поля `videos.*_name`/`song_title`/`event` всё ещё используются как snapshot/backward compatibility слой.

Вывод:

- Удаление гипотетических старых таблиц `groups`/`artists` допустимо только после подтверждения, что они реально существуют в target DB и не используются внешними job/скриптами.
- Удаление string-полей `videos.group_name/artist_name/song_title/event` сейчас преждевременно без дополнительного cutover.

---

## 2) Pre-check: заполненность videos.\*\_id

Ожидаемая проверка перед финальной миграцией:

```sql
SELECT COUNT(*) AS total FROM videos;

SELECT
  SUM(CASE WHEN group_name  IS NOT NULL AND TRIM(group_name)  <> '' THEN 1 ELSE 0 END) AS has_group_name,
  SUM(CASE WHEN group_id    IS NOT NULL THEN 1 ELSE 0 END)                           AS has_group_id,
  SUM(CASE WHEN artist_name IS NOT NULL AND TRIM(artist_name) <> '' THEN 1 ELSE 0 END) AS has_artist_name,
  SUM(CASE WHEN artist_id   IS NOT NULL THEN 1 ELSE 0 END)                           AS has_artist_id,
  SUM(CASE WHEN song_title  IS NOT NULL AND TRIM(song_title)  <> '' THEN 1 ELSE 0 END) AS has_song_title,
  SUM(CASE WHEN song_id     IS NOT NULL THEN 1 ELSE 0 END)                           AS has_song_id,
  SUM(CASE WHEN event       IS NOT NULL AND TRIM(event)       <> '' THEN 1 ELSE 0 END) AS has_event,
  SUM(CASE WHEN event_id    IS NOT NULL THEN 1 ELSE 0 END)                           AS has_event_id
FROM videos;

SELECT
  SUM(CASE WHEN group_id  IS NULL AND group_name  IS NOT NULL AND TRIM(group_name)  <> '' THEN 1 ELSE 0 END) AS unresolved_group,
  SUM(CASE WHEN artist_id IS NULL AND artist_name IS NOT NULL AND TRIM(artist_name) <> '' THEN 1 ELSE 0 END) AS unresolved_artist,
  SUM(CASE WHEN song_id   IS NULL AND song_title  IS NOT NULL AND TRIM(song_title)  <> '' THEN 1 ELSE 0 END) AS unresolved_song,
  SUM(CASE WHEN event_id  IS NULL AND event       IS NOT NULL AND TRIM(event)       <> '' THEN 1 ELSE 0 END) AS unresolved_event
FROM videos;
```

Статус в текущем окружении контейнера:

- файл dev DB не найден (проверка runtime-метрик недоступна в этой среде), поэтому финальные проценты заполнения нужно снять на реальной dev/stage базе перед cutover.

---

## 3) Pre-check: routes и joins переведены на ID-based

Проверено:

- dictionary video routes используют ID-based методы:
  - `/dictionary/groups/:id/videos` -> `getVideosByGroupId`
  - `/dictionary/artists/:id/videos` -> `getVideosByArtistId`
  - `/dictionary/songs/:id/videos` -> `getVideosBySongId`
- В `DictionaryService` есть FK-методы и legacy fallback `getVideosByField` сохранён временно.

Вывод:

- Для dictionary pages read-path уже ID-first.
- Legacy fallback остаётся для controlled rollback/совместимости.

---

## 4) Final migration plan (без авто-удаления)

## Phase A — Readiness gate

1. Прогнать backfill на актуальной БД (`npm run backfill:video-entities`).
2. Снять метрики заполнения `videos.*_id` (SQL выше).
3. Зафиксировать целевые пороги (рекомендуется):
   - `unresolved_group <= 1%`
   - `unresolved_artist <= 1%`
   - `unresolved_song <= 3%`
   - `unresolved_event <= 5%`
4. Проверить, что unresolved кейсы либо допустимы бизнесом, либо заведены в очередь ручной нормализации.

## Phase B — Soft cutover

1. Все новые записи: strict dual-write (`*_id` + string snapshot).
2. Все чтения dictionary pages: ID-based (уже внедрено).
3. Ввести monitoring:
   - `% rows with null *_id when corresponding string not null`
   - parser unresolved rate
   - количество legacy fallback read-path вызовов.

## Phase C — Pre-destructive checkpoint

1. Согласовать freeze window.
2. Сделать full DB backup + restore rehearsal.
3. Подготовить отдельную destructive migration (не применять без отдельного approve):
   - удаление/rename старых таблиц `groups`/`artists` (если физически есть),
   - опционально deprecate/remove legacy string columns в `videos`.

## Phase D — Destructive migration (только после отдельного подтверждения)

Пока **не выполняется**.

---

## 5) Rollback plan

## Runtime rollback (быстрый)

- Вернуть read-path на legacy string fallback там, где это поддержано.
- Оставить `*_id` колонки и данные нетронутыми.
- Временное правило: unresolved записи остаются в `needs_review`.

## Data rollback

- Восстановление из backup snapshot до destructive step.
- При частичном rollback: сохранить `videos` string snapshot как источник отображения.

## Schema rollback

- Для миграции `20260514110000_add_video_dictionary_foreign_keys.ts` использовать `down` (дроп индексов/колонок) только в аварийном сценарии и только после data backup.
- Для будущей destructive migration держать отдельный reversible plan (rename-before-drop предпочтительнее прямого drop).

---

## 6) Решение на текущий момент

- Проект готов к этапу **readiness gate + soft cutover**.
- К этапу **destructive migration** переходить только после:
  - подтверждённых метрик заполнения `videos.*_id`,
  - подтверждения отсутствия runtime зависимости от старых таблиц,
  - отдельного письменного approve на удаление.
