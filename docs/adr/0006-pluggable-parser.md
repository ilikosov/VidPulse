# ADR 0006: Подключаемый парсер — закреплённый контракт и выбор через env

- **Status:** Accepted
- **Date:** 2026-07-01
- **Owners:** Backend team
- **Tags:** parser, dictionary, config, extensibility
- **Related:** [ADR 0002](0002-raw-parse-vs-canonical-display.md), `apps/server/src/services/parser`

---

## 1) Context

Разбор YouTube-заголовков был жёстко зашит: единственный `parseTitle()`-враппер над singleton'ом
(regex + dictionary модули), импортируемый напрямую всеми вызывающими. Альтернативный LLM-парсер
(`parseTitleWithLLM`) существовал отдельно, вне общего контракта, без trace и без нормализации по
словарю. Заменить или добавить реализацию парсера было нельзя без правок в нескольких местах.

Нужно дать **возможность выбора парсера**: закрепить контракт, формализовать взаимодействие со
словарём и добавить выбор через env.

## 2) Decision

**Контракт.** Единый интерфейс `IParser` (`apps/server/src/interfaces/services.ts`) возвращает
`ParseResult` (`services/parser/parser.types.ts`):

```ts
interface ParseResult {
  metadata: Partial<ParsedMetadata>; // сырые имена как evidence
  needsReview: boolean;
  trace: ParserTraceStep[];
}
interface IParser {
  parseTitle(title, publishedAt?, tags?, description?): Promise<ParseResult>;
}
type ParserStrategy = 'pipeline'; // расширяется: | 'llm' | ...
```

Задача парсера — заголовок(+контекст) → **сырой** `ParsedMetadata` (имена) + `needsReview` + `trace`.
Сигнатура позиционная (как раньше) → нулевой churn у вызывающих. `ParserService` объявлен
`implements IParser`.

**Взаимодействие со словарём — два слоя, общие для любого парсера:**

1. **In-parser нормализация** через `DictionaryModule` (порт словаря): приведение
   group/artist/song/event к каноническим именам/алиасам. Обязательна для всех парсеров (LLM-парсер,
   когда появится, прогоняет свой вывод через тот же модуль).
2. **Обязательный резолв ID** (parser-agnostic): после `parseTitle` вызывающие всегда применяют
   `resolveParsedMetadata` (имена → `group_id/artist_id/song_id/event_id`, см.
   `sync/metadata.utils.ts:parseVideoMetadata`). Это гарантия: смена парсера **не** обходит словарь;
   evidence-модель (сырое имя + id, [ADR 0002](0002-raw-parse-vs-canonical-display.md)) сохраняется.

**Выбор через env.** `PARSER_STRATEGY` (default `pipeline`) → `config.parser.strategy`. `pipeline` — стабильный alias текущего production-парсера; для закреплённого сравнения версий можно указывать immutable ключ `pipeline-v1`. Реестр
`services/parser/registry.ts` мапит стратегию → реализацию `IParser`; `getActiveParser()`
возвращает активную, неизвестное значение падает с внятной ошибкой (fail-fast на старте в
`index.ts`). Враппер `parseTitle()` делегирует `getActiveParser()`, поэтому **все** точки разбора
(add / sync / reparse) следуют выбранной стратегии без правок вызывающих («везде»).

## 3) Scope сейчас

Реализована одна фактическая реализация — текущий regex + dictionary pipeline. Она доступна как
`pipeline` (production alias), `pipeline-v1` (закреплённая версия для сравнения/отката) и
`empty` (детерминированный no-op parser для smoke-тестов и проверки переключения). Механизм
выбора и контракт закреплены так, что добавление нового парсера = реализовать `IParser` + одна
запись в реестре + значение в `ParserStrategy`/`.env.example`.

## 4) Consequences

- (+) Парсер подключаемый; выбор — через env, без изменения кода вызывающих. Текущие ключи: `pipeline` (production alias), `pipeline-v1` (закреплённая версия текущего regex+dictionary pipeline) и `empty` (одинаковый placeholder-результат для каждого title).
- (+) Взаимодействие со словарём одинаково для всех парсеров (нормализация + резолв ID).
- (+) `trace` теперь часть контракта (был потерян в старом `IParser`).
- (−) Пока одна production-реализация — `pipeline` и `pipeline-v1` указывают на один regex+dictionary pipeline; `empty` нужен только для smoke-тестов/проверки переключения, а полноценное A/B между разными алгоритмами появится после регистрации второй production-реализации (например, LLM).

## 5) Future work

- `llm`-стратегия: `LlmParser implements IParser` поверх `parseTitleWithLLM` с нормализацией по
  словарю и минимальным trace; регистрируется в реестре. По решению «везде» явные LLM-эндпоинты
  (`/api/parser/llm-parse*`, «Suggest with AI») тогда мигрируют на `registry` вместо прямого вызова.
