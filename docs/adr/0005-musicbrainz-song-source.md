# ADR 0005: MusicBrainz как второй источник песен (полные трек-листы)

- **Status:** Accepted
- **Date:** 2026-06-15
- **Owners:** Backend team
- **Tags:** dictionary, data-sources, songs, musicbrainz, rate-limiting
- **Related:** [ADR 0004](0004-kpop-data-sources.md), `packages/kpop-sources`

---

## 1) Context

Wikidata (ADR 0004) отдаёт у групп в основном **тайтл-треки/синглы** как отдельные items. Альбомные
треки и би-сайды в Wikidata, как правило, отсутствуют: у релизов почти не заполнены трек-листы
(`P658`) и part-of (`P361`). Пример: песня «Untouchable» из альбома ITZY «Born to Be» в Wikidata не
представлена ни через performer (P175), ни через релиз, поэтому в словарь не попадала. Для полного
покрытия песен нужен источник с настоящими трек-листами.

## 2) Decision

**Добавить MusicBrainz как второй источник песен** (CC0, официальный API). Реализован в том же пакете
`@vidpulse/kpop-sources` зеркально Wikidata-источнику (`MusicBrainzSource`, инъектируемый `fetchImpl`,
тесты на фикстурах).

- **Мост Wikidata → MusicBrainz через `P434`** (MusicBrainz artist id): groups-запрос Wikidata теперь
  тянет `?mbid` (P434). Это надёжная связь без нечёткого матчинга по имени. `mbid` — рантайм-поле
  (`EnrichableGroup`), которое срезается перед сборкой snapshot (схема запрещает доп. поля группы).
- **Обогащение:** для каждой группы с `mbid` тянем все recordings через
  `/ws/2/recording?artist=<mbid>` (пагинация по `recording-count`), нормализуем в `songs[]` с
  дедупом по названию (case-insensitive) и мёржим в `groups[].songs` поверх Wikidata-песен.
- **Тот же пайплайн импорта:** snapshot → `importMediaLibrary` (merge) → `dictionary_song_groups`.
  Изменений БД/схемы нет.
- **Opt-in и отдельно от Wikidata-рефреша** (`MUSICBRAINZ_REFRESH_ENABLED`), т.к. обогащение медленное
  (≤1 req/s → минуты на полный набор). Дефолтный рефреш (Wikidata-only) остаётся быстрым.

## 3) Consequences

- Для живого запуска хост `musicbrainz.org` должен быть в allowlist egress; MusicBrainz требует
  описательный `User-Agent` (`MUSICBRAINZ_USER_AGENT`) и лимит ~1 req/s
  (`MUSICBRAINZ_RATE_LIMIT_MS`, дефолт 1000).
- Полный прогон обогащения занимает минуты (сотни групп × пагинация). Митигируется отдельным флагом,
  опциональным `MUSICBRAINZ_LIMIT` и ночным cron.
- `recording?artist=` возвращает все версии (live/remix/inst) — дедуп по названию убирает основную
  массу шума. Более тонкая фильтрация вариантов — возможный follow-up.
- Группы без `P434` в Wikidata не обогащаются (остаются их Wikidata-песни).

## 4) Follow-up

- Тонкая фильтрация вариантов recordings (отсев `(Live)`/`(Inst.)`/`(Remix)`).
- Фолбэк-мост поиском артиста по имени для групп без `P434`.
- Соло-артисты (Wikidata) — остаётся в [TASK-21](../tasks/task-21-kpop-sources-phase2.md).
