# ADR 0004: Источник данных для словаря K-pop (Wikidata) и пакет `@vidpulse/kpop-sources`

- **Status:** Accepted
- **Date:** 2026-06-13
- **Owners:** Backend team
- **Tags:** dictionary, data-sources, scraping, scheduler, monorepo
- **Related:** [ADR 0001](0001-canonical-dictionary-entities.md), [ADR 0003](0003-monorepo.md)

---

## 1) Context

Словарь (`dictionary_groups/artists/aliases/...`) раньше наполнялся только вручную из демо-сида.
Демо-каталог убран из продакшн-сида (остались только события); группы/участники должны
наполняться автоматически из внешнего источника и обновляться по расписанию.

## 2) Decision

**Источник — Wikidata (SPARQL).** Причины:

- **Лицензия CC0** — данные свободны, без атрибуции/ограничений на переиспользование.
- **Структурированность** — SPARQL отдаёт нормализованные сущности (группа, участники P527,
  жанр P136, классификация girl group/boy band, дата роспуска P576, мультиязычные `rdfs:label`),
  без хрупкого HTML-скрейпинга.
- **Корейские названия** доступны как `rdfs:label @ko` → используются как алиасы.

Альтернативы (отклонены на фазе 1): kprofiles.com / Namuwiki — скрейпинг HTML, нестабильно,
спорный ToS; MusicBrainz — хорош для песен/релизов, но rate-limited (1 req/s) и не нужен для
групп/участников. **MusicBrainz и песни — отдельная фаза 2.**

**Отдельный пакет `@vidpulse/kpop-sources`** (компилируемый, как `@vidpulse/db`): тянет данные,
нормализует в media-library snapshot (тот же формат, что принимает
`MediaLibraryService.importMediaLibrary`). Адаптеры принимают инъектируемый `fetchImpl` → тесты
идут на фикстурах без сети.

**Обновление по расписанию** — сервис `kpopDictionaryService` (cron через `node-cron`), импорт в
режиме `merge` (с опцией `replace` под флагом `dangerousActionsEnabled`). **Opt-in:** включается
`KPOP_DICT_REFRESH_ENABLED=true`. Ручной триггер — `POST /api/kpop-dictionary/refresh`.

## 3) Consequences

- Для живого запуска хост `query.wikidata.org` должен быть в allowlist egress окружения; Wikidata
  требует описательный `User-Agent` (`KPOP_SOURCES_USER_AGENT`).
- `merge` идемпотентен и не затирает ручные правки; `replace` опасен и закрыт флагом.
- Песни/соло-артисты/события источник пока не наполняет (события сидятся вручную).

## 4) Follow-up

- Фаза 2 (песни): реализована — MusicBrainz как второй источник полных трек-листов,
  см. [ADR 0005](0005-musicbrainz-song-source.md).
- Соло-артисты из Wikidata (humans с жанром K-pop) — остаётся открытым, см. `TODO.md` / TASK-21.
