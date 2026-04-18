# Конфигурация

_Этот документ находится в разработке. Полная английская версия доступна по ссылке: [English Configuration Guide](../../en/getting-started/configuration.md)._

## Настройка конфигурации VidPulse

В этом руководстве описаны все параметры конфигурации VidPulse, включая переменные окружения, настройки базы данных, Redis и интеграции с внешними сервисами.

### Переменные окружения

VidPulse использует файл `.env` для хранения конфигурации. Пример файла `.env.example`:

```env
# Базовые настройки
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# База данных
DATABASE_URL=postgresql://user:password@localhost:5432/vidpulse
# или для SQLite:
# DATABASE_URL=file:./data/vidpulse.db

# Redis
REDIS_URL=redis://localhost:6379

# YouTube API
YOUTUBE_API_KEY=your_youtube_api_key_here
YOUTUBE_API_QUOTA_LIMIT=10000

# Классификация
OPENAI_API_KEY=your_openai_api_key_here
CLASSIFICATION_MODEL=gpt-4-turbo
CLASSIFICATION_RULES_PATH=./config/classification-rules.json

# Аутентификация
JWT_SECRET=your_jwt_secret_here
SESSION_SECRET=your_session_secret_here

# Веб-интерфейс
ADMIN_UI_ENABLED=true
ADMIN_UI_PATH=/admin

# Синхронизация
SYNC_INTERVAL_MINUTES=60
MAX_CONCURRENT_SYNCS=5
```

### Подробное описание параметров

#### База данных

- `DATABASE_URL`: URL подключения к базе данных. Поддерживаются PostgreSQL, MySQL и SQLite.
- `DB_POOL_SIZE`: Размер пула соединений (по умолчанию: 10).

#### Redis

- `REDIS_URL`: URL подключения к Redis для кэширования и очередей.
- `REDIS_TTL`: Время жизни кэша в секундах (по умолчанию: 3600).

#### YouTube API

- `YOUTUBE_API_KEY`: Ключ API для доступа к YouTube Data API v3.
- `YOUTUBE_API_QUOTA_LIMIT`: Дневной лимит квоты (для мониторинга).

#### Классификация

- `OPENAI_API_KEY`: Ключ API OpenAI для LLM-классификации.
- `CLASSIFICATION_MODEL`: Модель OpenAI для классификации.
- `CLASSIFICATION_RULES_PATH`: Путь к файлу с правилами классификации.

#### Аутентификация

- `JWT_SECRET`: Секрет для подписи JWT-токенов.
- `SESSION_SECRET`: Секрет для сессий.

#### Синхронизация

- `SYNC_INTERVAL_MINUTES`: Интервал синхронизации в минутах.
- `MAX_CONCURRENT_SYNCS`: Максимальное количество одновременных синхронизаций.

### Конфигурационные файлы

Помимо переменных окружения, VidPulse использует конфигурационные файлы:

#### `config/classification-rules.json`

Правила для гибридной классификации видео.

#### `config/channels-defaults.json`

Настройки по умолчанию для новых каналов.

#### `config/api-rate-limits.json`

Настройки ограничения скорости для API.

### Проверка конфигурации

Для проверки текущей конфигурации используйте команду:

```bash
npm run config:check
```

Или через Docker:

```bash
docker-compose exec app npm run config:check
```

### Безопасность

**ВАЖНО**: Никогда не коммитьте файлы `.env` в репозиторий. Добавьте `.env` в `.gitignore`.

### Дальнейшие шаги

После настройки конфигурации:

- [Запустите первую синхронизацию](../../guides/basic-usage.md#первая-синхронизация)
- [Настройте правила классификации](../../guides/classification-setup.md)
- [Интегрируйтесь с API](../../reference/api/overview.md)

---

_Примечание: Это черновая версия. Полное руководство будет доступно после завершения перевода._
