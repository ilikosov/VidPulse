# ADR 0003: Переход на монорепозиторий (npm workspaces)

- **Status:** Accepted (решение принято; реализация в коде — отдельная future-работа, см. [TODO TASK-8](../../TODO.md))
- **Date:** 2026-06-03
- **Owners:** Backend team
- **Tags:** repo-structure, tooling, monorepo, build, dx
- **Related:** [TODO TASK-8](../../TODO.md), [Обзор проекта](../overview.ru.md)

> **Scope этого документа:** фиксируется **проектное решение** по структуре репозитория и инструменту.
> Код и раскладка файлов в рамках этого ADR **не меняются** — реализация отдельным PR (см. §4).

---

## 1) Context

Репозиторий уже фактически содержит **два npm-пакета**, но **без workspace-менеджера**:

- бэкенд — в корне (`package.json`, имя `kpop-archive-manager`; `src/`, `migrations/`, `tests/`);
- фронтенд — в `client/` (Vite + React, отдельный `package.json` и `tsconfig.json`).

Следствия текущего состояния:

- **нет единого install** — зависимости ставятся отдельно (`npm install` + `cd client && npm install`);
- **скрипты-«сантехника»** — корневые `client:dev` / `client:build` / `launch` / `dev:all` ходят через
  `cd client && …` и `concurrently`;
- **два независимых `tsconfig.json`** без общей базы;
- **дублирование типов** — общие доменные/API-контракты (формы `videos`, словарь, DTO) повторяются между
  бэком (`src/interfaces`, `src/types`) и фронтом (`client/src`), нет единого источника типов;
- корень смешивает «приложение бэкенда» и «контейнер репозитория» (бэкенд-`package.json` лежит в корне).

Цель: ввести настоящий монорепозиторий — один install, общий пакет типов, унифицированный тулинг — без
изменения функциональности.

---

## 2) Decision

### 2.1 Инструмент: **npm workspaces**

Выбираем **npm workspaces** (а не pnpm/Yarn/Nx/Turborepo):

- проект уже на `npm` + `package-lock.json` — нулевая стоимость входа, не требует нового пакетного менеджера;
- покрывает главные боли (единый install, общий пакет, hoisting) без дополнительного слоя;
- task-runner с кэшем (Turborepo/Nx) можно добавить **позже** как отдельный слой поверх workspaces, если
  понадобится ускорение CI — это **не блокер** и вынесено в Non-goals.

### 2.2 Целевая раскладка

```
/
├── package.json            # корень: private, "workspaces", общие dev-скрипты (без кода приложения)
├── package-lock.json       # единый lockfile
├── tsconfig.base.json      # общая база TS, остальные extends
├── apps/
│   ├── server/             # бэкенд: бывш. src/, migrations/, tests/, knexfile, vitest, playwright
│   │   ├── package.json
│   │   └── tsconfig.json   # extends ../../tsconfig.base.json
│   └── web/                # фронтенд: бывш. client/
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   └── shared/             # общие типы/контракты (API DTO, доменные формы), без рантайм-зависимостей
│       ├── package.json    # имя напр. @vidpulse/shared
│       └── src/
├── docs/                   # остаётся на уровне репозитория
└── README.md, CLAUDE.md, TODO.md
```

Принципы:

- **`apps/*`** — деплоимые приложения; **`packages/*`** — переиспользуемые библиотеки.
- **`packages/shared`** — единственный источник кросс-пакетных типов; оба приложения импортируют
  `@vidpulse/shared`, дублирование устраняется.
- Корневой `package.json` — `private: true`, поле `workspaces`, только агрегирующие dev-скрипты (без кода).

### 2.3 Скрипты (вместо `cd client` / `concurrently`)

- запуск конкретного пакета: `npm run -w apps/web dev`, `npm run -w apps/server dev`;
- корневые fan-out: `npm run build` / `npm test` запускают соответствующие скрипты во всех workspaces;
- `dev:all` сохраняем как «поставить зависимости → миграции → поднять BE+FE», но через workspace-команды.

---

## 3) Consequences

### Positive

- Один `npm install` в корне поднимает весь репозиторий; один lockfile.
- Общие типы в `packages/shared` — конец дублированию контрактов между BE и FE.
- Унифицированный тулинг (общий `tsconfig.base`, единые Prettier/Husky/lint-staged).
- Чёткое разделение «приложения» (`apps/*`) и «библиотеки» (`packages/*`).
- Готовый фундамент под опциональный Turborepo/Nx, если потребуется кэш сборок.

### Negative / Trade-offs

- Крупный, но **механический** разовый переезд путей (импорты, конфиги, CI).
- Нужно переписать путевые предположения: `--knexfile` (для миграций), Playwright `webServer`, относительные
  пути в конфигах (`migrations.directory`, `path.resolve(__dirname, …)` в knexfile).
- Кратковременная заморозка/ре-базирование открытых веток поверх новой раскладки.

### Risks

- Возможны промахи по путям в миграциях/тестах после перемещения — обязательны прогон `npm test`,
  `npm run test:e2e` и `migrate:latest` на чистой БД после переезда.
- История git по перемещённым файлам читается через `--follow`.

### Non-goals (вне этого решения)

- Внедрение Turborepo/Nx и удалённого кэша — отдельная возможная задача поверх workspaces.
- Переход на pnpm/Yarn.
- Контейнеризация/деплой-пайплайн.

---

## 4) Migration strategy (future PR, не выполняется здесь)

Выполнять **отдельным PR**, желательно **до** задач по схеме данных
([TASK-1…3](../../TODO.md)), чтобы избежать повторных переездов путей.

### Phase 1 — Каркас workspaces

- Добавить в корневой `package.json` `private: true` и `"workspaces": ["apps/*", "packages/*"]`.
- Создать `tsconfig.base.json`; завести пустые `packages/shared` и каталоги `apps/`.

### Phase 2 — Перенос приложений

- `git mv` бэкенда (`src/`, `migrations/`, `tests/`, `knexfile`, `vitest.config.ts`,
  `playwright.config.ts`) в `apps/server/`; вынести бэкенд-`package.json` из корня.
- `git mv client/* apps/web/`.
- Поправить относительные пути: `migrations.directory`, `path.resolve(__dirname, …)` в `knexfile.ts`,
  Playwright `webServer.command`/`cwd`, алиасы импортов.

### Phase 3 — Общий пакет

- Создать `@vidpulse/shared`; перенести туда кросс-пакетные типы (API DTO, доменные формы).
- Заменить дубли в `apps/server` и `apps/web` импортами из `@vidpulse/shared`.

### Phase 4 — Скрипты и тулинг

- Переписать корневые скрипты на workspace-команды; сохранить `dev:all`.
- Выровнять Prettier/Husky/lint-staged, `tsconfig` extends, пути Vitest/Playwright.

### Phase 5 — Доки и проверка

- Обновить [`docs/overview.*`](../overview.ru.md) (раздел структуры проекта) и `CLAUDE.md`.
- Прогнать `npm install`, `npm run dev:all`, `npm test`, `npm run test:e2e`, `migrate:latest` на чистой БД.

---

## 5) Rollback strategy

- Решение пока **только документационное** — откат тривиален (удалить/перевести ADR в `Rejected`).
- На этапе реализации: переезд — это в основном `git mv` + правки конфигов; быстрый откат — `git revert`
  PR целиком. Перед мерджем убедиться, что все проверки (тесты/e2e/миграции) зелёные на новой раскладке.
