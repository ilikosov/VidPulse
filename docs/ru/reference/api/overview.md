# Обзор API

_Этот документ находится в разработке. Полная английская версия доступна по ссылке: [English API Overview](../../../en/reference/api/overview.md)._

## Введение в REST API VidPulse

VidPulse предоставляет REST API для программного управления синхронизацией видео, классификацией и администрированием. API использует JSON для обмена данными и поддерживает аутентификацию через JWT.

### Базовый URL

```
http://localhost:3000/api/v1
```

В производственной среде замените `localhost:3000` на ваш домен.

### Аутентификация

Большинство endpoints требуют аутентификации. Поддерживаются два метода:

#### 1. JWT Token

Включите токен в заголовок `Authorization`:

```
Authorization: Bearer <your_jwt_token>
```

#### 2. API Key

Включите ключ в заголовок `X-API-Key`:

```
X-API-Key: <your_api_key>
```

### Формат ответов

Все ответы возвращаются в формате JSON. Успешные запросы возвращают статус 2xx.

#### Успешный ответ

```json
{
  "success": true,
  "data": {
    // данные ответа
  },
  "meta": {
    "page": 1,
    "total": 100,
    "limit": 20
  }
}
```

#### Ошибка

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input parameters",
    "details": [
      {
        "field": "youtubeChannelId",
        "message": "Channel ID is required"
      }
    ]
  }
}
```

### Коды состояния HTTP

- `200` OK - Успешный запрос
- `201` Created - Ресурс создан
- `400` Bad Request - Неверные параметры
- `401` Unauthorized - Требуется аутентификация
- `403` Forbidden - Недостаточно прав
- `404` Not Found - Ресурс не найден
- `429` Too Many Requests - Превышен лимит запросов
- `500` Internal Server Error - Ошибка сервера

### Основные endpoints

#### Каналы

- `GET /channels` - Список каналов
- `GET /channels/:id` - Информация о канале
- `POST /channels` - Добавление канала
- `PUT /channels/:id` - Обновление канала
- `DELETE /channels/:id` - Удаление канала

#### Видео

- `GET /videos` - Список видео
- `GET /videos/:id` - Информация о видео
- `GET /videos/search` - Поиск видео
- `PUT /videos/:id` - Обновление видео
- `POST /videos/:id/classify` - Классификация видео

#### Синхронизация

- `GET /sync/status` - Статус синхронизации
- `POST /sync/all` - Запуск синхронизации всех каналов
- `POST /sync/channel/:channelId` - Синхронизация конкретного канала

#### Классификация

- `GET /classification/rules` - Получение правил классификации
- `POST /classification/rules` - Добавление правила
- `POST /classification/batch` - Пакетная классификация

#### Администрирование

- `GET /admin/metrics` - Метрики системы
- `GET /admin/health` - Проверка здоровья системы
- `POST /admin/maintenance` - Включение режима обслуживания

### Пагинация

Endpoints, возвращающие списки, поддерживают пагинацию:

```
GET /api/v1/videos?page=1&limit=20&sort=publishedAt&order=desc
```

Параметры:

- `page` - Номер страницы (начинается с 1)
- `limit` - Количество элементов на странице (максимум 100)
- `sort` - Поле для сортировки
- `order` - Порядок сортировки (`asc` или `desc`)

### Фильтрация

Многие endpoints поддерживают фильтрацию:

```
GET /api/v1/videos?category=educational&publishedAfter=2024-01-01
```

### Версионирование

API использует версионирование через путь. Текущая версия: `v1`. При внесении критических изменений будет выпущена новая версия.

### Ограничение скорости

По умолчанию:

- 100 запросов в минуту для аутентифицированных пользователей
- 10 запросов в минуту для неаутентифицированных запросов

Заголовки ответа содержат информацию об ограничениях:

- `X-RateLimit-Limit` - Лимит запросов
- `X-RateLimit-Remaining` - Оставшиеся запросы
- `X-RateLimit-Reset` - Время сброса (Unix timestamp)

### Примеры использования

#### Получение списка видео

```bash
curl -X GET "http://localhost:3000/api/v1/videos?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Добавление нового канала

```bash
curl -X POST "http://localhost:3000/api/v1/channels" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "youtubeChannelId": "UC_x5XG1OV2P6uZZ5FSM9Ttw",
    "name": "Google Developers",
    "syncInterval": 60
  }'
```

#### Запуск синхронизации

```bash
curl -X POST "http://localhost:3000/api/v1/sync/all" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Дальнейшие шаги

- [Аутентификация](./authentication.md)
- [API видео](./videos-api.md)
- [API каналов](./channels-api.md)
- [API синхронизации](./sync-api.md)
- [Вебхуки](./webhooks.md)

---

_Примечание: Это черновая версия. Полное руководство будет доступно после завершения перевода._
