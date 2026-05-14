# ADR 0001: Canonical dictionary entities for performance metadata

- **Status:** Accepted
- **Date:** 2026-05-14
- **Owners:** Backend team
- **Tags:** database, dictionary, metadata, migration, backward-compatibility

## 1) Context

В текущей модели данных `videos` хранит сущности перформанса в строковых полях:

- `group_name`
- `artist_name`
- `song_title`
- `event`

Параллельно существует словарный слой:

- `dictionary_groups`
- `dictionary_artists`
- `dictionary_songs`
- `dictionary_events`
- `dictionary_aliases`

Это приводит к дублированию значений, расхождениям в написании (Korean/English/alternative names), усложняет аналитику, дедупликацию и поддержку parser pipeline.

Цель: перевести систему к единому canonical source of truth для сущностей и обеспечить управляемую миграцию без поломки текущих API/сценариев.

## 2) Decision

Принято решение:

1. Таблицы `dictionary_groups`, `dictionary_artists`, `dictionary_songs`, `dictionary_events` являются **canonical source of truth** для соответствующих доменных сущностей.
2. Таблица `videos` **поэтапно** переходит со строковых полей:
   - `group_name` -> `group_id`
   - `artist_name` -> `artist_id`
   - `song_title` -> `song_id`
   - `event` -> `event_id`
3. Строковые поля в `videos` сохраняются временно как:
   - denormalized snapshot (для исторической читаемости записи),
   - backward compatibility слой для существующих API/клиентов.
4. `dictionary_aliases` используется как canonical alias layer для Korean/English/alternative names и служит слоем резолвинга к canonical entity.
5. Parser обязан возвращать:
   - canonical English metadata,
   - entity ids там, где однозначный резолвинг возможен.

## 3) Consequences

### Positive

- Единая точка истины для групп/артистов/песен/событий.
- Снижение количества орфографических/вариантных дублей.
- Улучшение качества поиска, аналитики и рекомендаций.
- Предсказуемые join/query patterns по FK вместо text matching.
- Упрощение поддержки alias normalization (Korean/English/alt variants).

### Negative / Trade-offs

- Увеличение сложности на переходном этапе (dual-write/dual-read).
- Необходимость backfill-миграций и контроля качества маппинга.
- Рост объёма изменений в routes/services/parser/tests.
- Возможны временные несоответствия между snapshot-строками и canonical IDs до завершения миграции.

### Risks

- Неполный резолвинг aliases может оставлять `*_id = null`.
- Ошибки в backfill могут повлиять на исторические данные.
- Нагрузочные риски при массовом пересчёте/миграции без батчинга.

## 4) Migration strategy

Миграция выполняется итеративно с обратной совместимостью.

### Phase 0 — Preparation

- Зафиксировать текущую схему и usage map (выполнено audit-отчётом).
- Уточнить правила canonical naming и alias governance.
- Подготовить метрики качества резолвинга (`resolved_ratio`, `null_id_ratio`, `alias_hit_ratio`).

### Phase 1 — Schema extension

- Добавить в `videos` nullable FK-поля:
  - `group_id`, `artist_id`, `song_id`, `event_id`.
- Добавить FK constraints и индексы на новые поля.
- Существующие строковые поля оставить без удаления.

### Phase 2 — Resolver and dual-write

- Реализовать resolver (name/alias -> canonical entity id) в dictionary layer.
- В parser/sync/update-пайплайнах включить dual-write:
  - запись canonical IDs (когда резолвинг успешен),
  - запись строковых snapshot-полей для совместимости.
- Parser возвращает canonical English metadata и `*_id` при возможности.

### Phase 3 — Backfill historical data

- Батчево заполнить `videos.*_id` для исторических строк.
- Для ambiguous/unknown кейсов логировать причины и отправлять в review queue.
- Повторять backfill до достижения целевого качества резолвинга.

### Phase 4 — Dual-read and API transition

- В query/service слое приоритет чтения: `*_id` -> join к `dictionary_*`.
- Для legacy-клиентов продолжать отдавать string snapshot поля.
- Пошагово переводить внутренние контракты на ID-first модель.

### Phase 5 — Stabilization

- Ввести контроль качества данных и алерты по drift.
- После стабилизации решить судьбу string-полей:
  - либо оставить как immutable snapshot,
  - либо deprecate/remove в отдельном ADR/миграции.

## 5) Rollback strategy

Rollback делится на два уровня.

### Runtime rollback (без schema rollback)

- Отключить ID-first чтение feature flag-ом.
- Вернуть primary чтение/запись на string-поля (`group_name`, `artist_name`, `song_title`, `event`).
- Сохранить уже записанные `*_id`, но не использовать их в критическом path.

### Schema rollback (при необходимости)

- Если требуется откат миграции схемы:
  - удалить/откатить FK constraints и новые индексы,
  - в крайнем случае убрать `*_id` колонки.
- Перед schema rollback:
  - сделать backup,
  - зафиксировать checkpoint,
  - убедиться, что runtime полностью переключен на legacy string-поля.

### Data safety

- Строковые snapshot-поля в `videos` служат safety net и позволяют восстановить функциональность даже при частичном провале ID-резолвинга.
- Все batch/backfill операции должны быть идемпотентными и выполняться транзакционно по разумным батчам.
