# VidPulse

Full-stack приложение для архивации и управления метаданными K-pop видео / Full-stack app for archiving and managing K-pop video metadata.

## 📖 Documentation / Документация

| Document                                                    | Документ                                            |
| ----------------------------------------------------------- | --------------------------------------------------- |
| [Project Overview (English)](./docs/overview.en.md)         | [Обзор проекта (Русский)](./docs/overview.ru.md)    |
| [Entities & Relationships (English)](./docs/entities.en.md) | [Сущности и связи (Русский)](./docs/entities.ru.md) |
| [Contributor Guide](./AGENTS.md)                            | [Руководство контрибьютора](./AGENTS.md)            |

Additional docs live in [`docs/`](./docs) (ADRs, API notes, audits).
Implementation backlog derived from the docs: [`TODO.md`](./TODO.md).

## Quick start

```bash
cp .env.example .env   # set YOUTUBE_API_KEY
npm run dev:all        # install deps, run migrations, launch backend + frontend
```

Backend → http://localhost:3000 · Frontend → http://localhost:5173

See the [Project Overview](./docs/overview.en.md) for full setup, scripts, and architecture.
